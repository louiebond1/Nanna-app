"use strict";
// Test-only game for platform tests: each player holds three secret cards and
// plays one per turn. Higher total wins. Not a real game, so it's never registered.
const rng = require("../../server/engine/rng");
const { standardDeck, cardName, RANKS } = require("../../server/engine/cards");
const { jsonState } = require("../../server/engine/contract");

const value = (c) => RANKS.indexOf(c.rank) + 1;

module.exports = {
  id: "highcard",
  title: "High Card (test)",
  defaultSettings: { handSize: 3 },
  normaliseSettings(s) {
    const handSize = Number(s.handSize);
    if (![1, 2, 3].includes(handSize)) return { error: "Hand size must be 1, 2 or 3." };
    return { handSize };
  },
  createGame(settings, players, seed) {
    const r = rng.create(seed);
    const deck = rng.shuffle(r, standardDeck());
    return {
      turn: 0,
      names: players.map((p) => p.name),
      hands: [deck.slice(0, settings.handSize), deck.slice(settings.handSize, settings.handSize * 2)],
      played: [[], []],
    };
  },
  legalActions(state, seat) {
    if (state.turn !== seat || this.isGameOver(state)) return [];
    return state.hands[seat].map((c) => ({ type: "play", cardId: c.id, label: `Play the ${cardName(c)}` }));
  },
  applyAction(state, seat, action) {
    if (this.isGameOver(state)) return { error: "The game is over." };
    if (state.turn !== seat) return { error: `It's ${state.names[state.turn]}'s turn.` };
    if (action.type !== "play") return { error: "You can only play a card." };
    const i = state.hands[seat].findIndex((c) => c.id === action.cardId);
    if (i === -1) return { error: "That card isn't in your hand." };
    const next = jsonState.restore(state);
    const [card] = next.hands[seat].splice(i, 1);
    next.played[seat].push(card);
    next.turn = 1 - seat;
    return { state: next, events: [{ text: `${state.names[seat]} played the ${cardName(card)}.` }] };
  },
  getPlayerView(state, seat) {
    return {
      turn: state.turn,
      yourHand: state.hands[seat],
      opponentCardCount: state.hands[1 - seat].length,
      played: state.played,
    };
  },
  isGameOver: (state) => state.hands.every((h) => h.length === 0),
  score(state) {
    const scores = { 0: 0, 1: 0 };
    state.played.forEach((cards, seat) => cards.forEach((c) => (scores[seat] += value(c))));
    const winner = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
    return { scores, winner, summary: winner === null ? "It's a draw." : `${state.names[winner]} wins.` };
  },
  ...jsonState,
};
