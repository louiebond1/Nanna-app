"use strict";
// Canasta, two players. Rules: docs/rules/canasta.md
const rng = require("../../engine/rng");
const { jsonState } = require("../../engine/contract");

const HAND = 15;
const RANKS = ["4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]; // ranks you can meld normally
const RANK_ORDER = ["JK", "2", "3", ...RANKS];
const NAMES = { 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", J: "Jack", Q: "Queen", K: "King", A: "Ace", 2: "Two", JK: "Joker" };
const PLURAL = { 3: "Threes", 6: "Sixes", JK: "Jokers" };
const SUITS = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
const clone = jsonState.restore;
const other = (seat) => 1 - seat;

const isWild = (c) => c.rank === "2" || c.rank === "JK";
const isRed3 = (c) => c.rank === "3" && (c.suit === "H" || c.suit === "D");
const isBlack3 = (c) => c.rank === "3" && (c.suit === "S" || c.suit === "C");
const points = (c) => (c.rank === "JK" ? 50 : c.rank === "2" || c.rank === "A" ? 20 : ["K", "Q", "J", "10", "9", "8"].includes(c.rank) ? 10 : 5);
const sum = (cards) => cards.reduce((t, c) => t + points(c), 0);
const plural = (r) => PLURAL[r] || `${NAMES[r]}s`;
const cardName = (c) => (c.rank === "JK" ? "Joker" : `${NAMES[c.rank]} of ${SUITS[c.suit]}`);
const sortHand = (h) => h.sort((a, b) => RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank) || (a.suit || "").localeCompare(b.suit || ""));

function newDeck() {
  const deck = [];
  for (const d of [1, 2]) {
    for (const s of Object.keys(SUITS)) for (const r of ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]) deck.push({ id: `${r}${s}${d}`, rank: r, suit: s });
    deck.push({ id: `JK${d}a`, rank: "JK", suit: null }, { id: `JK${d}b`, rank: "JK", suit: null });
  }
  return deck; // 108
}

const minimumFor = (total) => (total < 0 ? 15 : total < 1500 ? 50 : total < 3000 ? 90 : 120);
const isCanasta = (m) => m.cards.length >= 7;
const isNatural = (m) => m.cards.every((c) => !isWild(c));
const canastaCount = (state, seat) => state.melds[seat].filter(isCanasta).length;

// Checks a set of cards as a meld of one rank. Returns { rank } or { error }.
function checkGroup(cards, { allowBlack3 = false } = {}) {
  const naturals = cards.filter((c) => !isWild(c));
  const wilds = cards.length - naturals.length;
  if (!naturals.length) return { error: "A meld needs at least two natural (non-wild) cards." };
  const rank = naturals[0].rank;
  if (naturals.some((c) => c.rank !== rank)) return { error: "All the natural cards in a meld must be the same rank." };
  if (rank === "3") {
    if (!allowBlack3) return { error: "Black Threes can only be melded when you're going out." };
    if (wilds) return { error: "A meld of black Threes can't include wild cards." };
  }
  if (naturals.length < 2) return { error: "A meld needs at least two natural (non-wild) cards." };
  if (wilds > 3) return { error: "A meld can't have more than three wild cards." };
  return { rank };
}

// Draws one card for seat, laying out red Threes and replacing them.
function drawOne(state, seat, events) {
  for (;;) {
    const c = state.stock.shift();
    if (!c) return null;
    if (isRed3(c)) {
      state.red3s[seat].push(c);
      events.push({ text: `${state.names[seat]} drew a red Three (${cardName(c)}) and laid it down for a bonus.` });
      continue;
    }
    state.hands[seat].push(c);
    return c;
  }
}

function deal(state) {
  const deck = rng.shuffle(state.rng, newDeck());
  state.stock = deck;
  state.hands = [[], []];
  state.red3s = [[], []];
  state.melds = [[], []];
  const events = [];
  for (const seat of [0, 1]) for (let i = 0; i < HAND; i++) drawOne(state, seat, events);
  // The starting discard is the first natural card that isn't a Three;
  // anything skipped goes to the bottom of the stock (a simplification).
  let i = state.stock.findIndex((c) => !isWild(c) && c.rank !== "3");
  const [top] = state.stock.splice(i, 1);
  state.pile = [top];
  state.frozenByWild = false;
  state.turn = state.firstPlayer;
  state.step = "draw";
  state.phase = "playing";
  state.handResult = null;
  for (const seat of [0, 1]) sortHand(state.hands[seat]);
  return events;
}

