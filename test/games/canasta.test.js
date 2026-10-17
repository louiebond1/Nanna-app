"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/canasta");

// "KS1" = King of Spades from deck 1; "JK1a" = a Joker.
const c = (id) => (id.startsWith("JK") ? { id, rank: "JK", suit: null } : { id, rank: id.slice(0, -2), suit: id.slice(-2, -1) });
const cards = (s) => (s ? s.split(" ").map(c) : []);
let n = 0;
const fill = (k) => Array.from({ length: k }, () => c(`4C${(n++ % 9) + 1}`)); // filler cards
function make({ h0, h1 = "5S1 6S1 7S1", pile = "9D1", stock = null, turn = 0, step = "draw", melds = [[], []], totals = [0, 0], frozen = false, target = 5000 }) {
  return {
    names: ["Nanna", "Sam"], target, totals, handNumber: 1, firstPlayer: 0, rng: [1, 2, 3, 4], winner: null,
    hands: [cards(h0), cards(h1)], red3s: [[], []], melds, pile: cards(pile),
    stock: stock === null ? fill(20) : cards(stock), frozenByWild: frozen, turn, step, phase: "playing", handResult: null,
  };
}
const meld = (rank, ids) => ({ rank, cards: cards(ids) });
const act = (s, seat, a) => g.applyAction(s, seat, a);

test("deal: 108 cards, 15 each, red Threes laid out, start card natural and not a Three", () => {
  for (let i = 0; i < 30; i++) {
    const s = g.createGame({ target: 5000 }, [{ name: "A" }, { name: "B" }], `d${i}`);
    assert.equal(s.hands[0].length, 15);
    assert.equal(s.hands[1].length, 15);
    const all = [...s.hands[0], ...s.hands[1], ...s.red3s[0], ...s.red3s[1], ...s.pile, ...s.stock];
    assert.equal(all.length, 108);
    assert.equal(new Set(all.map((x) => x.id)).size, 108);
    assert.ok(![...s.hands[0], ...s.hands[1]].some((x) => x.rank === "3" && (x.suit === "H" || x.suit === "D")));
    assert.ok(s.pile[0].rank !== "3" && s.pile[0].rank !== "2" && s.pile[0].rank !== "JK");
  }
});

test("card values and the first-meld minimum", () => {
  assert.deepEqual(cards("JK1a 2S1 AS1 KS1 8S1 7S1 4S1 3S1").map(g.points), [50, 20, 20, 10, 10, 5, 5, 5]);
  assert.deepEqual([-10, 0, 1495, 1500, 2995, 3000].map(g.minimumFor), [15, 50, 50, 90, 90, 120]);
});

test("meld rules: two naturals minimum, at most three wilds, one rank", () => {
  assert.equal(g.checkGroup(cards("KS1 KH1 2S1")).rank, "K");
  assert.match(g.checkGroup(cards("KS1 2S1 2H1")).error, /two natural/);
  assert.match(g.checkGroup(cards("KS1 KH1 2S1 2H1 JK1a JK1b")).error, /more than three wild/);
  assert.match(g.checkGroup(cards("KS1 KH1 QS1")).error, /same rank/);
  assert.match(g.checkGroup(cards("3S1 3C1 3S2")).error, /going out/);
});

test("drawing takes two cards from the stock; red Threes are laid out and replaced", () => {
  const s = make({ h0: "KS1 QS1", stock: "3H1 5D1 6D1 7D1" });
  const r = act(s, 0, { type: "drawStock" });
  assert.equal(r.state.hands[0].length, 4);
  assert.equal(r.state.red3s[0].length, 1);
  assert.ok(r.events.some((e) => /red Three/.test(e.text)));
  assert.equal(r.state.step, "play");
  assert.ok(r.events.some((e) => e.forSeat === 0 && /^You drew /.test(e.text)));
});

test("first meld must reach the minimum; the screen gets a plain-English reason", () => {
  let s = act(make({ h0: "5S1 5H1 5D1 KS1 QS1" }), 0, { type: "drawStock" }).state;
  const r = act(s, 0, { type: "meld", groups: [{ cardIds: ["5S1", "5H1", "5D1"] }] });
  assert.match(r.error, /first meld must be worth at least 50 points. These cards are worth 15/);
  s = act(make({ h0: "AS1 AH1 AD1 KS1 QS1" }), 0, { type: "drawStock" }).state;
  const ok = act(s, 0, { type: "meld", groups: [{ cardIds: ["AS1", "AH1", "AD1"] }] });
  assert.ok(!ok.error, ok.error);
  assert.equal(ok.state.melds[0][0].rank, "A");
});

