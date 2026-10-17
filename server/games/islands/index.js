"use strict";
// Island Conquest: a Risk-inspired two-player strategy game with its own
// small map and simplified rules. Rules: docs/rules/islands.md
const rng = require("../../engine/rng");
const { jsonState } = require("../../engine/contract");
const { ISLANDS, TERRITORIES, LINKS, SEA, ADJ } = require("./map");

const NEUTRAL = 2;
const clone = jsonState.restore;
const other = (seat) => 1 - seat;
const T = Object.fromEntries(TERRITORIES.map((t) => [t.id, t]));

const owned = (state, seat) => TERRITORIES.filter((t) => state.owner[t.id] === seat).map((t) => t.id);
const islandsHeld = (state, seat) => ISLANDS.filter((i) => TERRITORIES.filter((t) => t.island === i.id).every((t) => state.owner[t.id] === seat));
const reinforcements = (state, seat) =>
  Math.max(3, Math.floor(owned(state, seat).length / 3)) + islandsHeld(state, seat).reduce((s, i) => s + i.bonus, 0);
const who = (state, seat) => (seat === NEUTRAL ? "the neutral army" : state.names[seat]);

function startTurn(state, seat, events) {
  state.turn = seat;
  state.step = "reinforce";
  state.toPlace = reinforcements(state, seat);
  const bonus = islandsHeld(state, seat);
  events.push({ text: `${state.names[seat]}'s turn: ${state.toPlace} new armies to place${bonus.length ? ` (including island bonuses for ${bonus.map((i) => i.name).join(" and ")})` : ""}.` });
}

function checkWin(state, seat, events) {
  if (!owned(state, other(seat)).length) {
    state.winner = seat;
    state.winReason = `${state.names[seat]} took every one of ${state.names[other(seat)]}'s territories.`;
  } else if (islandsHeld(state, seat).length >= 2) {
    state.winner = seat;
    state.winReason = `${state.names[seat]} holds two whole islands: ${islandsHeld(state, seat).map((i) => i.name).join(" and ")}.`;
  }
  if (state.winner !== null) {
    state.phase = "over";
    state.turn = null;
    events.push({ text: state.winReason });
    return true;
  }
  return false;
}

function endTurn(state, seat, events) {
  if (checkWin(state, seat, events)) return;
  const next = other(seat);
  if (next === state.firstPlayer) state.round++;
  if (state.maxRounds && state.round > state.maxRounds) {
    const count = (s) => owned(state, s).length;
    const armies = (s) => owned(state, s).reduce((t, id) => t + state.armies[id], 0);
    const [a, b] = [0, 1].map(count);
    const [x, y] = [0, 1].map(armies);
    state.winner = a !== b ? (a > b ? 0 : 1) : x !== y ? (x > y ? 0 : 1) : null;
    state.winReason = state.winner === null
      ? `After ${state.maxRounds} rounds it's level: ${a} territories and ${x} armies each.`
      : `After ${state.maxRounds} rounds, ${state.names[state.winner]} holds ${Math.max(a, b)} territories to ${Math.min(a, b)}${a === b ? `, with more armies (${Math.max(x, y)} to ${Math.min(x, y)})` : ""}.`;
    state.phase = "over";
    state.turn = null;
    events.push({ text: state.winReason });
    return;
  }
  startTurn(state, next, events);
}

