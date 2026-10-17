"use strict";
// Colour Clash: an Uno-style shedding game. Rules: docs/rules/clash.md
const rng = require("../../engine/rng");
const { jsonState } = require("../../engine/contract");

const COLOURS = ["red", "yellow", "green", "blue"];
const COLOUR_NAMES = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue" };
const ACTION_NAMES = { skip: "Skip", reverse: "Reverse", draw2: "Draw Two", wild: "Wild", wild4: "Wild Draw Four" };
const HAND_SIZE = 7;
const clone = jsonState.restore;
const other = (seat) => 1 - seat;

function newDeck() {
  const deck = [];
  for (const colour of COLOURS) {
    deck.push({ id: `${colour}-0`, colour, value: "0" });
    for (const value of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"]) {
      for (const copy of ["a", "b"]) deck.push({ id: `${colour}-${value}-${copy}`, colour, value });
    }
  }
  for (let i = 1; i <= 4; i++) {
    deck.push({ id: `wild-${i}`, colour: null, value: "wild" });
    deck.push({ id: `wild4-${i}`, colour: null, value: "wild4" });
  }
  return deck; // 108 cards
}

const cardName = (c) =>
  c.colour ? `${COLOUR_NAMES[c.colour]} ${ACTION_NAMES[c.value] || c.value}` : ACTION_NAMES[c.value];
const points = (c) => (c.colour === null ? 50 : ACTION_NAMES[c.value] ? 20 : Number(c.value));
const isWild = (c) => c.colour === null;
// Cards available to draw, counting the discard pile (minus its top card) that gets reshuffled.
const canDraw = (state) => state.deck.length + state.discard.length - 1 > 0;

function playable(state, card) {
  const top = state.discard[state.discard.length - 1];
  return isWild(card) || card.colour === state.colour || card.value === top.value;
}

// Draws n cards for seat, reshuffling the discard pile (minus its top card)
// into the deck when it runs out. Returns the cards actually drawn.
function draw(state, seat, n) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (!state.deck.length) {
      const top = state.discard.pop();
      state.deck = rng.shuffle(state.rng, state.discard);
      state.discard = [top];
      state.reshuffles++;
    }
    if (!state.deck.length) break; // every card is in someone's hand
    drawn.push(state.deck.pop());
  }
  state.hands[seat].push(...drawn);
  return drawn;
}

function deal(state) {
  let deck = rng.shuffle(state.rng, newDeck());
  state.hands = [deck.slice(0, HAND_SIZE), deck.slice(HAND_SIZE, HAND_SIZE * 2)];
  deck = deck.slice(HAND_SIZE * 2);
  // The starting card is always a number card, so no effect applies to it.
  let i = deck.findIndex((c) => !isWild(c) && !ACTION_NAMES[c.value]);
  const [first] = deck.splice(i, 1);
  state.deck = deck;
  state.discard = [first];
  state.colour = first.colour;
  state.drawnCardId = null;
  state.turn = state.roundStarter;
}

