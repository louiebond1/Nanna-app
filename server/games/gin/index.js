"use strict";
// Gin Rummy, two players. Rules: docs/rules/gin.md
const rng = require("../../engine/rng");
const { standardDeck, cardName, RANKS } = require("../../engine/cards");
const { jsonState } = require("../../engine/contract");
const { bestMelds, bestDefence } = require("./melds");

const HAND = 10;
const GIN_BONUS = 25;
const UNDERCUT_BONUS = 25;
const clone = jsonState.restore;
const other = (seat) => 1 - seat;
const sortHand = (hand) => hand.sort((a, b) => a.suit.localeCompare(b.suit) || RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank));
const names = (cards) => cards.map(cardName).join(", ");

function deal(state) {
  const deck = rng.shuffle(state.rng, standardDeck());
  state.hands = [sortHand(deck.slice(0, HAND)), sortHand(deck.slice(HAND, HAND * 2))];
  state.discard = [deck[HAND * 2]];
  state.stock = deck.slice(HAND * 2 + 1);
  state.turn = state.firstPlayer;
  state.step = "draw";
  state.takenFromDiscard = null;
  state.phase = "playing";
}

function endHand(state, knocker, events) {
  const kHand = state.hands[knocker];
  const def = other(knocker);
  const k = bestMelds(kHand);
  const gin = k.points === 0;
  const d = gin ? { ...bestMelds(state.hands[def]), layoffs: [] } : bestDefence(state.hands[def], k.melds);
  let winner;
  let points;
  let kind;
  if (gin) {
    winner = knocker; points = GIN_BONUS + d.points; kind = "gin";
  } else if (k.points < d.points) {
    winner = knocker; points = d.points - k.points; kind = "knock";
  } else {
    winner = def; points = k.points - d.points + UNDERCUT_BONUS; kind = "undercut";
  }
  state.totals[winner] += points;
  const kn = state.names[knocker];
  const dn = state.names[def];
  events.push({ text: gin ? `${kn} went Gin, with no deadwood!` : `${kn} knocked with ${k.points} deadwood.` });
  events.push({ text: `${kn}'s melds: ${k.melds.map(names).join(" | ") || "none"}.${k.deadwood.length ? ` Deadwood: ${names(k.deadwood)}.` : ""}` });
  events.push({ text: `${dn}'s melds: ${d.melds.map(names).join(" | ") || "none"}.${d.layoffs.length ? ` Laid off: ${names(d.layoffs)}.` : ""}${d.deadwood.length ? ` Deadwood: ${names(d.deadwood)} (${d.points}).` : " No deadwood."}` });
  events.push({
    text: kind === "gin"
      ? `${kn} scores ${GIN_BONUS} for Gin plus ${d.points} from ${dn}'s deadwood: ${points} points.`
      : kind === "knock"
        ? `${kn} scores the difference: ${d.points} − ${k.points} = ${points} points.`
        : `Undercut! ${dn} had as little deadwood or less, so ${dn} scores ${k.points} − ${d.points} + ${UNDERCUT_BONUS} bonus = ${points} points.`,
  });
  state.lastHand = {
    knocker, kind, winner, points,
    knockerMelds: k.melds, knockerDeadwood: k.deadwood, knockerPoints: k.points,
    defenderMelds: d.melds, layoffs: d.layoffs, defenderDeadwood: d.deadwood, defenderPoints: d.points,
  };
  finishHand(state, events);
}

function finishHand(state, events) {
  if (Math.max(...state.totals) >= state.target) {
    state.phase = "over";
    state.turn = null;
    state.winner = state.totals[0] >= state.target ? 0 : 1;
    events.push({ text: `${state.names[state.winner]} reaches ${state.totals[state.winner]} points and wins the game.` });
  } else {
    state.phase = "handOver";
    state.turn = null;
    events.push({ text: `Totals: ${state.names[0]} ${state.totals[0]}, ${state.names[1]} ${state.totals[1]}. Press “Next hand” to carry on.` });
  }
}