const engine = {
  id: "islands",
  title: "Island Conquest",
  blurb: "Place armies, attack with dice and take over the islands. Inspired by classic conquest games.",
  defaultSettings: { maxRounds: 20 },
  testSettings: { maxRounds: 10 },
  settingsOptions: {
    maxRounds: {
      label: "Game length",
      choices: [
        { value: 10, label: "Short: up to 10 rounds each" },
        { value: 20, label: "Medium: up to 20 rounds each" },
        { value: 0, label: "Until someone wins" },
      ],
    },
  },

  normaliseSettings(s) {
    const maxRounds = Number(s.maxRounds);
    if (![0, 10, 20].includes(maxRounds)) return { error: "Choose a game length." };
    return { maxRounds };
  },

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    // Balanced start: across the three islands each player gets 2 + 1 + 1
    // territories and the neutral army 1 + 1 + 2, in a random arrangement.
    const patterns = rng.shuffle(r, [[0, 0, 1, NEUTRAL], [0, 1, 1, NEUTRAL], [0, 1, NEUTRAL, NEUTRAL]]);
    const owner = {};
    const armies = {};
    ISLANDS.forEach((island, i) => {
      const ids = rng.shuffle(r, TERRITORIES.filter((t) => t.island === island.id).map((t) => t.id));
      ids.forEach((id, j) => {
        owner[id] = patterns[i][j];
        armies[id] = owner[id] === NEUTRAL ? 2 : 3;
      });
    });
    const state = {
      names: players.map((p) => p.name),
      owner, armies,
      maxRounds: settings.maxRounds,
      round: 1,
      firstPlayer: rng.int(r, 2),
      turn: null, step: null, toPlace: 0,
      phase: "playing", winner: null, winReason: null,
      lastRoll: null,
      fortified: false,
      rng: r,
    };
    startTurn(state, state.firstPlayer, []);
    return state;
  },

  legalActions(state, seat) {
    if (state.phase !== "playing" || state.turn !== seat) return [];
    const mine = owned(state, seat);
    const out = [];
    if (state.step === "reinforce") {
      for (const id of mine) {
        out.push({ type: "place", territory: id, count: state.toPlace, label: `Put all ${state.toPlace} on ${T[id].name}` });
        if (state.toPlace > 1) out.push({ type: "place", territory: id, count: 1, label: `Put 1 on ${T[id].name}` });
      }
      return out;
    }
    if (state.step === "attack") {
      for (const from of mine) {
        if (state.armies[from] < 2) continue;
        for (const to of ADJ[from]) if (state.owner[to] !== seat) out.push({ type: "attack", from, to, label: `Attack ${T[to].name} from ${T[from].name}` });
      }
      out.push({ type: "endAttack", label: "Stop attacking" });
      return out;
    }
    // fortify
    out.push({ type: "endTurn", label: "End my turn without moving" });
    for (const from of mine) {
      if (state.armies[from] < 2) continue;
      for (const to of ADJ[from]) {
        if (state.owner[to] === seat) out.push({ type: "fortify", from, to, count: state.armies[from] - 1, label: `Move ${state.armies[from] - 1} from ${T[from].name} to ${T[to].name}` });
      }
    }
    return out;
  },

  applyAction(prev, seat, action) {
    if (prev.phase !== "playing") return { error: "The game is over." };
    if (prev.turn !== seat) return { error: `It's ${prev.names[prev.turn]}'s turn.` };
    const state = clone(prev);
    const me = state.names[seat];
    const events = [];

    if (state.step === "reinforce") {
      if (action.type !== "place") return { error: `First place your ${state.toPlace} new armies on your own territories.` };
      const id = action.territory;
      if (!T[id]) return { error: "Choose a territory." };
      if (state.owner[id] !== seat) return { error: `${T[id].name} isn't yours. Place armies on your own territories.` };
      const count = Number(action.count);
      if (!Number.isInteger(count) || count < 1 || count > state.toPlace) return { error: `You can place between 1 and ${state.toPlace} armies.` };
      state.armies[id] += count;
      state.toPlace -= count;
      events.push({ text: `${me} placed ${count} ${count === 1 ? "army" : "armies"} on ${T[id].name}.` });
      if (!state.toPlace) {
        state.step = "attack";
        events.push({ text: `${me} can now attack.` });
      }
      return { state, events };
    }

    if (state.step === "attack") {
      if (action.type === "endAttack") {
        state.step = "fortify";
        state.lastRoll = null;
        return { state, events: [{ text: `${me} has stopped attacking and may move armies once.` }] };
      }
      if (action.type !== "attack") return { error: "Attack a neighbouring territory, or press “Stop attacking”." };
      const { from, to } = action;
      if (!T[from] || !T[to]) return { error: "Choose territories on the map." };
      if (state.owner[from] !== seat) return { error: `${T[from].name} isn't yours.` };
      if (state.owner[to] === seat) return { error: `${T[to].name} is already yours.` };
      if (!ADJ[from].includes(to)) return { error: `${T[from].name} and ${T[to].name} aren't next to each other.` };
      if (state.armies[from] < 2) return { error: `You need at least 2 armies on ${T[from].name} to attack from it (one must stay behind).` };
      const defender = state.owner[to];
      const aDice = Math.min(3, state.armies[from] - 1);
      const dDice = Math.min(2, state.armies[to]);
      const roll = (n) => Array.from({ length: n }, () => rng.rollDie(state.rng)).sort((x, y) => y - x);
      const a = roll(aDice);
      const d = roll(dDice);
      let aLoss = 0;
      let dLoss = 0;
      for (let i = 0; i < Math.min(a.length, d.length); i++) {
        if (a[i] > d[i]) dLoss++;
        else aLoss++; // ties go to the defender
      }
      state.armies[from] -= aLoss;
      state.armies[to] -= dLoss;
      state.lastRoll = { from, to, attacker: a, defender: d, aLoss, dLoss };
      events.push({ text: `${me} attacked ${T[to].name} (${who(state, defender)}) from ${T[from].name}.` });
      events.push({ text: `Dice: ${me} ${a.join(", ")}; ${who(state, defender)} ${d.join(", ")}. ${me} lost ${aLoss}, ${who(state, defender)} lost ${dLoss}.` });
      if (state.armies[to] === 0) {
        const move = Math.min(aDice, state.armies[from] - 1);
        state.owner[to] = seat;
        state.armies[to] = move;
        state.armies[from] -= move;
        events.push({ text: `${me} captured ${T[to].name} and moved ${move} ${move === 1 ? "army" : "armies"} in.` });
        if (checkWin(state, seat, events)) return { state, events };
      }
      return { state, events };
    }

    // fortify
    if (action.type === "endTurn") {
      events.push({ text: `${me} ended their turn.` });
      endTurn(state, seat, events);
      return { state, events };
    }
    if (action.type !== "fortify") return { error: "Move armies between two of your neighbouring territories, or end your turn." };
    const { from, to } = action;
    const count = Number(action.count);
    if (!T[from] || !T[to] || state.owner[from] !== seat || state.owner[to] !== seat) return { error: "You can only move armies between your own territories." };
    if (!ADJ[from].includes(to)) return { error: `${T[from].name} and ${T[to].name} aren't next to each other.` };
    if (!Number.isInteger(count) || count < 1 || count > state.armies[from] - 1) return { error: `You can move between 1 and ${state.armies[from] - 1} armies (one must stay behind).` };
    state.armies[from] -= count;
    state.armies[to] += count;
    events.push({ text: `${me} moved ${count} ${count === 1 ? "army" : "armies"} from ${T[from].name} to ${T[to].name}.` });
    endTurn(state, seat, events);
    return { state, events };
  },

  getPlayerView(state) {
    return {
      phase: state.phase,
      turn: state.turn,
      step: state.step,
      prompt: { reinforce: `place ${state.toPlace} new ${state.toPlace === 1 ? "army" : "armies"} on your territories.`, attack: "attack a neighbour, or stop attacking.", fortify: "move armies once, or end your turn." }[state.step],
      toPlace: state.toPlace,
      round: state.round,
      maxRounds: state.maxRounds,
      owner: state.owner,
      armies: state.armies,
      lastRoll: state.lastRoll,
      islands: ISLANDS,
      territories: TERRITORIES,
      links: LINKS.map(([a, b]) => ({ a, b, sea: SEA.has(`${a}|${b}`) })),
      reinforcements: [0, 1].map((s) => reinforcements(state, s)),
      winReason: state.winReason,
    };
  },

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const count = (s) => owned(state, s).length;
    return {
      scores: { 0: count(0), 1: count(1) },
      winner: state.winner,
      unit: "territories",
      summary: state.winReason,
    };
  },

  ...jsonState,
};

engine.reinforcements = reinforcements;
module.exports = engine;