function scoreHand(state, wentOut) {
  return [0, 1].map((seat) => {
    const meldCards = state.melds[seat].reduce((t, m) => t + sum(m.cards), 0);
    const canastas = state.melds[seat].reduce((t, m) => t + (isCanasta(m) ? (isNatural(m) ? 500 : 300) : 0), 0);
    const r3 = state.red3s[seat].length === 4 ? 800 : state.red3s[seat].length * 100;
    const red3 = state.melds[seat].length ? r3 : -r3;
    const out = wentOut === seat ? 100 : 0;
    const inHand = sum(state.hands[seat]);
    return { meldCards, canastas, red3, out, inHand, total: meldCards + canastas + red3 + out - inHand };
  });
}

function endHand(state, wentOut, events) {
  const parts = scoreHand(state, wentOut);
  parts.forEach((p, seat) => { state.totals[seat] += p.total; });
  state.handResult = { wentOut, parts };
  for (const seat of [0, 1]) {
    const p = parts[seat];
    events.push({ text: `${state.names[seat]}: melds ${p.meldCards} + canastas ${p.canastas} + red Threes ${p.red3}${p.out ? " + going out 100" : ""} − cards in hand ${p.inHand} = ${p.total}.` });
  }
  if (state.target === 1 || Math.max(...state.totals) >= state.target) {
    state.phase = "over";
    state.turn = null;
    state.winner = state.totals[0] === state.totals[1] ? null : state.totals[0] > state.totals[1] ? 0 : 1;
    events.push({ text: `Final totals: ${state.names[0]} ${state.totals[0]}, ${state.names[1]} ${state.totals[1]}.` });
  } else {
    state.phase = "handOver";
    state.turn = null;
    events.push({ text: `Totals: ${state.names[0]} ${state.totals[0]}, ${state.names[1]} ${state.totals[1]}. Press “Next hand” to carry on.` });
  }
}

// Takes cards out of a hand by id; returns them or null if any is missing.
function takeFromHand(state, seat, ids) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) return null;
  const cards = ids.map((id) => state.hands[seat].find((c) => c.id === id));
  if (cards.some((c) => !c)) return null;
  state.hands[seat] = state.hands[seat].filter((c) => !ids.includes(c.id));
  return cards;
}

// Lays one or more new melds and additions. Returns an error string or null.
// groups: [{ cardIds, meldRank? }]: meldRank adds to an existing meld.
// incoming: cards about to join the hand (the rest of a taken pile).
function layMelds(state, seat, groups, events, { extraInitialPoints = 0, pileMeld = null, incoming = 0 } = {}) {
  const initial = state.melds[seat].length === 0 && !pileMeld?.existing;
  let laidPoints = extraInitialPoints;
  const handBefore = state.hands[seat].length;
  for (const g of groups) {
    const cards = takeFromHand(state, seat, g.cardIds);
    if (!cards || !cards.length) return "Choose cards from your hand.";
    const existing = g.meldRank ? state.melds[seat].find((m) => m.rank === g.meldRank) : null;
    if (g.meldRank && !existing) return `You don't have a meld of ${plural(g.meldRank)} yet.`;
    const all = existing ? [...existing.cards, ...cards] : cards;
    const goingOutAfter = state.hands[seat].length <= 1;
    const check = checkGroup(all, { allowBlack3: goingOutAfter });
    if (check.error) return check.error;
    if (!existing && state.melds[seat].some((m) => m.rank === check.rank)) {
      return `You already have a meld of ${plural(check.rank)}. Add to it instead.`;
    }
    if (existing) {
      existing.cards = all;
      events.push({ text: `${state.names[seat]} added ${cards.map(cardName).join(", ")} to their ${plural(existing.rank)}.` });
    } else {
      state.melds[seat].push({ rank: check.rank, cards: all });
      laidPoints += sum(cards);
      events.push({ text: `${state.names[seat]} melded ${cards.length} ${plural(check.rank)}${cards.some(isWild) ? " (with wild cards)" : ""}.` });
    }
  }
  if (initial) {
    const need = minimumFor(state.totals[seat]);
    if (laidPoints < need) return `Your first meld must be worth at least ${need} points. These cards are worth ${laidPoints}.`;
  }
  const left = state.hands[seat].length + incoming;
  const canGoOut = canastaCount(state, seat) >= 2;
  if (left < 2 && !canGoOut && handBefore + incoming > left) {
    return "You need two canastas before you can go out, so you must keep at least two cards in your hand.";
  }
  return null;
}

