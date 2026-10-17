"use strict";
// Fleet Finder: a Battleship-style game. Rules: docs/rules/fleet.md
const rng = require("../../engine/rng");
const { jsonState } = require("../../engine/contract");

const FLEETS = {
  8: [["Liner", 4], ["Ferry", 3], ["Trawler", 3], ["Dinghy", 2]],
  10: [["Tanker", 5], ["Liner", 4], ["Ferry", 3], ["Trawler", 3], ["Dinghy", 2]],
};
const ROWS = "ABCDEFGHIJ";
const clone = jsonState.restore;
const other = (seat) => 1 - seat;
const cellName = (r, c) => `${ROWS[r]}${c + 1}`;

function shipCells(row, col, across, length) {
  return Array.from({ length }, (_, i) => (across ? [row, col + i] : [row + i, col]));
}

// Returns an error string, or null if the ship fits.
function placementError(state, seat, shipIndex, row, col, across) {
  const size = state.size;
  const [name, length] = state.fleet[shipIndex];
  const cells = shipCells(row, col, across, length);
  if (cells.some(([r, c]) => r < 0 || c < 0 || r >= size || c >= size)) {
    return `The ${name} doesn't fit there. It needs ${length} squares ${across ? "across" : "down"}.`;
  }
  const taken = new Set();
  state.ships[seat].forEach((s, i) => {
    if (s && i !== shipIndex) for (const [r, c] of s.cells) taken.add(`${r},${c}`);
  });
  if (cells.some(([r, c]) => taken.has(`${r},${c}`))) return `The ${name} would overlap another ship there.`;
  return null;
}

function randomFleet(state, seat) {
  state.ships[seat] = state.fleet.map(() => null);
  state.fleet.forEach(([, length], i) => {
    for (;;) {
      const across = rng.int(state.rng, 2) === 0;
      const row = rng.int(state.rng, across ? state.size : state.size - length + 1);
      const col = rng.int(state.rng, across ? state.size - length + 1 : state.size);
      if (!placementError(state, seat, i, row, col, across)) {
        state.ships[seat][i] = { cells: shipCells(row, col, across, length), across };
        return;
      }
    }
  });
}

const allPlaced = (state, seat) => state.ships[seat].every(Boolean);
const shotAt = (state, seat, r, c) => state.shots[seat].some(([sr, sc]) => sr === r && sc === c);
const isSunk = (state, owner, ship) => ship.cells.every(([r, c]) => shotAt(state, other(owner), r, c));
const fleetSunk = (state, owner) => state.ships[owner].every((s) => isSunk(state, owner, s));

function shipAt(state, owner, r, c) {
  return state.ships[owner].findIndex((s) => s && s.cells.some(([sr, sc]) => sr === r && sc === c));
}

