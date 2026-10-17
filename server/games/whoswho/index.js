"use strict";
// Who's Who: a Guess Who-style deduction game. Rules: docs/rules/whoswho.md
const rng = require("../../engine/rng");
const { jsonState } = require("../../engine/contract");
const { CHARACTERS, QUESTIONS } = require("./characters");

const clone = jsonState.restore;
const other = (seat) => 1 - seat;
const byId = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
const qById = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

const engine = {
  id: "whoswho",
  title: "Who's Who",
  blurb: "Ask yes-or-no questions to work out which person the other player has.",
  defaultSettings: { wrongGuess: "lose" },
  settingsOptions: {
    wrongGuess: {
      label: "If someone guesses wrong",
      choices: [{ value: "lose", label: "They lose the game (standard)" }, { value: "turn", label: "They just lose their turn (gentler)" }],
    },
  },
  concurrentActions: ["flip", "flipNonMatching"],

  normaliseSettings(s) {
    if (!["lose", "turn"].includes(s.wrongGuess)) return { error: "Choose what happens after a wrong guess." };
    return { wrongGuess: s.wrongGuess };
  },

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    const order = rng.shuffle(r, CHARACTERS.map((c) => c.id));
    return {
      names: players.map((p) => p.name),
      wrongGuess: settings.wrongGuess,
      secret: [order[0], order[1]],   // secret[seat] is the person that seat is hiding
      down: [[], []],                 // faces each seat has flipped down on their own board
      asked: [],                      // { seat, questionId, answer }
      turn: rng.int(r, 2),
      phase: "playing",
      winner: null,
      wrongGuesses: [[], []],
    };
  },

  legalActions(state, seat) {
    if (state.phase !== "playing") return [];
    const out = [
      { type: "flip", label: "Flip a face up or down", input: true },
    ];
    if (state.turn !== seat) return out;
    const askedByMe = new Set(state.asked.filter((a) => a.seat === seat).map((a) => a.questionId));
    for (const q of QUESTIONS) if (!askedByMe.has(q.id)) out.push({ type: "ask", questionId: q.id, label: `Ask: ${q.text}` });
    for (const c of CHARACTERS) {
      if (!state.down[seat].includes(c.id) && !state.wrongGuesses[seat].includes(c.id)) {
        out.push({ type: "guess", characterId: c.id, label: `Guess it's ${c.name}` });
      }
    }
    return out;
  },

  applyAction(prev, seat, action) {
    if (prev.phase !== "playing") return { error: "The game is over." };
    const state = clone(prev);
    const me = state.names[seat];
    const opp = other(seat);
    const them = state.names[opp];

    if (action.type === "flip") {
      const id = action.characterId;
      if (!byId[id]) return { error: "That person isn't on the board." };
      const down = state.down[seat];
      state.down[seat] = down.includes(id) ? down.filter((x) => x !== id) : [...down, id];
      return { state, events: [] };
    }
    if (action.type === "flipNonMatching") {
      // Flips down everyone who doesn't fit one of your answered questions.
      const a = state.asked.find((x) => x.seat === seat && x.questionId === action.questionId);
      if (!a) return { error: "You haven't asked that question yet." };
      const q = qById[a.questionId];
      const toFlip = CHARACTERS.filter((c) => q.test(c) !== a.answer).map((c) => c.id);
      state.down[seat] = [...new Set([...state.down[seat], ...toFlip])];
      return { state, events: [] };
    }

    if (state.turn !== seat) return { error: `It's ${them}'s turn to ask.` };

    if (action.type === "ask") {
      const q = qById[action.questionId];
      if (!q) return { error: "Choose one of the questions." };
      const answer = !!q.test(byId[state.secret[opp]]);
      state.asked.push({ seat, questionId: q.id, answer });
      state.turn = opp;
      return {
        state,
        events: [
          { text: `${me} asked: “${q.text}”` },
          { text: `${them}'s answer: ${answer ? "Yes" : "No"}.` },
          { text: `Now it's ${them}'s turn.` },
        ],
      };
    }

    if (action.type === "guess") {
      const c = byId[action.characterId];
      if (!c) return { error: "Choose a person to guess." };
      if (state.secret[opp] === c.id) {
        state.phase = "over";
        state.turn = null;
        state.winner = seat;
        return { state, events: [{ text: `${me} guessed ${c.name}, and that's right!` }] };
      }
      state.wrongGuesses[seat].push(c.id);
      if (!state.down[seat].includes(c.id)) state.down[seat].push(c.id);
      if (state.wrongGuess === "lose") {
        state.phase = "over";
        state.turn = null;
        state.winner = opp;
        return { state, events: [{ text: `${me} guessed ${c.name}, but that's wrong. ${them} wins.` }] };
      }
      state.turn = opp;
      return { state, events: [{ text: `${me} guessed ${c.name}, but that's wrong. Now it's ${them}'s turn.` }] };
    }
    return { error: "Ask a question or make a guess." };
  },

  getPlayerView(state, seat) {
    const opp = other(seat);
    const over = state.phase === "over";
    return {
      phase: state.phase,
      turn: state.turn,
      prompt: "ask a question, or guess who they are.",
      characters: CHARACTERS,
      questions: QUESTIONS.map(({ id, text }) => ({ id, text })),
      yourPerson: state.secret[seat],
      theirPerson: over ? state.secret[opp] : null,
      yourDown: state.down[seat],
      theirDownCount: state.down[opp].length,
      asked: state.asked,
      wrongGuesses: state.wrongGuesses,
    };
  },

  // No hiddenFrom: every character id is in the public list, so a string
  // check can't tell; test/games/whoswho.test.js checks the view's fields.

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const w = state.winner;
    const asked = state.asked.filter((a) => a.seat === w).length;
    return {
      scores: { 0: w === 0 ? 1 : 0, 1: w === 1 ? 1 : 0 },
      winner: w,
      unit: "wins",
      summary: `${state.names[w]} found ${state.names[other(w)]}'s person, ${byId[state.secret[other(w)]].name}, after ${asked} question${asked === 1 ? "" : "s"}.`,
    };
  },

  ...jsonState,
};

module.exports = engine;
