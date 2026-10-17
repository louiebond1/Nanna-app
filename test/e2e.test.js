"use strict";
// For every registered game: two real Socket.IO clients create a room, start
// the game, play it to the end over the network, see the result and rematch.
// Every state each client receives is checked against the engine's
// hiddenFrom(state, seat) list, so secrets can't reach the wrong device.
const test = require("node:test");
const assert = require("node:assert/strict");
const { io: connect } = require("socket.io-client");
const { createApp } = require("../server/app");
const { createRegistry } = require("../server/games");
const { tempFile } = require("./helpers");
const { createBot } = require("./bot");

const quiet = { error() {}, log() {} };

function client(url) {
  const socket = connect(url, { transports: ["websocket"], forceNew: true, reconnection: false });
  const c = { socket, latest: null, waiters: [] };
  socket.on("room:state", (s) => {
    c.latest = s;
    c.waiters = c.waiters.filter((w) => !(w.pred(s) && (w.resolve(s), true)));
  });
  c.call = (event, payload = {}) => new Promise((r) => socket.emit(event, payload, r));
  c.until = (pred, ms = 3000) => {
    if (c.latest && pred(c.latest)) return Promise.resolve(c.latest);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timed out waiting for state")), ms);
      c.waiters.push({ pred, resolve: (s) => (clearTimeout(t), resolve(s)) });
    });
  };
  return new Promise((r) => socket.on("connect", () => r(c)));
}

const games = createRegistry();

for (const engine of games.values()) {
  test(`${engine.id}: full game over the network, no leaks, then rematch`, async (t) => {
    const fast = { capacity: 1e6, refillPerSecond: 1e6 }; // a bot taps far faster than a person
    const app = createApp({ dataFile: tempFile(), games, log: quiet, limits: { entry: fast, action: fast } });
    await new Promise((r) => app.server.listen(0, r));
    const url = `http://localhost:${app.server.address().port}`;
    const seats = [await client(url), await client(url)];
    t.after(async () => {
      for (const c of seats) c.socket.disconnect();
      app.io.close();
      await new Promise((r) => app.server.close(r));
      app.store.close();
    });
    const created = await seats[0].call("room:create", { name: "Nanna" });
    const code = (await seats[0].until((s) => s.code)).code;
    await seats[1].call("room:join", { room: code, name: "Sam" });
    await seats[0].call("lobby:choose", { gameId: engine.id, settings: { ...engine.defaultSettings, ...engine.testSettings } });
    await seats[0].call("lobby:ready", { ready: true });
    await seats[1].call("lobby:ready", { ready: true });

    const checkLeaks = (version) => {
      if (!engine.hiddenFrom) return;
      const room = app.store.getRoom(created.roomId);
      if (room.match.version !== version) return;
      const state = engine.restore(room.match.state);
      for (const seat of [0, 1]) {
        // Check the game part of the payload; the lobby's game list holds ids
        // like "gin" that would falsely match hidden words.
        const { view, legalActions, events, outcome } = seats[seat].latest.match;
        const json = JSON.stringify({ view, legalActions, events, outcome });
        for (const secret of engine.hiddenFrom(state, seat)) {
          assert.ok(!json.includes(JSON.stringify(secret)), `${engine.id}: ${secret} leaked to seat ${seat} at v${version}`);
        }
      }
    };

    let version = 0;
    let moves = 0;
    const pick = createBot(`e2e-${engine.id}`);
    for (;;) {
      const views = await Promise.all(seats.map((c) => c.until((s) => s.match && s.match.version === version)));
      checkLeaks(version);
      if (views[0].status === "finished") break;
      const seat = views.findIndex((v) => v.match.legalActions.some((a) => !a.input));
      assert.ok(seat !== -1, `${engine.id}: nobody can move at v${version}`);
      const options = views[seat].match.legalActions.filter((a) => !a.input);
      const { label, ...move } = pick(options);
      const r = await seats[seat].call("game:action", { actionId: `m${moves}`, version, move });
      assert.ok(r.ok, `${engine.id}: ${r.error}`);
      version = r.version;
      assert.ok(++moves < 10000, "too many moves");
    }
    const end = seats[0].latest;
    assert.ok(end.match.outcome.summary);
    assert.equal(end.recentResults.length, 1);

    await seats[0].call("game:rematch");
    await seats[1].call("game:rematch");
    await seats[0].until((s) => s.status === "playing" && s.match.version === 0);
  });
}