const engine = {
  id: "fleet",
  title: "Fleet Finder",
  blurb: "Hide your ships, then take turns guessing where the other player's ships are.",
  defaultSettings: { size: 8 },
  settingsOptions: {
    size: {
      label: "Board size",
      choices: [{ value: 8, label: "8 by 8, 4 ships (quicker, bigger squares)" }, { value: 10, label: "10 by 10, 5 ships" }],
    },
  },
  concurrentActions: ["place", "randomise", "ready"],

  normaliseSettings(s) {
    const size = Number(s.size);
    if (!FLEETS[size]) return { error: "Board size must be 8 or 10." };
    return { size };
  },

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    const state = {
      names: players.map((p) => p.name),
      size: settings.size,
      fleet: FLEETS[settings.size],
      ships: [null, null],
      ready: [false, false],
      shots: [[], []], // shots[seat] = squares that seat has fired at
      phase: "placing",
      turn: null,
      winner: null,
      rng: r,
    };
    state.ships = [FLEETS[settings.size].map(() => null), FLEETS[settings.size].map(() => null)];
    return state;
  },

  legalActions(state, seat) {
    if (state.phase === "placing") {
      if (state.ready[seat]) return [];
      const actions = [
        { type: "place", label: "Place a ship", input: true },
        { type: "randomise", label: "Place my ships for me" },
      ];
      if (allPlaced(state, seat)) actions.push({ type: "ready", label: "My ships are ready" });
      return actions;
    }
    if (state.phase !== "battle" || state.turn !== seat) return [];
    const out = [];
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (!shotAt(state, seat, r, c)) out.push({ type: "fire", row: r, col: c, label: `Fire at ${cellName(r, c)}` });
      }
    }
    return out;
  },

  applyAction(prev, seat, action) {
    if (prev.phase === "over") return { error: "The game is over." };
    const state = clone(prev);
    const me = state.names[seat];

    if (state.phase === "placing") {
      if (state.ready[seat]) return { error: "Your ships are locked in. Waiting for the other player." };
      if (action.type === "randomise") {
        randomFleet(state, seat);
        return { state, events: [] };
      }
      if (action.type === "place") {
        const i = Number(action.ship);
        const row = Number(action.row);
        const col = Number(action.col);
        if (!Number.isInteger(i) || !state.fleet[i]) return { error: "Choose a ship first." };
        if (!Number.isInteger(row) || !Number.isInteger(col)) return { error: "Choose a square for the ship." };
        const across = !!action.across;
        const err = placementError(state, seat, i, row, col, across);
        if (err) return { error: err };
        state.ships[seat][i] = { cells: shipCells(row, col, across, state.fleet[i][1]), across };
        return { state, events: [] };
      }
      if (action.type === "ready") {
        if (!allPlaced(state, seat)) return { error: "Place all your ships first." };
        state.ready[seat] = true;
        const events = [{ text: `${me}'s ships are ready.` }];
        if (state.ready.every(Boolean)) {
          state.phase = "battle";
          state.turn = rng.int(state.rng, 2);
          events.push({ text: `Both fleets are hidden. ${state.names[state.turn]} fires first.` });
        }
        return { state, events };
      }
      return { error: "Place your ships first." };
    }

    if (state.turn !== seat) return { error: `It's ${state.names[state.turn]}'s turn.` };
    if (action.type !== "fire") return { error: "Choose a square to fire at." };
    const row = Number(action.row);
    const col = Number(action.col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= state.size || col >= state.size) {
      return { error: "That square isn't on the board." };
    }
    if (shotAt(state, seat, row, col)) return { error: `You've already fired at ${cellName(row, col)}. Pick a new square.` };
    state.shots[seat].push([row, col]);
    const opp = other(seat);
    const hit = shipAt(state, opp, row, col);
    const events = [];
    if (hit === -1) {
      events.push({ text: `${me} fired at ${cellName(row, col)}: miss.` });
    } else if (isSunk(state, opp, state.ships[opp][hit])) {
      events.push({ text: `${me} fired at ${cellName(row, col)}: hit! ${me} sank ${state.names[opp]}'s ${state.fleet[hit][0]}.` });
    } else {
      events.push({ text: `${me} fired at ${cellName(row, col)}: hit!` });
    }
    if (fleetSunk(state, opp)) {
      state.phase = "over";
      state.turn = null;
      state.winner = seat;
      events.push({ text: `${me} has sunk every ship.` });
    } else {
      state.turn = opp;
      events.push({ text: `Now it's ${state.names[opp]}'s turn.` });
    }
    return { state, events };
  },

  getPlayerView(state, seat) {
    const opp = other(seat);
    const over = state.phase === "over";
    // Your board: your ships and where the other player has fired.
    const own = [];
    for (let r = 0; r < state.size; r++) {
      own.push([]);
      for (let c = 0; c < state.size; c++) {
        const ship = shipAt(state, seat, r, c) !== -1;
        const shot = shotAt(state, opp, r, c);
        own[r].push(ship ? (shot ? "hit" : "ship") : shot ? "miss" : "water");
      }
    }
    // Their board: only what your shots revealed. Unhit ship squares look
    // exactly like unknown water until the game ends.
    const target = [];
    for (let r = 0; r < state.size; r++) {
      target.push([]);
      for (let c = 0; c < state.size; c++) {
        const i = shipAt(state, opp, r, c);
        const shot = shotAt(state, seat, r, c);
        if (shot) target[r].push(i === -1 ? "miss" : isSunk(state, opp, state.ships[opp][i]) ? "sunk" : "hit");
        else target[r].push(over && i !== -1 ? "ship" : "unknown");
      }
    }
    const fleetStatus = (owner) => state.fleet.map(([name, length], i) => ({
      name, length, sunk: !!state.ships[owner][i] && state.phase !== "placing" && isSunk(state, owner, state.ships[owner][i]),
    }));
    const placed = state.ships[seat].map((s) => (s ? { cells: s.cells, across: s.across } : null));
    return {
      phase: state.phase,
      turn: state.turn,
      size: state.size,
      prompt: state.phase === "placing" ? "place your ships, then press ready." : "tap a square on their board to fire.",
      youReady: state.ready[seat],
      opponentReady: state.ready[opp],
      fleet: state.fleet.map(([name, length]) => ({ name, length })),
      placed,
      own,
      target,
      yourFleet: fleetStatus(seat),
      theirFleet: fleetStatus(opp),
    };
  },

  hiddenFrom() {
    return []; // ship positions are checked structurally in test/games/fleet.test.js
  },

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const hits = (seat) => state.shots[seat].filter(([r, c]) => shipAt(state, other(seat), r, c) !== -1).length;
    const scores = { 0: hits(0), 1: hits(1) };
    const w = state.winner;
    return {
      scores,
      winner: w,
      unit: "hits",
      summary: `${state.names[w]} wins by sinking the whole fleet in ${state.shots[w].length} shots.`,
    };
  },

  ...jsonState,
};

module.exports = engine;