const engine = {
  id: "canasta",
  title: "Canasta",
  blurb: "Make melds of the same rank and build canastas of seven. The app adds up all the points.",
  defaultSettings: { target: 5000 },
  testSettings: { target: 1 }, // automated playthroughs: one hand
  settingsOptions: {
    target: {
      label: "Play to",
      choices: [{ value: 5000, label: "5000 points (standard, several hands)" }, { value: 2500, label: "2500 points (shorter)" }, { value: 1, label: "One hand only" }],
    },
  },

  normaliseSettings(s) {
    const target = Number(s.target);
    if (![5000, 2500, 1].includes(target)) return { error: "Choose how long to play." };
    return { target };
  },

  createGame(settings, players, seed) {
    const r = rng.create(seed);
    const state = {
      names: players.map((p) => p.name), target: settings.target, totals: [0, 0], handNumber: 1,
      firstPlayer: rng.int(r, 2), rng: r, winner: null,
    };
    deal(state);
    return state;
  },

  minimumFor,

  // Candidate moves, filtered through applyAction so nothing offered is refused.
  legalActions(state, seat) {
    return engine.candidateActions(state, seat).filter((a) => {
      if (a.input) return true;
      const { label, ...move } = a;
      return !engine.applyAction(state, seat, move).error;
    });
  },

  candidateActions(state, seat) {
    if (state.phase === "handOver") return [{ type: "nextHand", label: "Next hand" }];
    if (state.phase !== "playing" || state.turn !== seat) return [];
    const hand = state.hands[seat];
    const out = [{ type: "custom", label: "Choose cards", input: true }];
    if (state.step === "draw") {
      const top = state.pile[state.pile.length - 1];
      const naturals = hand.filter((c) => c.rank === top.rank);
      const hasMeld = state.melds[seat].some((m) => m.rank === top.rank);
      if (top && !isWild(top) && top.rank !== "3") {
        if (naturals.length >= 2 && (state.melds[seat].length || sum([top, ...naturals.slice(0, 2)]) >= minimumFor(state.totals[seat]))) {
          out.push({ type: "takePile", useIds: naturals.slice(0, 2).map((c) => c.id), label: `Take the pile, melding the ${cardName(top)} with two of yours` });
        } else if (hasMeld && !state.frozenByWild) {
          out.push({ type: "takePile", useIds: [], label: `Take the pile, adding the ${cardName(top)} to your ${plural(top.rank)}` });
        }
      }
      out.push({ type: "drawStock", label: "Draw two cards from the stock" });
      return out;
    }
    const canGoOut = canastaCount(state, seat) >= 2;
    for (const m of state.melds[seat]) {
      const same = hand.filter((c) => c.rank === m.rank);
      if (same.length && (hand.length - same.length >= 2 || canGoOut)) {
        out.push({ type: "meld", groups: [{ cardIds: same.map((c) => c.id), meldRank: m.rank }], label: `Add your ${plural(m.rank)} to your meld` });
      }
    }
    const byRank = {};
    for (const c of hand) if (RANKS.includes(c.rank)) (byRank[c.rank] ||= []).push(c);
    for (const [rank, cs] of Object.entries(byRank)) {
      if (cs.length < 3 || state.melds[seat].some((m) => m.rank === rank)) continue;
      if (!state.melds[seat].length && sum(cs) < minimumFor(state.totals[seat])) continue;
      if (hand.length - cs.length < 2 && !canGoOut) continue;
      out.push({ type: "meld", groups: [{ cardIds: cs.map((c) => c.id) }], label: `Meld your ${cs.length} ${plural(rank)}` });
    }
    // First meld: if no single rank reaches the minimum, offer all ready ranks together.
    if (!state.melds[seat].length) {
      const ready = Object.entries(byRank).filter(([, cs]) => cs.length >= 3);
      const all = ready.flatMap(([, cs]) => cs);
      if (ready.length > 1 && sum(all) >= minimumFor(state.totals[seat]) && (hand.length - all.length >= 2 || canGoOut)) {
        out.push({
          type: "meld",
          groups: ready.map(([, cs]) => ({ cardIds: cs.map((c) => c.id) })),
          label: `Meld your ${ready.map(([r]) => plural(r)).join(" and ")} together (${sum(all)} points)`,
        });
      }
    }
    const wild = hand.find(isWild);
    if (wild && hand.length >= 3) {
      for (const m of state.melds[seat]) {
        if (m.cards.filter(isWild).length < 3 && m.cards.filter((c) => !isWild(c)).length >= 2 && m.rank !== "3") {
          out.push({ type: "meld", groups: [{ cardIds: [wild.id], meldRank: m.rank }], label: `Add a ${cardName(wild)} to your ${plural(m.rank)}` });
        }
      }
    }
    for (const c of hand) {
      if (hand.length === 1 && !canGoOut) continue;
      out.push({ type: "discard", cardId: c.id, label: hand.length === 1 ? `Discard the ${cardName(c)} and go out` : `Discard the ${cardName(c)}` });
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
      events.push(...deal(state));
      events.push({ text: `Hand ${state.handNumber}: new cards dealt. ${state.names[state.turn]} goes first.` });
      return { state, events };
    }
    if (state.turn !== seat) return { error: `It's ${state.names[state.turn]}'s turn.` };
    const me = state.names[seat];

    if (state.step === "draw") {
      if (action.type === "drawStock") {
        if (state.stock.length < 2) {
          events.push({ text: "The stock has run out, so the hand ends. Nobody gets the going-out bonus." });
          endHand(state, null, events);
          return { state, events };
        }
        const got = [drawOne(state, seat, events), drawOne(state, seat, events)].filter(Boolean);
        sortHand(state.hands[seat]);
        events.push({ text: `${me} drew two cards from the stock.` });
        events.push({ text: `You drew ${got.map(cardName).join(" and ")}.`, forSeat: seat });
        state.step = "play";
        return { state, events };
      }
      if (action.type === "takePile") {
        const top = state.pile[state.pile.length - 1];
        if (!top || isWild(top) || top.rank === "3") return { error: "You can't take the pile when a wild card or a Three is on top." };
        const frozen = state.frozenByWild || state.melds[seat].length === 0;
        const useIds = Array.isArray(action.useIds) ? action.useIds : [];
        const use = useIds.map((id) => state.hands[seat].find((c) => c.id === id));
        if (use.some((c) => !c)) return { error: "Choose cards from your hand." };
        const naturalsUsed = use.filter((c) => c.rank === top.rank);
        if (frozen && naturalsUsed.length < 2) {
          return { error: state.melds[seat].length === 0
            ? `To take the pile before your first meld, you need two ${plural(top.rank)} of your own to go with it.`
            : `The pile is frozen by a wild card, so you need two natural ${plural(top.rank)} of your own to take it.` };
        }
        if (frozen && use.some(isWild)) return { error: "While the pile is frozen you can only use natural cards with the top card." };
        const existing = state.melds[seat].find((m) => m.rank === top.rank);
        if (!use.length && !existing) return { error: `Choose cards to meld with the ${cardName(top)}.` };
        // Put the top card with the chosen cards (or onto the existing meld).
        state.pile.pop();
        state.hands[seat].push(top);
        const groups = [{ cardIds: [top.id, ...useIds], meldRank: existing ? top.rank : undefined }];
        for (const g of Array.isArray(action.melds) ? action.melds : []) groups.push(g);
        const err = layMelds(state, seat, groups, events, { pileMeld: { existing: !!existing }, incoming: state.pile.length });
        if (err) return { error: err };
        const taken = state.pile.length;
        state.hands[seat].push(...state.pile);
        state.pile = [];
        state.frozenByWild = false;
        sortHand(state.hands[seat]);
        events.unshift({ text: `${me} took the discard pile (the ${cardName(top)} and ${taken} more card${taken === 1 ? "" : "s"}).` });
        state.step = "play";
        if (!state.hands[seat].length) { endHand(state, seat, events); }
        return { state, events };
      }
      return { error: "First draw two cards from the stock, or take the discard pile." };
    }

    // play step
    if (action.type === "meld") {
      const groups = Array.isArray(action.groups) ? action.groups : [];
      if (!groups.length) return { error: "Choose cards to meld." };
      const err = layMelds(state, seat, groups, events);
      if (err) return { error: err };
      sortHand(state.hands[seat]);
      for (const m of state.melds[seat]) {
        if (isCanasta(m) && !m.announced) {
          m.announced = true;
          events.push({ text: `${me} completed a ${isNatural(m) ? "natural (red) canasta, worth 500" : "mixed (black) canasta, worth 300"} of ${plural(m.rank)}!` });
        }
      }
      if (!state.hands[seat].length) {
        events.push({ text: `${me} has melded every card and goes out!` });
        endHand(state, seat, events);
      }
      return { state, events };
    }
    if (action.type === "discard") {
      const card = state.hands[seat].find((c) => c.id === action.cardId);
      if (!card) return { error: "That card isn't in your hand." };
      if (state.hands[seat].length === 1 && canastaCount(state, seat) < 2) {
        return { error: "You need two canastas before you can go out." };
      }
      state.hands[seat] = state.hands[seat].filter((c) => c.id !== card.id);
      state.pile.push(card);
      if (isWild(card)) state.frozenByWild = true;
      events.push({ text: `${me} discarded the ${cardName(card)}.${isWild(card) ? " The pile is now frozen." : ""}` });
      if (!state.hands[seat].length) {
        events.push({ text: `${me} goes out!` });
        endHand(state, seat, events);
        return { state, events };
      }
      state.turn = other(seat);
      state.step = "draw";
      events.push({ text: `Now it's ${state.names[state.turn]}'s turn.` });
      return { state, events };
    }
    return { error: "Meld some cards, or discard one to end your turn." };
  },

  getPlayerView(state, seat) {
    const opp = other(seat);
    const top = state.pile[state.pile.length - 1] || null;
    return {
      phase: state.phase,
      step: state.step,
      turn: state.turn,
      prompt: state.phase === "handOver" ? "the hand is over. Press “Next hand” when you're both ready."
        : state.step === "draw" ? "draw two from the stock, or take the discard pile." : "meld cards if you can, then discard one.",
      yourHand: state.hands[seat],
      opponentCardCount: state.hands[opp].length,
      melds: state.melds.map((ms) => ms.map((m) => ({ rank: m.rank, cards: m.cards, canasta: isCanasta(m), natural: isNatural(m), points: sum(m.cards) }))),
      red3s: state.red3s,
      pileTop: top,
      pileCount: state.pile.length,
      frozen: state.frozenByWild,
      stockCount: state.stock.length,
      totals: state.totals,
      target: state.target,
      handNumber: state.handNumber,
      yourMinimum: state.melds[seat].length ? 0 : minimumFor(state.totals[seat]),
      canastas: [canastaCount(state, 0), canastaCount(state, 1)],
      handResult: state.handResult,
      opponentHand: state.phase === "playing" ? undefined : state.hands[opp],
    };
  },

  hiddenFrom(state, seat) {
    const hidden = [...state.stock, ...state.pile.slice(0, -1)];
    if (state.phase === "playing") hidden.push(...state.hands[other(seat)]);
    // Cards that went from the pile into your own hand are yours to see.
    const mine = new Set(state.hands[seat].map((c) => c.id));
    return hidden.map((c) => c.id).filter((id) => !mine.has(id));
  },

  isGameOver: (state) => state.phase === "over",

  score(state) {
    const w = state.winner;
    return {
      scores: { 0: state.totals[0], 1: state.totals[1] },
      winner: w,
      unit: "points",
      summary: w === null ? `A tie on ${state.totals[0]} points.` : `${state.names[w]} wins with ${state.totals[w]} points to ${state.totals[other(w)]}.`,
    };
  },

  ...jsonState,
};

engine.points = points;
engine.checkGroup = checkGroup;
module.exports = engine;
