"use strict";
// Go Fish, two players. Rules: docs/rules/gofish.md (ported from the Dobble
// app's GO_FISH_RULES.md, minus the CPU opponent).
const rng = require("../../engine/rng");
const { standardDeck, rankName, cardName, RANKS } = require("../../engine/cards");
const { jsonState } = require("../../engine/contract");

const HAND_SIZE = 7;
const CLOSING_POND_COUNT = 5;
const clone = jsonState.restore;
const other = (seat) => 1 - seat;
const sortHand = (hand) => hand.sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank) || a.suit.localeCompare(b.suit));

// Removes any complete books from a hand. Returns the completed ranks.
function takeBooks(state, seat) {
  const counts = {};
  for (const c of state.hands[seat]) counts[c.rank] = (counts[c.rank] || 0) + 1;
  const done = Object.keys(counts).filter((r) => counts[r] === 4).sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b));
  if (done.length) {
    state.hands[seat] = state.hands[seat].filter((c) => !done.includes(c.rank));
    state.books[seat].push(...done);
  }
  return done;
}

const totalBooks = (state) => state.books[0].length + state.books[1].length;

function bookEvents(state, seat, ranks, events) {
  for (const r of ranks) {
    events.push({ text: `${state.names[seat]} completed a book of ${rankName(r, 4)}.` });
    state.lastBookOwner = seat;
  }
}

// Moves play to `seat`, handling phase entry, empty hands and the game end.
// `phaseAtStart` is the phase the move began in; thresholds crossed during a
// move only take effect once it has finished (as the rules require).
function beginTurn(state, seat, events) {
  if (totalBooks(state) === 13) return endGame(state);

  if (state.pond.length === 0 && state.phase !== "final") {
    state.phase = "final";
    state.finalOrder = [seat, other(seat)];
    events.push({ text: "Final Round: no more fishing. One last ask each." });
  } else if (state.phase === "normal" && state.pond.length <= CLOSING_POND_COUNT) {
    state.phase = "closing";
    events.push({ text: "The pond is closing: one ask each turn from now on." });
  }

  if (state.phase === "final") {
    while (state.finalOrder.length) {
      const next = state.finalOrder[0];
      if (state.hands[next].length) {
        state.turn = next;
        return;
      }
      events.push({ text: `${state.names[next]} has no cards left, so their final turn is skipped.` });
      state.finalOrder.shift();
    }
    return endGame(state);
  }

  state.turn = seat;
  if (state.hands[seat].length === 0) {
    // An empty-handed player draws one replacement card and carries on.
    const card = state.pond.shift();
    state.hands[seat].push(card);
    sortHand(state.hands[seat]);
    events.push({ text: `${state.names[seat]} had no cards, so took one from the pond.` });
    events.push({ text: `You took the ${cardName(card)}.`, forSeat: seat });
    if (state.pond.length === 0) {
      // That was the last pond card: the Final Round starts with this player.
      state.phase = "final";
      state.finalOrder = [seat, other(seat)];
      events.push({ text: "Final Round: no more fishing. One last ask each." });
    } else if (state.phase === "normal" && state.pond.length <= CLOSING_POND_COUNT) {
      state.phase = "closing";
      events.push({ text: "The pond is closing: one ask each turn from now on." });
    }
  }
}

function endGame(state) {
  state.phase = "over";
  state.turn = null;
}

