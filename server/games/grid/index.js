"use strict";
// Word Grid: a Boggle-style word search. Rules: docs/rules/grid.md
const rng = require("../../engine/rng");
const words = require("../../words");
const { jsonState } = require("../../engine/contract");

const N = 4;
const MIN = 3;
const clone = jsonState.restore;
const other = (seat) => 1 - seat;

// Letter weights (roughly English frequency). Q always appears as "Qu".
const WEIGHTS = {
  e: 12, a: 9, i: 8, o: 8, t: 8, n: 7, s: 7, r: 7, h: 4, l: 5, d: 4, u: 4, c: 3, m: 3,
  g: 3, p: 2, b: 2, f: 2, y: 2, w: 2, k: 1, v: 1, x: 1, j: 1, q: 1, z: 1,
};
const BAG = Object.entries(WEIGHTS).flatMap(([ch, n]) => Array(n).fill(ch));
const VOWELS = new Set(["a", "e", "i", "o", "u"]);

const points = (w) => (w.length <= 4 ? 1 : w.length === 5 ? 2 : w.length === 6 ? 3 : w.length === 7 ? 5 : 11);
const neighbours = (i) => {
  const r = Math.floor(i / N);
  const c = i % N;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && cc >= 0 && rr < N && cc < N) out.push(rr * N + cc);
  }
  return out;
};

// Every dictionary word that can be traced on the grid.
function solve(cells) {
  const trie = words.trie();
  const found = new Set();
  const walk = (i, node, word, used) => {
    for (const ch of cells[i]) {
      node = node[ch];
      if (!node) return;
    }
    word += cells[i];
    if (node.$ && word.length >= MIN) found.add(word);
    used.add(i);
    for (const j of neighbours(i)) if (!used.has(j)) walk(j, node, word, used);
    used.delete(i);
  };
  for (let i = 0; i < cells.length; i++) walk(i, trie, "", new Set());
  return found;
}

// Can `word` be traced on the grid without reusing a square? Returns the path or null.
function trace(cells, word) {
  const go = (i, rest, used) => {
    if (!rest.startsWith(cells[i])) return null;
    const left = rest.slice(cells[i].length);
    const path = [...used, i];
    if (!left) return path;
    for (const j of neighbours(i)) {
      if (used.includes(j) || j === i) continue;
      const p = go(j, left, path);
      if (p) return p;
    }
    return null;
  };
  for (let i = 0; i < cells.length; i++) {
    const p = go(i, word, []);
    if (p) return p;
  }
  return null;
}

function makeGrid(r) {
  for (;;) {
    const cells = Array.from({ length: N * N }, () => {
      const ch = BAG[rng.int(r, BAG.length)];
      return ch === "q" ? "qu" : ch;
    });
    const vowels = cells.filter((c) => VOWELS.has(c[0])).length;
    if (vowels < 4 || vowels > 8) continue;
    const all = solve(cells);
    const common = [...all].filter((w) => words.isCommon(w));
    if (common.length >= 25) return { cells, common: common.sort((a, b) => b.length - a.length || a.localeCompare(b)) };
  }
}

const engine = {
  id: "grid",
  title: "Word Grid",
  blurb: "Find words in a grid of letters by joining neighbouring squares.",
  defaultSettings: { shared: "cancel" },
  settingsOptions: {
    shared: {
      label: "Words you both find",
      choices: [{ value: "cancel", label: "Score nothing (standard rule)" }, { value: "both", label: "Score for both players (gentler)" }],
    },
  },
  concurrentActions: ["word", "finish"],

  normaliseSettings(s) {
    if (!["cancel", "both"].includes(s.shared)) return { error: "Choose how words you both find are scored." };
    return { shared: s.shared };
  },

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    const { cells, common } = makeGrid(r);
    return {
      names: players.map((p) => p.name), shared: settings.shared, cells, common,
      found: [[], []], finished: [false, false], phase: "playing",
    };
  },

  legalActions(state, seat) {
    if (state.phase !== "playing" || state.finished[seat]) return [];
    return [{ type: "word", label: "Enter a word", input: true }, { type: "finish", label: "I've finished" }];
  },

  applyAction(prev, seat, action) {
    if (prev.phase !== "playing") return { error: "The game is over." };
    if (prev.finished[seat]) return { error: "You've already finished. Waiting for the other player." };
    const state = clone(prev);
    if (action.type === "finish") {
      state.finished[seat] = true;
      const events = [{ text: `${state.names[seat]} has finished, with ${state.found[seat].length} word${state.found[seat].length === 1 ? "" : "s"}.` }];
      if (state.finished.every(Boolean)) {
        state.phase = "over";
        events.push({ text: "Both players have finished. Here are the results." });
      }
      return { state, events };
    }
    if (action.type !== "word") return { error: "Find a word, or press “I've finished”." };
    const w = words.clean(action.word);
    const W = w.toUpperCase();
    if (w.length < MIN) return { error: `Words need at least ${MIN} letters.` };
    if (state.found[seat].includes(w)) return { error: `You've already got ${W}.` };
    if (!trace(state.cells, w)) return { error: `${W} can't be made by joining neighbouring squares without using a square twice.` };
    if (!words.isWord(w)) return { error: `${W} isn't in our dictionary. Names and abbreviations don't count.` };
    state.found[seat].push(w);
    const p = points(w);
    return {
      state,
      events: [
        { text: `${W}: ${p} point${p === 1 ? "" : "s"} (unless you both find it${state.shared === "cancel" ? "" : ", in which case you both score"}).`, forSeat: seat },
        { text: `${state.names[seat]} found a word.`, forSeat: other(seat) },
      ],
    };
  },

  results(state) {
    const both = new Set(state.found[0].filter((w) => state.found[1].includes(w)));
    const scoreFor = (seat) => state.found[seat].reduce((t, w) => t + (both.has(w) && state.shared === "cancel" ? 0 : points(w)), 0);
    return { both: [...both], scores: [scoreFor(0), scoreFor(1)] };
  },

  getPlayerView(state, seat) {
    const opp = other(seat);
    const view = {
      phase: state.phase,
      prompt: state.finished[seat] ? "" : "find words by joining neighbouring letters. Take your time.",
      cells: state.cells,
      size: N,
      shared: state.shared,
      yourWords: state.found[seat],
      opponentWordCount: state.found[opp].length,
      youFinished: state.finished[seat],
      opponentFinished: state.finished[opp],
    };
    if (state.phase === "over") {
      const r = engine.results(state);
      view.opponentWords = state.found[opp];
      view.bothFound = r.both;
      view.scores = r.scores;
      const found = new Set([...state.found[0], ...state.found[1]]);
      view.missed = state.common.filter((w) => !found.has(w)).slice(0, 40);
    }
    return view;
  },

  hiddenFrom(state, seat) {
    if (state.phase === "over") return [];
    const mine = new Set(state.found[seat]);
    return [...new Set([...state.found[other(seat)], ...state.common])].filter((w) => !mine.has(w));
  },

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const s = engine.results(state).scores;
    const winner = s[0] === s[1] ? null : s[0] > s[1] ? 0 : 1;
    return {
      scores: { 0: s[0], 1: s[1] },
      winner,
      unit: "points",
      summary: winner === null ? `A tie on ${s[0]} points.` : `${state.names[winner]} scored ${s[winner]} points to ${s[other(winner)]}.`,
    };
  },

  ...jsonState,
};

engine.points = points;
engine.trace = trace;
engine.solve = solve;
module.exports = engine;