const engine = {
  id: "clash",
  title: "Colour Clash",
  blurb: "Match the colour or the number to get rid of all your cards first.",
  defaultSettings: { target: 0 },
  settingsOptions: {
    target: {
      label: "How long to play",
      choices: [{ value: 0, label: "One round" }, { value: 200, label: "First to 200 points" }, { value: 500, label: "First to 500 points" }],
    },
  },

  normaliseSettings(s) {
    const target = Number(s.target);
    if (![0, 200, 500].includes(target)) return { error: "Choose one round, 200 points or 500 points." };
    return { target };
  },

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    const state = {
      names: players.map((p) => p.name),
      target: settings.target,
      totals: [0, 0],
      round: 1,
      roundStarter: rng.int(r, 2),
      rng: r,
      reshuffles: 0,
      phase: "playing",
      winner: null,
      lastRound: null,
    };
    deal(state);
    return state;
  },

  legalActions(state, seat) {
    if (state.phase !== "playing" || state.turn !== seat) return [];
    const out = [];
    const cards = state.drawnCardId
      ? state.hands[seat].filter((c) => c.id === state.drawnCardId)
      : state.hands[seat];
    for (const c of cards) {
      if (!playable(state, c)) continue;
      if (isWild(c)) {
        for (const colour of COLOURS) {
          out.push({ type: "play", cardId: c.id, colour, label: `Play ${cardName(c)} and choose ${COLOUR_NAMES[colour]}` });
        }
      } else {
        out.push({ type: "play", cardId: c.id, label: `Play ${cardName(c)}` });
      }
    }
    if (state.drawnCardId) out.push({ type: "pass", label: "Keep the card and end my turn" });
    else if (canDraw(state)) out.push({ type: "draw", label: "Draw a card" });
    else if (!out.length) out.push({ type: "pass", label: "There are no cards left to draw: pass" });
    return out;
  },

  applyAction(prev, seat, action) {
    if (prev.phase !== "playing") return { error: "The game is over." };
    if (prev.turn !== seat) return { error: `It's ${prev.names[prev.turn]}'s turn.` };
    const state = clone(prev);
    const me = state.names[seat];
    const opp = other(seat);
    const them = state.names[opp];
    const events = [];

    if (action.type === "draw") {
      if (state.drawnCardId) return { error: "You've already drawn this turn. Play that card or keep it." };
      const [card] = draw(state, seat, 1);
      if (!card) return { error: "There are no cards left to draw. You'll need to play a card." };
      events.push({ text: `${me} drew a card.` });
      events.push({ text: `You drew ${cardName(card)}.`, forSeat: seat });
      if (playable(state, card)) {
        state.drawnCardId = card.id;
        events.push({ text: "You can play it now, or keep it.", forSeat: seat });
      } else {
        state.turn = opp;
        events.push({ text: `Now it's ${them}'s turn.` });
      }
      return { state, events };
    }

    if (action.type === "pass") {
      const stuck = !canDraw(state) && !state.hands[seat].some((c) => playable(state, c));
      if (!state.drawnCardId && !stuck) return { error: "Draw a card first if you can't play." };
      state.drawnCardId = null;
      state.turn = opp;
      events.push({ text: `${me} kept the card. Now it's ${them}'s turn.` });
      return { state, events };
    }

    if (action.type !== "play") return { error: "Play a card or draw one." };
    const idx = state.hands[seat].findIndex((c) => c.id === action.cardId);
    if (idx === -1) return { error: "That card isn't in your hand." };
    const card = state.hands[seat][idx];
    if (state.drawnCardId && card.id !== state.drawnCardId) {
      return { error: "After drawing, you can only play the card you just drew." };
    }
    if (!playable(state, card)) {
      const top = state.discard[state.discard.length - 1];
      return { error: `${cardName(card)} doesn't match. You need something ${COLOUR_NAMES[state.colour]}, a ${ACTION_NAMES[top.value] || top.value}, or a Wild.` };
    }
    if (isWild(card) && !COLOURS.includes(action.colour)) return { error: "Choose a colour for your Wild card." };

    state.hands[seat].splice(idx, 1);
    state.discard.push(card);
    state.drawnCardId = null;
    state.colour = isWild(card) ? action.colour : card.colour;
    events.push({ text: `${me} played ${cardName(card)}${isWild(card) ? ` and chose ${COLOUR_NAMES[action.colour]}` : ""}.` });

    let again = false;
    if (card.value === "skip" || card.value === "reverse") {
      again = true;
      events.push({ text: `${them} misses a turn, so ${me} goes again.` });
    } else if (card.value === "draw2" || card.value === "wild4") {
      const n = card.value === "draw2" ? 2 : 4;
      const drawn = draw(state, opp, n);
      again = true;
      events.push({ text: `${them} picks up ${drawn.length} and misses a turn, so ${me} goes again.` });
      events.push({ text: `You picked up ${drawn.map(cardName).join(", ")}.`, forSeat: opp });
    }

    if (state.hands[seat].length === 1) events.push({ text: `${me} has one card left!` });
    if (state.hands[seat].length === 0) {
      const gained = state.hands[opp].reduce((sum, c) => sum + points(c), 0);
      state.totals[seat] += gained;
      events.push({ text: `${me} has no cards left and wins round ${state.round}, scoring ${gained} points from ${them}'s hand.` });
      state.lastRound = { winner: seat, points: gained, round: state.round };
      if (state.target === 0 || state.totals[seat] >= state.target) {
        state.phase = "over";
        state.winner = seat;
        state.turn = null;
      } else {
        state.round++;
        state.roundStarter = other(state.roundStarter);
        deal(state);
        events.push({ text: `Round ${state.round}: new cards dealt. ${state.names[state.turn]} starts.` });
      }
      return { state, events };
    }

    state.turn = again ? seat : opp;
    if (!again) events.push({ text: `Now it's ${them}'s turn.` });
    return { state, events };
  },

  getPlayerView(state, seat) {
    const top = state.discard[state.discard.length - 1];
    const over = state.phase === "over";
    return {
      phase: state.phase,
      turn: state.turn,
      prompt: state.drawnCardId ? "play the card you drew, or keep it." : "play a matching card, or draw one.",
      yourHand: state.hands[seat],
      opponentCardCount: state.hands[other(seat)].length,
      opponentHand: over ? state.hands[other(seat)] : undefined,
      top,
      colour: state.colour,
      deckCount: state.deck.length,
      drawnCardId: state.turn === seat ? state.drawnCardId : null,
      target: state.target,
      totals: state.totals,
      round: state.round,
      lastRound: state.lastRound,
    };
  },

  hiddenFrom(state, seat) {
    const hidden = [...state.deck];
    if (state.phase !== "over") hidden.push(...state.hands[other(seat)]);
    return hidden.map((c) => c.id);
  },

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const w = state.winner;
    const scores = { 0: state.totals[0], 1: state.totals[1] };
    const summary = state.target
      ? `${state.names[w]} reached ${state.totals[w]} points first.`
      : `${state.names[w]} got rid of all their cards first, scoring ${state.totals[w]} points.`;
    return { scores, winner: w, unit: "points", summary };
  },

  ...jsonState,
};

engine.cardName = cardName;
module.exports = engine;
