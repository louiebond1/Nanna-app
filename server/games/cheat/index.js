"use strict";
// Cheat (also called "I Doubt It"), two players. Rules: docs/rules/cheat.md
const rng = require("../../engine/rng");
const { standardDeck, rankName, cardName, RANKS } = require("../../engine/cards");
const { jsonState } = require("../../engine/contract");

const clone = jsonState.restore;
const other = (seat) => 1 - seat;
const sortHand = (hand) => hand.sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank) || a.suit.localeCompare(b.suit));
const nextRank = (rank) => RANKS[(RANKS.indexOf(rank) + 1) % RANKS.length];
const claimText = (n, rank) => `${n === 1 ? "one" : n} ${rankName(rank, n)}`;

const engine = {
  id: "cheat",
  title: "Cheat",
  blurb: "Put cards down face down and say what they are. Bluff if you must, and catch the other player out.",
  defaultSettings: {},
  settingsOptions: {},
  normaliseSettings: () => ({}),

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    const deck = rng.shuffle(r, standardDeck());
    return {
      names: players.map((p) => p.name),
      hands: [sortHand(deck.slice(0, 26)), sortHand(deck.slice(26))],
      pile: [],
      rank: "A",        // the rank that must be claimed next
      phase: "play",    // play -> respond -> play ... -> over
      turn: rng.int(r, 2),
      claim: null,      // { seat, count, rank, cards } while waiting for a response
      winner: null,
    };
  },

  legalActions(state, seat) {
    if (state.turn !== seat) return [];
    if (state.phase === "respond") {
      const who = state.names[state.claim.seat];
      return [
        { type: "accept", label: `Believe ${who}` },
        { type: "call", label: `Call “Cheat!” on ${who}` },
      ];
    }
    if (state.phase !== "play") return [];
    const out = [{ type: "place", label: "Put down the cards I've chosen", input: true }];
    const honest = state.hands[seat].filter((c) => c.rank === state.rank).slice(0, 4);
    if (honest.length) {
      out.push({ type: "place", cardIds: honest.map((c) => c.id), label: `Put down your ${claimText(honest.length, state.rank)} (honest)` });
    }
    for (const c of state.hands[seat]) {
      if (c.rank !== state.rank) out.push({ type: "place", cardIds: [c.id], label: `Put down the ${cardName(c)} as ${claimText(1, state.rank)}` });
    }
    return out;
  },

  applyAction(prev, seat, action) {
    if (prev.phase === "over") return { error: "The game is over." };
    if (prev.turn !== seat) return { error: `It's ${prev.names[prev.turn]}'s turn.` };
    const state = clone(prev);
    const me = state.names[seat];
    const opp = other(seat);
    const them = state.names[opp];
    const events = [];

    if (state.phase === "play") {
      if (action.type !== "place") return { error: "Choose between 1 and 4 cards to put down." };
      const ids = Array.isArray(action.cardIds) ? action.cardIds : [];
      if (ids.length < 1 || ids.length > 4) return { error: "Choose between 1 and 4 cards to put down." };
      if (new Set(ids).size !== ids.length) return { error: "You chose the same card twice." };
      const cards = ids.map((id) => state.hands[seat].find((c) => c.id === id));
      if (cards.some((c) => !c)) return { error: "One of those cards isn't in your hand." };
      state.hands[seat] = state.hands[seat].filter((c) => !ids.includes(c.id));
      state.pile.push(...cards);
      state.claim = { seat, count: cards.length, rank: state.rank, cards };
      state.phase = "respond";
      state.turn = opp;
      events.push({ text: `${me} put down ${cards.length} card${cards.length === 1 ? "" : "s"} and says: “${claimText(cards.length, state.rank)}”.` });
      events.push({ text: `${them}: believe it, or call “Cheat!”?` });
      return { state, events };
    }

    // respond
    if (action.type !== "call" && action.type !== "accept") return { error: "Choose: believe them, or call “Cheat!”." };
    const { claim } = state;
    const claimer = claim.seat;
    const claimerName = state.names[claimer];
    let claimerWins = false;
    if (action.type === "accept") {
      events.push({ text: `${me} believed ${claimerName}.` });
      claimerWins = state.hands[claimer].length === 0;
    } else {
      const lied = claim.cards.some((c) => c.rank !== claim.rank);
      events.push({ text: `${me} called “Cheat!”. The cards were: ${claim.cards.map(cardName).join(", ")}.` });
      const loser = lied ? claimer : seat;
      events.push({
        text: lied
          ? `${claimerName} was cheating, so picks up the whole pile (${state.pile.length} cards).`
          : `${claimerName} was telling the truth, so ${me} picks up the whole pile (${state.pile.length} cards).`,
      });
      state.hands[loser].push(...state.pile);
      sortHand(state.hands[loser]);
      state.pile = [];
      claimerWins = !lied && state.hands[claimer].length === 0;
    }
    state.claim = null;
    if (claimerWins) {
      state.phase = "over";
      state.turn = null;
      state.winner = claimer;
      events.push({ text: `${claimerName} has no cards left and wins!` });
      return { state, events };
    }
    // Play passes to the player who just responded, with the next rank.
    state.rank = nextRank(state.rank);
    state.phase = "play";
    state.turn = seat;
    events.push({ text: `Now ${me} puts down ${rankName(state.rank, 2)}.` });
    return { state, events };
  },

  getPlayerView(state, seat) {
    const opp = other(seat);
    const responding = state.phase === "respond";
    return {
      phase: state.phase,
      turn: state.turn,
      prompt: responding
        ? `do you believe ${state.names[state.claim.seat]}?`
        : `put down 1 to 4 cards and say they're ${rankName(state.rank, 2)}.`,
      rank: state.rank,
      yourHand: state.hands[seat],
      opponentCardCount: state.hands[opp].length,
      pileCount: state.pile.length,
      claim: state.claim ? { seat: state.claim.seat, count: state.claim.count, rank: state.claim.rank } : null,
      opponentHand: state.phase === "over" ? state.hands[opp] : undefined,
    };
  },

  hiddenFrom(state, seat) {
    const hidden = [...state.pile];
    if (state.phase !== "over") hidden.push(...state.hands[other(seat)]);
    return hidden.filter((c) => !state.hands[seat].includes(c)).map((c) => c.id);
  },

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const w = state.winner;
    const scores = { 0: state.hands[0].length, 1: state.hands[1].length };
    return { scores, winner: w, unit: "cards left", summary: `${state.names[w]} got rid of every card. ${state.names[other(w)]} still had ${scores[other(w)]}.` };
  },

  ...jsonState,
};

module.exports = engine;
