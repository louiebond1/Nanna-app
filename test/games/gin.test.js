"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/gin");
const { bestMelds, bestDefence } = require("../../server/games/gin/melds");

const c = (id) => ({ id, rank: id.slice(0, -1), suit: id.slice(-1) });
const cards = (s) => (s ? s.split(" ").map(c) : []);
const ids = (cs) => cs.map((x) => x.id).sort();
function make({ h0, h1, discard = "KD", stock = "2C 3C 4C 5C 6C 7C", turn = 0, step = "draw", totals = [0, 0], target = 100 }) {
  return {
    names: ["Nanna", "Sam"], target, totals, handNumber: 1, firstPlayer: 0, rng: [1, 2, 3, 4],
    lastHand: null, winner: null,
    hands: [cards(h0), cards(h1)], discard: cards(discard), stock: cards(stock),
    turn, step, takenFromDiscard: null, phase: "playing",
  };
}
const act = (s, seat, a) => {
  const r = g.applyAction(s, seat, a);
  if (r.error) throw new Error(r.error);
  return r;
};

test("melds: sets and runs, Ace low, best arrangement chosen", () => {
  const m = bestMelds(cards("AS 2S 3S 7H 7D 7C KS QH JD 9C"));
  assert.equal(m.points, 10 + 10 + 10 + 9);
  assert.equal(m.melds.length, 2);
  assert.equal(bestMelds(cards("QS KS AS")).points, 21, "Q-K-A is not a run");
});

test("melds: a card that fits a set or a run goes where it saves most", () => {
  // 7H fits the run 5-6-7H or the set of 7s, never both.
  // Run 5-6-7H leaves 7S+7D = 14; set 7H 7S 7D leaves 5H+6H = 11.
  assert.equal(bestMelds(cards("5H 6H 7H 7S 7D")).points, 11);
  // Four 7s plus 5-6H: run 5-6-7H and set 7S 7D 7C melds everything.
  assert.equal(bestMelds(cards("5H 6H 7H 7S 7D 7C")).points, 0);
});

test("deal: 10 each, one face-up discard, 31 in stock", () => {
  const s = g.createGame({ target: 100 }, [{ seat: 0, name: "A" }, { seat: 1, name: "B" }], "x");
  assert.equal(s.hands[0].length, 10);
  assert.equal(s.discard.length, 1);
  assert.equal(s.stock.length, 31);
});