test("several melds together can make the first-meld minimum", () => {
  const s = act(make({ h0: "KS1 KH1 KD1 QS1 QH1 QD1 9S1 8S1" }), 0, { type: "drawStock" }).state;
  const r = act(s, 0, { type: "meld", groups: [{ cardIds: ["KS1", "KH1", "KD1"] }, { cardIds: ["QS1", "QH1", "QD1"] }] });
  assert.ok(!r.error, r.error);
  assert.equal(r.state.melds[0].length, 2);
});

test("suggests melding several ranks together when that's what reaches the first-meld minimum", () => {
  const s = make({ h0: "KS1 KH1 KD1 6S1 6H1 6D1 6C1 9S1 8S1", step: "play" });
  const sugg = g.legalActions(s, 0).find((a) => /together/.test(a.label || ""));
  assert.equal(sugg.label, "Meld your Sixes and Kings together (50 points)");
  assert.ok(!act(s, 0, { type: sugg.type, groups: sugg.groups }).error);
});

test("can't start a second meld of the same rank", () => {
  const s = make({ h0: "KS2 KH2 KD2 9S1 8S1", step: "play", melds: [[meld("K", "KS1 KH1 KD1")], []] });
  assert.match(act(s, 0, { type: "meld", groups: [{ cardIds: ["KS2", "KH2", "KD2"] }] }).error, /already have a meld of Kings/);
  assert.ok(!act(s, 0, { type: "meld", groups: [{ cardIds: ["KS2"], meldRank: "K" }] }).error);
});

test("taking the pile before your first meld needs two naturals and enough points", () => {
  const s = make({ h0: "9S1 9H1 KS1 QS1", pile: "4D1 2S1 9D1" });
  assert.match(act(s, 0, { type: "takePile", useIds: ["9S1"] }).error, /two Nines of your own/);
  const r = act(s, 0, { type: "takePile", useIds: ["9S1", "9H1"] });
  assert.match(r.error, /at least 50 points. These cards are worth 30/);
  const r2 = act(s, 0, { type: "takePile", useIds: ["9S1", "9H1"], melds: [{ cardIds: ["KS1"] }] });
  assert.ok(r2.error, "a single King isn't a meld");
});

test("taking the pile: meld the top card, the rest goes to your hand", () => {
  const s = make({ h0: "AS1 AH1 KS1 QS1", pile: "4D1 5D1 AD1" });
  const r = act(s, 0, { type: "takePile", useIds: ["AS1", "AH1"] });
  assert.ok(!r.error, r.error);
  assert.equal(r.state.melds[0][0].cards.length, 3);
  assert.equal(r.state.pile.length, 0);
  assert.ok(r.state.hands[0].some((x) => x.id === "4D1") && r.state.hands[0].some((x) => x.id === "5D1"));
  assert.equal(r.state.step, "play");
});

test("after melding, the top card can go straight onto your meld unless the pile is frozen", () => {
  const base = { h0: "KS1 QS1 JS1", pile: "4D1 9D1", melds: [[meld("9", "9S1 9H1 9C1")], []] };
  assert.ok(!act(make(base), 0, { type: "takePile", useIds: [] }).error);
  assert.match(act(make({ ...base, frozen: true }), 0, { type: "takePile", useIds: [] }).error, /frozen by a wild card/);
});

test("every offered move is accepted by the rules", () => {
  for (let i = 0; i < 20; i++) {
    let s = g.createGame({ target: 1 }, [{ name: "A" }, { name: "B" }], `legal-${i}`);
    for (let step = 0; step < 200 && !g.isGameOver(s); step++) {
      const seat = s.phase === "handOver" ? 0 : s.turn;
      const opts = g.legalActions(s, seat).filter((a) => !a.input);
      for (const { label, ...m } of opts) assert.ok(!g.applyAction(s, seat, m).error, label);
      const { label, ...m } = opts[(i + step) % opts.length];
      s = g.applyAction(s, seat, m).state;
    }
  }
});

test("taking the pile onto a meld with a one-card hand is fine: the pile joins your hand", () => {
  const s = make({ h0: "KS1", pile: "4D1 5D1 9D1", melds: [[meld("9", "9S1 9H1 9C1")], []] });
  const r = act(s, 0, { type: "takePile", useIds: [] });
  assert.ok(!r.error, r.error);
  assert.equal(r.state.hands[0].length, 3);
  // With nothing else in the pile you'd be left with one card and no way to discard it.
  const bare = make({ h0: "KS1", pile: "9D1", melds: [[meld("9", "9S1 9H1 9C1")], []] });
  assert.match(act(bare, 0, { type: "takePile", useIds: [] }).error, /keep at least two cards/);
  assert.ok(!g.legalActions(bare, 0).some((a) => a.type === "takePile"), "and it isn't offered");
});

