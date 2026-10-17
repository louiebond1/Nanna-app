"use strict";
// Room lifecycle and match flow, with no networking. The socket layer and the
// tests both drive this directly. Every method is synchronous and saves the
// room before it returns, so two actions can never interleave.
const crypto = require("crypto");
const rng = require("../engine/rng");

const SEATS = 2;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
const CODE_LENGTH = 6;
const MAX_NAME = 20;
const MAX_ACTION_ID = 64;

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

function cleanName(input, fallback) {
  const name = String(input ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
  return name || fallback;
}

function normaliseCode(input) {
  return String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

class RoomService {
  constructor({ store, games, now = () => Date.now(), newSeed = rng.newSeed }) {
    this.store = store;
    this.games = games;
    this.now = now;
    this.newSeed = newSeed;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  changed(roomId) {
    for (const fn of this.listeners) fn(roomId);
  }

  newCode() {
    for (;;) {
      const bytes = crypto.randomBytes(CODE_LENGTH);
      let code = "";
      for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
      if (!this.store.codeInUse(code)) return code;
    }
  }

  save(room) {
    room.updatedAt = this.now();
    this.store.saveRoom(room);
  }

  createRoom(name) {
    const token = crypto.randomBytes(32).toString("hex");
    const room = {
      id: crypto.randomBytes(16).toString("hex"),
      code: this.newCode(),
      createdAt: this.now(),
      updatedAt: this.now(),
      seats: [{ name: cleanName(name, "Player 1"), tokenHash: hashToken(token) }, null],
      status: "lobby",
      lobby: { gameId: null, settings: null, ready: [false, false] },
      match: null,
      rematch: [false, false],
      notice: null,
    };
    this.save(room);
    return { ok: true, roomId: room.id, seat: 0, token };
  }

  findRoom(ref) {
    const raw = String(ref ?? "").trim();
    if (/^[0-9a-f]{32}$/.test(raw)) return this.store.getRoom(raw);
    const code = normaliseCode(raw);
    if (code.length !== CODE_LENGTH) return null;
    const id = this.store.getRoomIdByCode(code);
    return id ? this.store.getRoom(id) : null;
  }

  joinRoom(ref, name) {
    const room = this.findRoom(ref);
    if (!room) return { error: "We couldn't find that room. Check the code and try again." };
    const seat = room.seats.findIndex((s) => s === null);
    if (seat === -1) return { error: "This room already has two players." };
    const token = crypto.randomBytes(32).toString("hex");
    room.seats[seat] = { name: cleanName(name, `Player ${seat + 1}`), tokenHash: hashToken(token) };
    room.notice = `${room.seats[seat].name} joined.`;
    this.save(room);
    this.changed(room.id);
    return { ok: true, roomId: room.id, seat, token };
  }

  // Returns the seat a token belongs to, or an error. Used on every reconnect.
  resume(roomId, token) {
    const room = this.store.getRoom(String(roomId ?? ""));
    if (!room) return { error: "That room no longer exists." };
    const hash = hashToken(token);
    const seat = room.seats.findIndex((s) => s && s.tokenHash === hash);
    if (seat === -1) return { error: "This device isn't part of that room any more." };
    return { ok: true, roomId: room.id, seat };
  }

  withRoom(roomId, seat, fn) {
    const room = this.store.getRoom(roomId);
    if (!room || !room.seats[seat]) return { error: "You're not in this room any more." };
    const result = fn(room);
    if (result && result.error) return result;
    this.save(room);
    this.changed(room.id);
    return result || { ok: true };
  }

  chooseGame(roomId, seat, gameId, settingsInput) {
    return this.withRoom(roomId, seat, (room) => {
      if (room.status === "playing") return { error: "Finish or leave the current game first." };
      const engine = this.games.get(gameId);
      if (!engine) return { error: "That game isn't available yet." };
      const settings = engine.normaliseSettings({ ...engine.defaultSettings, ...(settingsInput || {}) });
      if (settings.error) return { error: settings.error };
      room.status = "lobby";
      room.match = null;
      room.rematch = [false, false];
      room.lobby = { gameId, settings, ready: [false, false] };
      room.notice = `${room.seats[seat].name} chose ${engine.title}. Both players press Ready to start.`;
    });
  }

  setReady(roomId, seat, ready) {
    return this.withRoom(roomId, seat, (room) => {
      if (room.status !== "lobby") return { error: "The game has already started." };
      if (!room.lobby.gameId) return { error: "Choose a game first." };
      room.lobby.ready[seat] = !!ready;
      if (room.seats.every(Boolean) && room.lobby.ready.every(Boolean)) {
        this.startMatch(room, room.lobby.gameId, room.lobby.settings);
      }
    });
  }

  startMatch(room, gameId, settings) {
    const engine = this.games.get(gameId);
    const players = room.seats.map((s, seat) => ({ seat, name: s.name }));
    const seed = this.newSeed();
    const state = engine.createGame(settings, players, seed);
    room.status = "playing";
    room.rematch = [false, false];
    room.lobby.ready = [false, false];
    room.match = {
      gameId,
      settings,
      seed,
      state: engine.serialize(state),
      version: 0,
      startedAt: this.now(),
      events: [{ text: `${engine.title} has started.` }],
      outcome: null,
    };
    room.notice = null;
  }

  // action = { actionId, version, move }. Safe to retry: a repeated actionId
  // returns the first result without applying the move again.
  act(roomId, seat, input) {
    const actionId = typeof input?.actionId === "string" ? input.actionId : "";
    if (!actionId || actionId.length > MAX_ACTION_ID) return { error: "That move was missing its ID. Please try again." };
    const previous = this.store.getAction(roomId, actionId);
    if (previous) {
      if (previous.seat !== seat) return { error: "That move ID was already used." };
      return { ...previous.result, duplicate: true };
    }
    const room = this.store.getRoom(roomId);
    if (!room || !room.seats[seat]) return { error: "You're not in this room any more." };
    if (room.status !== "playing") return { error: "There's no game in progress." };
    const match = room.match;
    const move = input.move;
    if (!move || typeof move !== "object" || Array.isArray(move) || typeof move.type !== "string") {
      return { error: "That move wasn't understood." };
    }
    const engine = this.games.get(match.gameId);
    // Moves both players make at the same time (placing ships, finding words)
    // are listed in engine.concurrentActions and skip the version check; the
    // engine still validates them against the current state.
    const concurrent = (engine.concurrentActions || []).includes(move.type);
    if (input.version !== match.version && !concurrent) {
      return { error: "The game has moved on since you last looked. Here's the latest.", stale: true };
    }
    const outcome = engine.applyAction(engine.restore(match.state), seat, move);
    if (outcome.error) return { error: outcome.error };

    match.state = engine.serialize(outcome.state);
    match.version += 1;
    match.events = outcome.events || [];
    if (engine.isGameOver(outcome.state)) {
      room.status = "finished";
      match.outcome = engine.score(outcome.state);
    }
    const result = { ok: true, version: match.version };
    this.store.transaction(() => {
      this.save(room);
      this.store.saveAction(roomId, actionId, seat, result, this.now());
      if (match.outcome) {
        this.store.saveResult(roomId, match.gameId, room.seats.map((s) => s.name), match.outcome, this.now());
      }
    });
    this.changed(roomId);
    return result;
  }

  voteRematch(roomId, seat) {
    return this.withRoom(roomId, seat, (room) => {
      if (room.status !== "finished") return { error: "The game isn't finished yet." };
      room.rematch[seat] = true;
      if (room.rematch.every(Boolean) && room.seats.every(Boolean)) {
        this.startMatch(room, room.match.gameId, room.match.settings);
      } else {
        room.notice = `${room.seats[seat].name} wants a rematch.`;
      }
    });
  }

  leave(roomId, seat) {
    return this.withRoom(roomId, seat, (room) => {
      const name = room.seats[seat].name;
      room.seats[seat] = null;
      if (room.status !== "lobby") {
        room.status = "lobby";
        room.match = null;
      }
      room.rematch = [false, false];
      room.lobby.ready = [false, false];
      room.notice = `${name} left the room.`;
    });
  }

  // Everything one seat is allowed to see. This is the only thing sent to a client.
  viewFor(roomId, seat, connected = [false, false]) {
    const room = this.store.getRoom(roomId);
    if (!room) return null;
    const view = {
      roomId: room.id,
      code: room.code,
      you: seat,
      status: room.status,
      notice: room.notice,
      players: room.seats.map((s, i) => (s ? { seat: i, name: s.name, connected: !!connected[i] } : null)),
      lobby: room.lobby,
      rematch: room.rematch,
      games: [...this.games.values()].map((g) => ({
        id: g.id, title: g.title, blurb: g.blurb || "", defaultSettings: g.defaultSettings || {}, settingsOptions: g.settingsOptions || {},
      })),
      match: null,
      recentResults: this.store.recentResults(room.id, 5),
    };
    if (room.match) {
      const engine = this.games.get(room.match.gameId);
      const state = engine.restore(room.match.state);
      const legal = room.status === "playing" ? engine.legalActions(state, seat) : [];
      view.match = {
        gameId: room.match.gameId,
        title: engine.title,
        settings: room.match.settings,
        version: room.match.version,
        view: engine.getPlayerView(state, seat),
        legalActions: legal,
        yourTurn: legal.length > 0,
        events: room.match.events
          .filter((e) => e.forSeat === undefined || e.forSeat === seat)
          .map(({ text }) => ({ text })),
        outcome: room.match.outcome,
      };
    }
    return view;
  }
}

module.exports = { RoomService, cleanName, normaliseCode, SEATS, CODE_LENGTH };