test("turn: draw first, then discard; can't discard the card just taken from the discard pile", () => {
  let s = make({ h0: "AS 2S 3S 4H 5H 6H 9C 9D KC QC", h1: "2D 3D 4D 5D 6D 7D 8D 9H 10H JH" });
  assert.match(g.applyAction(s, 0, { type: "discard", cardId: "AS" }).error, /First take a card/);
  s = act(s, 0, { type: "drawDiscard" }).state;
  assert.equal(s.hands[0].length, 11);
  assert.match(g.applyAction(s, 0, { type: "discard", cardId: "KD" }).error, /can't throw away the card you just picked up/);
  s = act(s, 0, { type: "discard", cardId: "KC" }).state;
  assert.equal(s.turn, 1);
  assert.equal(s.discard[s.discard.length - 1].id, "KC");
});

test("drawing from the stock is private", () => {
  const s = make({ h0: "AS 2S 3S 4H 5H 6H 9C 9D KC QC", h1: "2D 3D 4D 5D 6D 7D 8D 9H 10H JH" });
  const r = act(s, 0, { type: "drawStock" });
  assert.ok(r.events.every((e) => e.forSeat === 0 || !/Two of Clubs/.test(e.text)));
  assert.ok(r.events.some((e) => e.forSeat === 0 && e.text === "You took the Two of Clubs."));
  assert.ok(!JSON.stringify(g.getPlayerView(r.state, 1)).includes('"2C"'));
});

test("can't knock with more than 10 deadwood", () => {
  let s = make({ h0: "AS 2S 3S 4H 5H 6H 9C 9D KC QC", h1: "2D 3D 4D 5D 6D 7D 8D 9H 10H JH", stock: "JS 3C 4C 5C" });
  s = act(s, 0, { type: "drawStock" }).state;
  // Left after discarding KC: two runs, plus 9C 9D QC JS = 38.
  assert.match(g.applyAction(s, 0, { type: "knock", cardId: "KC" }).error, /add up to 38/);
});

test("layoff onto a set: a defender's card can complete the knocker's set of three", () => {
  const d = bestDefence(cards("9H 10H AH"), [cards("9C 9D 9S")]);
  assert.deepEqual(ids(d.layoffs), ["9H"]);
  assert.equal(d.points, 11);
});

test("knock: knocker scores the difference after the defender lays off", () => {
  // Nanna: A-2-3S run, 4-5-6H run, 9C 9D 9S set, deadwood 2C after discarding KC.
  let s = make({ h0: "AS 2S 3S 4H 5H 6H 9C 9D KC 2C", h1: "7H 8H 4S 4D 4C JD QD KH 10C 3D", stock: "9S 3C 4C 5C" });
  s = act(s, 0, { type: "drawStock" }).state; // 9S
  const r = act(s, 0, { type: "knock", cardId: "KC" });
  const h = r.state.lastHand;
  assert.equal(h.kind, "knock");
  assert.equal(h.knockerPoints, 2);
  assert.deepEqual(ids(h.layoffs), ["7H", "8H"], "7H 8H extend the 4-5-6H run");
  // Sam: set 4S 4D 4C; deadwood JD QD KH 10C 3D = 43
  assert.equal(h.defenderPoints, 43);
  assert.equal(h.points, 41);
  assert.equal(r.state.totals[0], 41);
  assert.equal(r.state.phase, "handOver");
  assert.ok(r.events.some((e) => /scores the difference: 43 − 2 = 41/.test(e.text)));
});

test("gin: 25 bonus plus all defender deadwood, no layoffs allowed", () => {
  let s = make({ h0: "AS 2S 3S 4H 5H 6H 9C 9D 9H KC", h1: "7H 8H 4S 4D 4C JD QD KH 10C 3D", stock: "9S 3C 4C 5C" });
  s = act(s, 0, { type: "drawStock" }).state; // 9S makes four 9s
  const r = act(s, 0, { type: "knock", cardId: "KC" });
  assert.equal(r.state.lastHand.kind, "gin");
  assert.equal(r.state.lastHand.layoffs.length, 0);
  assert.equal(r.state.lastHand.points, 25 + 7 + 8 + 10 + 10 + 10 + 10 + 3);
});

test("undercut: defender with equal or less deadwood scores the difference plus 25", () => {
  // Nanna knocks with 8C (8). Sam has a 2-8D run and AH 2H 3C left = 6.
  let s = make({ h0: "AS 2S 3S 4H 5H 6H 9C 9D 8C KC", h1: "2D 3D 4D 5D 6D 7D 8D AH 2H 3C", stock: "9S 4C 5C 6C" });
  s = act(s, 0, { type: "drawStock" }).state;
  const r = act(s, 0, { type: "knock", cardId: "KC" });
  const h = r.state.lastHand;
  assert.equal(h.knockerPoints, 8);
  assert.equal(h.defenderPoints, 6);
  assert.equal(h.kind, "undercut");
  assert.equal(h.winner, 1);
  assert.equal(h.points, 8 - 6 + 25);
  assert.equal(r.state.totals[1], 27);
});

test("stock down to two without a knock: the hand is a draw", () => {
  let s = make({ h0: "AS 2S 3S 4H 5H 6H 9C 9D KC QC", h1: "2D 3D 4D 5D 6D 7D 8D 9H 10H JH", stock: "2C 3C 4C" });
  s = act(s, 0, { type: "drawStock" }).state;
  const r = act(s, 0, { type: "discard", cardId: "KC" });
  assert.equal(r.state.phase, "handOver");
  assert.equal(r.state.lastHand.kind, "draw");
  assert.deepEqual(r.state.totals, [0, 0]);
});

test("next hand deals again with the other player starting; reaching the target ends the game", () => {
  let s = make({ h0: "AS 2S 3S 4H 5H 6H 9C 9D KC 2C", h1: "7H 8H 4S 4D 4C JD QD KH 10C 3D", stock: "9S 3C 4C 5C", totals: [80, 0] });
  s = act(s, 0, { type: "drawStock" }).state;
  const r = act(s, 0, { type: "knock", cardId: "KC" });
  assert.equal(g.isGameOver(r.state), true);
  assert.equal(g.score(r.state).winner, 0);

  let s2 = make({ h0: "AS 2S 3S 4H 5H 6H 9C 9D KC QC", h1: "2D 3D 4D 5D 6D 7D 8D 9H 10H JH", stock: "2C 3C 4C" });
  s2 = act(s2, 0, { type: "drawStock" }).state;
  s2 = act(s2, 0, { type: "discard", cardId: "KC" }).state;
  const next = act(s2, 1, { type: "nextHand" }).state;
  assert.equal(next.phase, "playing");
  assert.equal(next.handNumber, 2);
  assert.equal(next.turn, 1);
  assert.equal(next.hands[0].length, 10);
});

test("layoffs: a run can be extended card by card", () => {
  const d = bestDefence(cards("7H 8H 9H"), [cards("4H 5H 6H")]);
  assert.equal(d.points, 0, "7H 8H 9H is itself a meld");
  const d2 = bestDefence(cards("7H 8H KS"), [cards("4H 5H 6H")]);
  assert.deepEqual(ids(d2.layoffs), ["7H", "8H"]);
  assert.equal(d2.points, 10);
});

test("the view shows your own melds and deadwood total, but not the other hand", () => {
  const s = make({ h0: "AS 2S 3S 4H 5H 6H 9C 9D KC QC", h1: "2D 3D 4D 5D 6D 7D 8D 9H 10H JH" });
  const v = g.getPlayerView(s, 0);
  assert.equal(v.yourDeadwoodPoints, 9 + 9 + 10 + 10);
  const json = JSON.stringify(v);
  for (const id of g.hiddenFrom(s, 0)) assert.ok(!json.includes(`"${id}"`), id);
});