test("can't take the pile when a wild or a black Three is on top", () => {
  assert.match(act(make({ h0: "KS1 QS1", pile: "9D1 3S1" }), 0, { type: "takePile", useIds: [] }).error, /wild card or a Three/);
  assert.match(act(make({ h0: "KS1 QS1", pile: "9D1 2S1" }), 0, { type: "takePile", useIds: [] }).error, /wild card or a Three/);
});

test("discarding a wild freezes the pile; discarding ends the turn", () => {
  const s = make({ h0: "2S1 KS1 QS1", step: "play", melds: [[meld("9", "9S1 9H1 9C1")], []] });
  const r = act(s, 0, { type: "discard", cardId: "2S1" });
  assert.equal(r.state.frozenByWild, true);
  assert.equal(r.state.turn, 1);
  assert.equal(r.state.step, "draw");
});

test("canastas: seven cards; natural 500 or mixed 300 announced", () => {
  const s = make({ h0: "KS2 KH2 9S1 8S1", step: "play", melds: [[meld("K", "KS1 KH1 KD1 KC1 KD2")], []] });
  const r = act(s, 0, { type: "meld", groups: [{ cardIds: ["KS2", "KH2"], meldRank: "K" }] });
  assert.ok(r.events.some((e) => /natural \(red\) canasta, worth 500 of Kings/.test(e.text)));
  const s2 = make({ h0: "2S1 KH2 9S1 8S1", step: "play", melds: [[meld("K", "KS1 KH1 KD1 KC1 KD2")], []] });
  const r2 = act(s2, 0, { type: "meld", groups: [{ cardIds: ["2S1", "KH2"], meldRank: "K" }] });
  assert.ok(r2.events.some((e) => /mixed \(black\) canasta, worth 300/.test(e.text)));
});

test("can't go out without two canastas, or meld down to fewer than two cards", () => {
  const s = make({ h0: "QS1 QH1 QD1 9S1", step: "play", melds: [[meld("K", "KS1 KH1 KD1 KC1 KD2 KS2 KH2")], []] });
  assert.match(act(s, 0, { type: "meld", groups: [{ cardIds: ["QS1", "QH1", "QD1"] }] }).error, /two canastas/);
  const one = make({ h0: "9S1", step: "play", melds: [[meld("K", "KS1 KH1 KD1")], []] });
  assert.match(act(one, 0, { type: "discard", cardId: "9S1" }).error, /two canastas/);
});

test("going out with two canastas ends the hand and scores everything", () => {
  const twoCanastas = [meld("K", "KS1 KH1 KD1 KC1 KD2 KS2 KH2"), meld("Q", "QS1 QH1 QD1 QC1 QD2 QS2 2S1")];
  const s = make({ h0: "9S1", h1: "5S1 6S1", step: "play", melds: [twoCanastas, []], target: 1 });
  s.red3s[0] = cards("3H1");
  const r = act(s, 0, { type: "discard", cardId: "9S1" });
  assert.equal(g.isGameOver(r.state), true);
  const p = r.state.handResult.parts;
  // Kings 7 x 10 = 70; Queens 6 x 10 + a Two (20) = 80
  assert.equal(p[0].meldCards, 150);
  assert.equal(p[0].canastas, 500 + 300);
  assert.equal(p[0].red3, 100);
  assert.equal(p[0].out, 100);
  assert.equal(p[0].total, 150 + 800 + 100 + 100);
  // Sam: no melds, 10 in hand
  assert.equal(p[1].total, -10);
  assert.equal(g.score(r.state).winner, 0);
  assert.ok(r.events.some((e) => /melds 150 \+ canastas 800 \+ red Threes 100 \+ going out 100 − cards in hand 0 = 1150/.test(e.text)));
});

test("red Threes count against you if you never melded", () => {
  const s = make({ h0: "9S1 8S1", h1: "5S1 6S1", stock: "4D1", target: 1 });
  s.red3s[1] = cards("3H1 3D1");
  const r = act(s, 0, { type: "drawStock" });
  assert.equal(r.state.handResult.parts[1].red3, -200, "stock ran out: hand ends");
});

test("view: your hand, everyone's melds; not the other hand or the stock", () => {
  const s = make({ h0: "9S1 8S1", h1: "5S1 6S1", stock: "4D1 4H1 4S1" });
  const v = g.getPlayerView(s, 0);
  const json = JSON.stringify(v);
  for (const id of g.hiddenFrom(s, 0)) assert.ok(!json.includes(`"${id}"`), id);
  assert.equal(v.yourMinimum, 50);
});
