"use strict";
// Look & Remember: a BrainBox-style memory game. Rules: docs/rules/memory.md
const rng = require("../../engine/rng");
const { jsonState } = require("../../engine/contract");
const { CARDS } = require("./content");

const clone = jsonState.restore;
const other = (seat) => 1 - seat;
const byId = Object.fromEntries(CARDS.map((c) => [c.id, c]));

const engine = {
  id: "memory",
  title: "Look & Remember",
  blurb: "Explore illustrated country cards, then answer from memory.",
  defaultSettings: { studySeconds: 0, cardsEach: 5 },
  settingsOptions: {
    studySeconds: {
      label: "Time to study each picture",
      choices: [
        { value: 10, label: "10 seconds" }, { value: 20, label: "20 seconds" }, { value: 30, label: "30 seconds" },
        { value: 0, label: "No time limit (practice): press a button when ready" },
      ],
    },
    cardsEach: { label: "Pictures each", choices: [{ value: 3, label: "3 each" }, { value: 5, label: "5 each" }] },
  },
  concurrentActions: ["flag"],

  normaliseSettings(s) {
    const studySeconds = Number(s.studySeconds);
    const cardsEach = Number(s.cardsEach);
    if (![0, 10, 20, 30].includes(studySeconds)) return { error: "Choose a study time." };
    if (![3, 5].includes(cardsEach)) return { error: "Choose 3 or 5 pictures each." };
    return { studySeconds, cardsEach };
  },

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    return {
      names: players.map((p) => p.name),
      studySeconds: settings.studySeconds,
      rounds: settings.cardsEach * 2,
      deck: rng.shuffle(r, CARDS.filter(c => c.country?.art).map((c) => c.id)).slice(0, settings.cardsEach * 2),
      round: 0,
      active: rng.int(r, 2),
      phase: "study",     // study -> question -> reveal -> study ... -> over
      die: null,
      chosen: null,
      points: [0, 0],
      history: [],        // { seat, cardId, die, chosen, correct }
      flagged: [],        // round numbers flagged in this game
      rng: r,
    };
  },

  legalActions(state, seat) {
    if (state.phase === "over") return [];
    if (state.phase === "reveal") {
      const out = [{ type: "next", label: state.round + 1 < state.rounds ? "Next picture" : "See the results" }];
      if (!state.flagged.includes(state.round)) out.push({ type: "flag", label: "Flag this question as unclear" });
      return out;
    }
    if (seat !== state.active) return [];
    if (state.phase === "study") return [{ type: "doneStudying", label: "I'm ready for my question" }];
    const q = byId[state.deck[state.round]].resolved[state.die - 1];
    return q.options.map((option) => ({ type: "answer", option, label: option }));
  },

  applyAction(prev, seat, action) {
    if (prev.phase === "over") return { error: "The game is over." };
    const state = clone(prev);
    const card = byId[state.deck[state.round]];
    const me = state.names[seat];

    if (state.phase === "reveal") {
      if (action.type === "flag") {
        if (state.flagged.includes(state.round)) return { error: "This question has already been flagged." };
        state.flagged.push(state.round);
        return {
          state,
          events: [{ text: `${me} flagged this question as unclear. Thank you, it's been saved for checking.` }],
          reports: [{ kind: "question-flag", game: "memory", cardId: card.id, question: state.die, text: card.resolved[state.die - 1].text, by: me }],
        };
      }
      if (action.type !== "next") return { error: "Press “Next picture” to carry on." };
      state.round++;
      state.die = null;
      state.chosen = null;
      if (state.round >= state.rounds) {
        state.phase = "over";
        return { state, events: [{ text: "That was the last picture." }] };
      }
      state.active = other(state.active);
      state.phase = "study";
      return { state, events: [{ text: `Picture ${state.round + 1} of ${state.rounds}: ${state.names[state.active]}'s turn to study.` }] };
    }

    if (seat !== state.active) return { error: `It's ${state.names[state.active]}'s turn.` };

    if (state.phase === "study") {
      if (action.type !== "doneStudying") return { error: "Study the picture first." };
      state.die = rng.rollDie(state.rng, 6); // only ever 1-6, and every card has exactly 6 questions
      state.phase = "question";
      return { state, events: [{ text: `The picture is hidden. The dice rolled ${state.die}.` }] };
    }

    if (action.type !== "answer") return { error: "Choose one of the answers." };
    const q = card.resolved[state.die - 1];
    if (!q.options.includes(action.option)) return { error: "Choose one of the answers shown." };
    const correct = action.option === q.answer;
    state.chosen = action.option;
    if (correct) state.points[seat]++;
    state.history.push({ seat, cardId: card.id, die: state.die, chosen: action.option, correct });
    state.phase = "reveal";
    return {
      state,
      events: [{ text: correct ? `${me} said “${action.option}”. That's right! One point.` : `${me} said “${action.option}”. The answer was “${q.answer}”.` }],
    };
  },

  getPlayerView(state, seat) {
    if (state.phase === "over") {
      return { phase: "over", points: state.points, history: state.history };
    }
    const card = byId[state.deck[state.round]];
    const q = state.die ? card.resolved[state.die - 1] : null;
    const view = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      active: state.active,
      studySeconds: state.studySeconds,
      points: state.points,
      prompt: { study: "study the picture.", question: "answer from memory.", reveal: "see how you did, then carry on." }[state.phase],
      title: state.phase === 'question' ? null : card.title,
      theme: card.country ? 'countries' : 'scenes',
      // The picture is hidden while the question is being answered.
      card: state.phase === "question" ? null : { sky: card.sky, items: card.items, ...(card.country ? { country: card.country } : {}) },
      die: state.die,
      question: q ? { text: q.text, options: q.options } : null,
      answer: state.phase === "reveal" ? q.answer : null,
      chosen: state.chosen,
      flagged: state.flagged.includes(state.round),
    };
    return view;
  },

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const [a, b] = state.points;
    const winner = a === b ? null : a > b ? 0 : 1;
    return {
      scores: { 0: a, 1: b },
      winner,
      unit: "points",
      summary: winner === null ? `A tie: ${a} each.` : `${state.names[winner]} remembered ${state.points[winner]} to ${state.points[other(winner)]}.`,
    };
  },

  ...jsonState,
};

module.exports = engine;