const engine = {
  id: "gin",
  title: "Gin Rummy",
  blurb: "Collect sets and runs, then knock when your leftover cards add up to 10 or less.",
  defaultSettings: { target: 100 },
  testSettings: { target: 50 }, // automated playthroughs: shorter game
  settingsOptions: {
    target: { label: "Play to", choices: [{ value: 100, label: "100 points (standard)" }, { value: 50, label: "50 points (shorter)" }] },
  },

  normaliseSettings(s) {
    const target = Number(s.target);
    if (![50, 100].includes(target)) return { error: "Play to 50 or 100 points." };
    return { target };
  },

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    const state = {
      names: players.map((p) => p.name),
      target: settings.target,
      totals: [0, 0],
      handNumber: 1,
      firstPlayer: rng.int(r, 2),
      rng: r,
      lastHand: null,
      winner: null,
    };
    deal(state);
    return state;
  },

  legalActions(state, seat) {
    if (state.phase === "handOver") return [{ type: "nextHand", label: "Next hand" }];
    if (state.phase !== "playing" || state.turn !== seat) return [];
    if (state.step === "draw") {
      const top = state.discard[state.discard.length - 1];
      const out = [{ type: "drawStock", label: "Take the top card from the stock pile (face down)" }];
      if (top) out.unshift({ type: "drawDiscard", label: `Take the ${cardName(top)} from the discard pile` });
      return out;
    }
    const out = [];
    const hand = state.hands[seat];
    for (const c of hand) {
      if (c.id === state.takenFromDiscard) continue;
      const rest = hand.filter((x) => x.id !== c.id);
      const pts = bestMelds(rest).points;
      if (pts === 0) out.push({ type: "knock", cardId: c.id, label: `Discard the ${cardName(c)} and go Gin` });
      else if (pts <= 10) out.push({ type: "knock", cardId: c.id, label: `Discard the ${cardName(c)} and knock (${pts} deadwood)` });
    }
    for (const c of hand) {
      if (c.id !== state.takenFromDiscard) out.push({ type: "discard", cardId: c.id, label: `Discard the ${cardName(c)}` });
    }
    return out;
  },

  applyAction(prev, seat, action) {
    if (prev.phase === "over") return { error: "The game is over." };
    const state = clone(prev);
    const events = [];
    if (state.phase === "handOver") {
      if (action.type !== "nextHand") return { error: "Press “Next hand” to carry on." };
      state.handNumber++;
      state.firstPlayer = other(state.firstPlayer);
      deal(state);
      events.push({ text: `Hand ${state.handNumber}: new cards dealt. ${state.names[state.turn]} goes first.` });
      return { state, events };
    }
    if (state.turn !== seat) return { error: `It's ${state.names[state.turn]}'s turn.` };
    const me = state.names[seat];
    const them = state.names[other(seat)];

    if (state.step === "draw") {
      if (action.type === "drawStock") {
        const card = state.stock.shift();
        state.hands[seat].push(card);
        events.push({ text: `${me} took a card from the stock.` });
        events.push({ text: `You took the ${cardName(card)}.`, forSeat: seat });
      } else if (action.type === "drawDiscard") {
        const card = state.discard.pop();
        if (!card) return { error: "The discard pile is empty. Take from the stock." };
        state.hands[seat].push(card);
        state.takenFromDiscard = card.id;
        events.push({ text: `${me} took the ${cardName(card)} from the discard pile.` });
      } else {
        return { error: "First take a card, from the stock or the discard pile." };
      }
      sortHand(state.hands[seat]);
      state.step = "discard";
      return { state, events };
    }

    if (action.type !== "discard" && action.type !== "knock") return { error: "Now discard a card (or knock)." };
    const idx = state.hands[seat].findIndex((c) => c.id === action.cardId);
    if (idx === -1) return { error: "That card isn't in your hand." };
    if (action.cardId === state.takenFromDiscard) return { error: "You can't throw away the card you just picked up from the discard pile." };
    const [card] = state.hands[seat].splice(idx, 1);
    if (action.type === "knock") {
      const pts = bestMelds(state.hands[seat]).points;
      if (pts > 10) return { error: `You can't knock yet: your leftover cards add up to ${pts}. You need 10 or less.` };
    }
    state.discard.push(card);
    state.takenFromDiscard = null;
    events.push({ text: `${me} discarded the ${cardName(card)}.` });
    if (action.type === "knock") {
      endHand(state, seat, events);
      return { state, events };
    }
    if (state.stock.length <= 2) {
      events.push({ text: "Only two cards are left in the stock, so this hand is a draw. Nobody scores." });
      state.lastHand = { kind: "draw" };
      finishHand(state, events);
      return { state, events };
    }
    state.turn = other(seat);
    state.step = "draw";
    events.push({ text: `Now it's ${them}'s turn.` });
    return { state, events };
  },

  getPlayerView(state, seat) {
    const opp = other(seat);
    const mine = bestMelds(state.hands[seat]);
    const reveal = state.phase !== "playing";
    return {
      phase: state.phase,
      step: state.step,
      turn: state.turn,
      prompt: state.phase === "handOver"
        ? "the hand is over. Press “Next hand” when you're both ready."
        : state.step === "draw" ? "take a card from the stock or the discard pile." : "choose a card to discard, or knock.",
      yourHand: state.hands[seat],
      yourMelds: mine.melds,
      yourDeadwood: mine.deadwood,
      yourDeadwoodPoints: mine.points,
      takenFromDiscard: state.turn === seat ? state.takenFromDiscard : null,
      opponentCardCount: state.hands[opp].length,
      opponentHand: reveal ? state.hands[opp] : undefined,
      discardTop: state.discard[state.discard.length - 1] || null,
      stockCount: state.stock.length,
      totals: state.totals,
      target: state.target,
      handNumber: state.handNumber,
      lastHand: state.phase === "playing" ? null : state.lastHand,
    };
  },

  hiddenFrom(state, seat) {
    const hidden = [...state.stock];
    if (state.phase === "playing") hidden.push(...state.hands[other(seat)]);
    return hidden.map((c) => c.id);
  },

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const w = state.winner;
    return {
      scores: { 0: state.totals[0], 1: state.totals[1] },
      winner: w,
      unit: "points",
      summary: `${state.names[w]} reached ${state.totals[w]} points first (target ${state.target}).`,
    };
  },

  ...jsonState,
};

module.exports = engine;
