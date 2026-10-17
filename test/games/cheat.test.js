"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/cheat");

const c = (id) => ({ id, rank: id.slice(0, -1), suit: id.slice(-1) });
const cards = (s) => (s ? s.split(" ").map(c) : []);
function make({ h0, h1, rank = "A", turn = 0, pile = "" }) {
  return { names: ["Nanna", "Sam"], hands: [cards(h0), cards(h1)], pile: cards(pile), rank, phase: "play", turn, claim: null, winner: null };
}
const place = (s, seat, ids) => g.applyAction(s, seat, { type: "place", cardIds: ids.split(" ") });

test("deal: 26 each, every card once", () => {
  const s = g.createGame({}, [{ seat: 0, name: "A" }, { seat: 1, name: "B" }], "x");
  const ids = [...s.hands[0], ...s.hands[1]].map((x) => x.id);
  assert.equal(s.hands[0].length, 26);
  assert.equal(new Set(ids).size, 52);
  assert.equal(s.rank, "A");
});

test("must put down 1 to 4 of your own cards", () => {
  const s = make({ h0: "AS AH AD AC 2S", h1: "3S" });
  assert.match(g.applyAction(s, 0, { type: "place", cardIds: [] }).error, /between 1 and 4/);
  assert.match(place(s, 0, "AS AH AD AC 2S").error, /between 1 and 4/);
  assert.match(place(s, 0, "AS AS").error, /same card twice/);
  assert.match(place(s, 0, "3S").error, /isn't in your hand/);
  assert.match(place(s, 1, "3S").error, /Nanna's turn/);
});

test("placing makes a claim of the current rank; opponent must respond", () => {
  const s = make({ h0: "AS 5D", h1: "3S" });
  const { state, events } = place(s, 0, "5D");
  assert.equal(state.phase, "respond");
  assert.equal(state.turn, 1);
  assert.ok(events[0].text.includes("“one Ace”"));
  assert.deepEqual(g.legalActions(state, 1).map((a) => a.type), ["accept", "call"]);
  assert.match(g.applyAction(state, 1, { type: "place", cardIds: ["3S"] }).error, /believe them/);
});

test("the actual cards stay hidden from the opponent until called", () => {
  const { state } = place(make({ h0: "AS 5D", h1: "3S" }), 0, "5D");
  const v = g.getPlayerView(state, 1);
  assert.ok(!JSON.stringify(v).includes('"5D"'));
  assert.deepEqual(v.claim, { seat: 0, count: 1, rank: "A" });
});

test("caught cheating: the cheater picks up the pile", () => {
  let s = make({ h0: "AS 5D", h1: "3S", pile: "9C 9H" });
  s = place(s, 0, "5D").state;
  const { state, events } = g.applyAction(s, 1, { type: "call" });
  assert.equal(state.hands[0].length, 4);
  assert.equal(state.pile.length, 0);
  assert.ok(events.some((e) => /were: Five of Diamonds/.test(e.text)));
  assert.ok(events.some((e) => /was cheating/.test(e.text)));
  assert.equal(state.turn, 1);
  assert.equal(state.rank, "2");
});

test("wrongly calling cheat: the caller picks up the pile", () => {
  let s = make({ h0: "AS 5D", h1: "3S", pile: "9C" });
  s = place(s, 0, "AS").state;
  const { state } = g.applyAction(s, 1, { type: "call" });
  assert.equal(state.hands[1].length, 3);
  assert.equal(state.hands[0].length, 1);
});

test("believing: pile stays, the responder plays next with the next rank", () => {
  let s = make({ h0: "AS 5D", h1: "3S" });
  s = place(s, 0, "5D").state;
  const { state } = g.applyAction(s, 1, { type: "accept" });
  assert.equal(state.pile.length, 1);
  assert.equal(state.turn, 1);
  assert.equal(state.rank, "2");
  assert.equal(state.phase, "play");
});

test("ranks run Ace to King then back to Ace", () => {
  let s = make({ h0: "KS 5D", h1: "3S 4S", rank: "K" });
  s = place(s, 0, "KS").state;
  s = g.applyAction(s, 1, { type: "accept" }).state;
  assert.equal(s.rank, "A");
});

test("last cards: win if believed, or if called and honest", () => {
  let s = place(make({ h0: "AS", h1: "3S" }), 0, "AS").state;
  assert.equal(g.applyAction(s, 1, { type: "accept" }).state.winner, 0);
  const called = g.applyAction(s, 1, { type: "call" }).state;
  assert.equal(called.winner, 0);
  assert.equal(g.score(called).scores[1], 2);
});

test("last cards but caught lying: no win, picks the pile back up", () => {
  const s = place(make({ h0: "5D", h1: "3S" }), 0, "5D").state;
  const r = g.applyAction(s, 1, { type: "call" }).state;
  assert.equal(r.winner, null);
  assert.equal(r.hands[0].length, 1);
  assert.equal(r.phase, "play");
});

test("legal play options include the honest play and each single card", () => {
  const s = make({ h0: "AS AH 5D", h1: "3S" });
  const acts = g.legalActions(s, 0);
  assert.ok(acts.some((a) => a.label === "Put down your 2 Aces (honest)"));
  assert.ok(acts.some((a) => a.label === "Put down the Five of Diamonds as one Ace"));
});
