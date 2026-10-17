"use strict";
// Letter Wheel: a WordStorm-style word puzzle. Rules: docs/rules/wheel.md
const rng = require("../../engine/rng");
const words = require("../../words");
const { jsonState } = require("../../engine/contract");

const SIZE = 7;
const MIN = 4;
const clone = jsonState.restore;
const other = (seat) => 1 - seat;

const counts = (w) => {
  const m = {};
  for (const ch of w) m[ch] = (m[ch] || 0) + 1;
  return m;
};
// Can `word` be spelled from the wheel, using each letter at most once?
function fromWheel(word, letters) {
  const have = counts(letters.join(""));
  for (const [ch, n] of Object.entries(counts(word))) if ((have[ch] || 0) < n) return false;
  return true;
}
const points = (w) => (w.length === SIZE ? 10 : w.length - 3); // 4 letters = 1 ... 6 = 3; all seven = 10

// Picks a 7-letter everyday word, then the centre letter that gives a
// sensible number of everyday answers.
function makePuzzle(r) {
  const sevens = words.commonWords().filter((w) => w.length === SIZE);
  const pool = words.commonWords().filter((w) => w.length >= MIN && w.length <= SIZE);
  for (;;) {
    const source = sevens[rng.int(r, sevens.length)];
    const letters = source.split("");
    const options = [...new Set(letters)].map((centre) => {
      const answers = pool.filter((w) => w.includes(centre) && fromWheel(w, letters));
      return { centre, answers };
    }).filter((o) => o.answers.length >= 12 && o.answers.length <= 60);
    if (!options.length) continue;
    const { centre, answers } = options[rng.int(r, options.length)];
    const outer = rng.shuffle(r, letters.filter((_, i) => i !== letters.indexOf(centre)));
    return { centre, outer, source, answers };
  }
}

const allLetters = (state) => [state.centre, ...state.outer];

const engine = {
  id: "wheel",
  title: "Letter Wheel",
  blurb: "Make as many words as you can from seven letters. Every word must use the middle letter.",
  defaultSettings: {},
  settingsOptions: {},
  normaliseSettings: () => ({}),
  concurrentActions: ["word", "finish"],

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    const { centre, outer, source, answers } = makePuzzle(r);
    // `answers` (everyday words only) stays on the server until the end.
    return { names: players.map((p) => p.name), centre, outer, source, answers, found: [[], []], finished: [false, false], phase: "playing" };
  },

  legalActions(state, seat) {
    if (state.phase !== "playing" || state.finished[seat]) return [];
    return [
      { type: "word", label: "Enter a word", input: true },
      { type: "finish", label: "I've finished" },
    ];
  },

  applyAction(prev, seat, action) {
    if (prev.phase !== "playing") return { error: "The puzzle is over." };
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
    if (action.type !== "word") return { error: "Type a word, or press “I've finished”." };
    const w = words.clean(action.word);
    const W = w.toUpperCase();
    if (w.length < MIN) return { error: `Words need at least ${MIN} letters.` };
    if (w.length > SIZE) return { error: `Words can't be longer than ${SIZE} letters.` };
    if (!w.includes(state.centre)) return { error: `${W} doesn't use the middle letter, ${state.centre.toUpperCase()}.` };
    if (!fromWheel(w, allLetters(state))) return { error: `${W} can't be made from these letters. Each letter can only be used once.` };
    if (state.found[seat].includes(w)) return { error: `You've already got ${W}.` };
    if (!words.isWord(w)) return { error: `${W} isn't in our dictionary. Names and abbreviations don't count.` };
    state.found[seat].push(w);
    const p = points(w);
    // Only the player who found it sees the word; the other sees a count.
    return {
      state,
      events: [
        { text: `${W}: ${p} point${p === 1 ? "" : "s"}${w.length === SIZE ? ". You used every letter!" : "."}`, forSeat: seat },
        { text: `${state.names[seat]} found a word.`, forSeat: other(seat) },
      ],
    };
  },

  getPlayerView(state, seat) {
    const opp = other(seat);
    const over = state.phase === "over";
    const score = (s) => state.found[s].reduce((t, w) => t + points(w), 0);
    const view = {
      phase: state.phase,
      prompt: state.finished[seat] ? "" : "find words using the middle letter. Take your time.",
      centre: state.centre,
      outer: state.outer,
      yourWords: state.found[seat],
      yourScore: score(seat),
      opponentWordCount: state.found[opp].length,
      youFinished: state.finished[seat],
      opponentFinished: state.finished[opp],
    };
    if (over) {
      view.opponentWords = state.found[opp];
      view.opponentScore = score(opp);
      const found = new Set([...state.found[0], ...state.found[1]]);
      view.missed = state.answers.filter((w) => !found.has(w));
      view.longest = state.source;
    }
    return view;
  },

  hiddenFrom(state, seat) {
    if (state.phase === "over") return [];
    const mine = new Set(state.found[seat]);
    const theirs = state.found[other(seat)].filter((w) => !mine.has(w));
    return [...theirs, ...state.answers.filter((w) => !mine.has(w) && !theirs.includes(w))];
  },

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const s = [0, 1].map((seat) => state.found[seat].reduce((t, w) => t + points(w), 0));
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
module.exports = engine;