const engine = {
  id: "gofish",
  title: "Go Fish",
  blurb: "Ask for cards to make sets of four. Most sets wins.",
  defaultSettings: {},
  settingsOptions: {},
  normaliseSettings: () => ({}),

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    const deck = rng.shuffle(r, standardDeck());
    const state = {
      names: players.map((p) => p.name),
      hands: [sortHand(deck.slice(0, HAND_SIZE)), sortHand(deck.slice(HAND_SIZE, HAND_SIZE * 2))],
      pond: deck.slice(HAND_SIZE * 2),
      books: [[], []],
      phase: "normal",
      turn: rng.int(r, 2),
      finalOrder: [],
      lastBookOwner: null, // only in-play books count for the tiebreak
      lastAsk: null,
    };
    takeBooks(state, 0);
    takeBooks(state, 1);
    beginTurn(state, state.turn, []);
    return state;
  },

  legalActions(state, seat) {
    if (state.phase === "over" || state.turn !== seat) return [];
    const opp = state.names[other(seat)];
    return [...new Set(state.hands[seat].map((c) => c.rank))].map((rank) => ({
      type: "ask", rank, label: `Ask ${opp} for ${rankName(rank, 2)}`,
    }));
  },

  applyAction(prev, seat, action) {
    if (prev.phase === "over") return { error: "The game is over." };
    if (prev.turn !== seat) return { error: `It's ${prev.names[prev.turn]}'s turn.` };
    if (action.type !== "ask") return { error: "On your turn, ask for a rank you hold." };
    if (!RANKS.includes(action.rank)) return { error: "That isn't a card rank." };
    if (!prev.hands[seat].some((c) => c.rank === action.rank)) {
      return { error: `You can only ask for a rank you're holding, and you have no ${rankName(action.rank, 2)}.` };
    }

    const state = clone(prev);
    const opp = other(seat);
    const rank = action.rank;
    const me = state.names[seat];
    const them = state.names[opp];
    const phase = state.phase;
    const events = [{ text: `${me} asked ${them} for ${rankName(rank, 2)}.` }];
    let keepTurn = false;

    const given = state.hands[opp].filter((c) => c.rank === rank);
    if (given.length) {
      state.hands[opp] = state.hands[opp].filter((c) => c.rank !== rank);
      state.hands[seat].push(...given);
      sortHand(state.hands[seat]);
      events.push({ text: `${them} handed over ${given.length === 1 ? "one" : given.length} ${rankName(rank, given.length)}.` });
      bookEvents(state, seat, takeBooks(state, seat), events);
      keepTurn = phase === "normal";
      state.lastAsk = { seat, rank, result: "given", count: given.length };
    } else if (phase === "final" || state.pond.length === 0) {
      events.push({ text: `${them} had none. There's no pond left, so nothing is drawn.` });
      state.lastAsk = { seat, rank, result: "none" };
    } else {
      const card = state.pond.shift();
      state.hands[seat].push(card);
      sortHand(state.hands[seat]);
      const lucky = card.rank === rank;
      if (lucky) {
        events.push({ text: `Go fish! ${me} drew the ${rankName(rank)} they asked for: a Lucky Catch.` });
      } else {
        events.push({ text: `Go fish! ${me} took a card from the pond.` });
        events.push({ text: `You drew the ${cardName(card)}.`, forSeat: seat });
      }
      bookEvents(state, seat, takeBooks(state, seat), events);
      keepTurn = lucky && phase === "normal";
      state.lastAsk = { seat, rank, result: lucky ? "lucky" : "fished" };
    }

    if (phase === "final") {
      state.finalOrder.shift();
      beginTurn(state, state.finalOrder[0] ?? opp, events);
    } else {
      if (!keepTurn) events.push({ text: `Now it's ${them}'s turn.` });
      beginTurn(state, keepTurn ? seat : opp, events);
    }
    return { state, events };
  },

  getPlayerView(state, seat) {
    const opp = other(seat);
    const over = state.phase === "over";
    const prompts = {
      normal: `ask ${state.names[opp]} for a rank you hold.`,
      closing: `you get one ask this turn.`,
      final: `this is your last ask.`,
    };
    return {
      phase: state.phase,
      turn: state.turn,
      prompt: prompts[state.phase],
      yourHand: state.hands[seat],
      opponentCardCount: state.hands[opp].length,
      opponentHand: over ? state.hands[opp] : undefined,
      pondCount: state.pond.length,
      books: state.books,
      lastAsk: state.lastAsk,
    };
  },

  // Test hook: ids that must never appear in what `seat` is sent.
  hiddenFrom(state, seat) {
    if (state.phase === "over") return state.pond.map((c) => c.id);
    return [...state.hands[other(seat)], ...state.pond].map((c) => c.id);
  },

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const scores = { 0: state.books[0].length, 1: state.books[1].length };
    let winner = null;
    let reason = "";
    if (scores[0] !== scores[1]) {
      winner = scores[0] > scores[1] ? 0 : 1;
      reason = `${scores[winner]} books to ${scores[other(winner)]}`;
    } else if (state.hands[0].length !== state.hands[1].length) {
      winner = state.hands[0].length > state.hands[1].length ? 0 : 1;
      reason = `books were tied, and ${state.names[winner]} had more cards left in hand`;
    } else if (state.lastBookOwner !== null) {
      winner = state.lastBookOwner;
      reason = `books and cards were tied, and ${state.names[winner]} made the most recent book`;
    }
    const summary = winner === null
      ? `It's a draw: ${scores[0]} books each.`
      : `${state.names[winner]} wins: ${reason}.`;
    return { scores, winner, summary, unit: "books" };
  },

  ...jsonState,
};

module.exports = engine;
