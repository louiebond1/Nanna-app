"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/gofish");

const c = (id) => ({ id, rank: id.slice(0, -1), suit: id.slice(-1) });
const cards = (s) => (s ? s.split(" ").map(c) : []);
const ask = (state, seat, rank) => g.applyAction(state, seat, { type: "ask", rank });

function make({ h0, h1, pond, phase = "normal", turn = 0, books = [[], []], finalOrder = [] }) {
  return {
    names: ["Nanna", "Sam"],
    hands: [cards(h0), cards(h1)],
    pond: cards(pond),
    books,
    phase,
    turn,
    finalOrder,
    lastBookOwner: null,
    lastAsk: null,
  };
}
const FILLER = "2C 3C 4C 5C 6C 7C 8C 9C"; // pond > 5 keeps the normal phase

test("deal: 7 cards each, 38 in the pond, no card twice, same seed same deal", () => {
  const s = g.createGame({}, [{ seat: 0, name: "A" }, { seat: 1, name: "B" }], "seed-1");
  const all = [...s.hands[0], ...s.hands[1], ...s.pond].map((x) => x.id);
  const inBooks = (s.books[0].length + s.books[1].length) * 4;
  assert.equal(all.length + inBooks, 52);
  assert.equal(new Set(all).size, all.length);
  assert.equal(s.pond.length, 38);
  const again = g.createGame({}, [{ seat: 0, name: "A" }, { seat: 1, name: "B" }], "seed-1");
  assert.deepEqual(again, s);
});

test("can only ask for a rank you hold, on your turn", () => {
  const s = make({ h0: "AS 5H", h1: "KS", pond: FILLER });
  assert.match(ask(s, 0, "K").error, /no Kings/);
  assert.match(ask(s, 1, "K").error, /Nanna's turn/);
  assert.match(g.applyAction(s, 0, { type: "ask", rank: "Z" }).error, /isn't a card rank/);
  assert.deepEqual(g.legalActions(s, 0).map((a) => a.rank), ["A", "5"]);
  assert.equal(g.legalActions(s, 0)[0].label, "Ask Sam for Aces");
  assert.deepEqual(g.legalActions(s, 1), []);
});

test("successful ask takes every matching card and keeps the turn", () => {
  const s = make({ h0: "7S 2D", h1: "7H 7D KS", pond: FILLER });
  const { state, events } = ask(s, 0, "7");
  assert.deepEqual(state.hands[0].map((x) => x.id).sort(), ["2D", "7D", "7H", "7S"]);
  assert.deepEqual(state.hands[1].map((x) => x.id), ["KS"]);
  assert.equal(state.turn, 0);
  assert.ok(events.some((e) => e.text === "Sam handed over 2 Sevens."));
  assert.equal(s.hands[1].length, 3, "input state not mutated");
});

test("completing a book removes it and records it", () => {
  const s = make({ h0: "9S 9H 9D 2D", h1: "9C KS", pond: FILLER });
  const { state, events } = ask(s, 0, "9");
  assert.deepEqual(state.books[0], ["9"]);
  assert.deepEqual(state.hands[0].map((x) => x.id), ["2D"]);
  assert.equal(state.lastBookOwner, 0);
  assert.ok(events.some((e) => e.text === "Nanna completed a book of Nines."));
});

test("failed ask draws one card; a different rank ends the turn", () => {
  const s = make({ h0: "AS", h1: "KS", pond: "4D " + FILLER });
  const { state, events } = ask(s, 0, "A");
  assert.ok(state.hands[0].some((x) => x.id === "4D"));
  assert.equal(state.turn, 1);
  const priv = events.find((e) => e.forSeat === 0);
  assert.equal(priv.text, "You drew the Four of Diamonds.");
  assert.ok(!events.some((e) => e.forSeat === undefined && e.text.includes("Four")), "drawn card not announced publicly");
});

test("Lucky Catch keeps the turn in normal play", () => {
  const s = make({ h0: "AS", h1: "KS", pond: "AD " + FILLER });
  const { state, events } = ask(s, 0, "A");
  assert.equal(state.turn, 0);
  assert.ok(events.some((e) => /Lucky Catch/.test(e.text)));
});

test("an unrelated draw that completes a book still ends the turn", () => {
  const s = make({ h0: "AS 4S 4H 4C", h1: "KS", pond: "4D " + FILLER });
  const { state } = ask(s, 0, "A");
  assert.deepEqual(state.books[0], ["4"]);
  assert.equal(state.turn, 1);
});

test("drawing the pond down to five starts the Closing Phase after the move finishes", () => {
  // Pond 6 -> Lucky Catch draws it to 5. The normal rule (keep turn) applies to that move.
  const s = make({ h0: "AS 3H", h1: "KS", pond: "AD 2C 3C 4C 5C 6C" });
  const { state, events } = ask(s, 0, "A");
  assert.equal(state.phase, "closing");
  assert.equal(state.turn, 0, "the player who would normally act next goes first");
  assert.ok(events.some((e) => /pond is closing/.test(e.text)));
});

test("in the Closing Phase a successful ask passes the turn", () => {
  const s = make({ h0: "7S 2D", h1: "7H KS", pond: "2C 3C 4C", phase: "closing" });
  const { state } = ask(s, 0, "7");
  assert.equal(state.turn, 1);
});

test("in the Closing Phase a Lucky Catch passes the turn", () => {
  const s = make({ h0: "AS 2D", h1: "KS", pond: "AD 3C 4C", phase: "closing" });
  const { state } = ask(s, 0, "A");
  assert.equal(state.turn, 1);
});

test("drawing the last pond card starts the Final Round with the next player", () => {
  const s = make({ h0: "AS 2D", h1: "KS 3H", pond: "5D", phase: "closing" });
  const { state, events } = ask(s, 0, "A");
  assert.equal(state.phase, "final");
  assert.deepEqual(state.finalOrder, [1, 0]);
  assert.equal(state.turn, 1);
  assert.ok(events.some((e) => /Final Round/.test(e.text)));
});

test("Final Round: one ask each, failed asks draw nothing, then the game ends", () => {
  const s = make({ h0: "AS 2D", h1: "KS 3H", pond: "", phase: "final", turn: 1, finalOrder: [1, 0] });
  const r1 = ask(s, 1, "K");
  assert.equal(r1.state.hands[1].length, 2, "no draw in Final Round");
  assert.equal(r1.state.turn, 0);
  const r2 = ask(r1.state, 0, "2");
  assert.equal(g.isGameOver(r2.state), true);
  assert.deepEqual(g.legalActions(r2.state, 0), []);
});

test("Final Round: a successful ask does not give another turn", () => {
  const s = make({ h0: "AS 2D", h1: "AH 3H", pond: "", phase: "final", turn: 0, finalOrder: [0, 1] });
  const { state } = ask(s, 0, "A");
  assert.equal(state.turn, 1);
});

test("Final Round: an empty-handed player is skipped", () => {
  const s = make({ h0: "AS", h1: "AH", pond: "", phase: "final", turn: 0, finalOrder: [0, 1] });
  const { state, events } = ask(s, 0, "A");
  assert.equal(g.isGameOver(state), true);
  assert.ok(events.some((e) => /final turn is skipped/.test(e.text)));
});

test("empty hand with cards in the pond: draws a replacement and plays on", () => {
  // Sam's only card is taken, then it becomes Sam's turn after Nanna fishes.
  const s = make({ h0: "7S", h1: "7H", pond: "2C " + FILLER });
  const r1 = ask(s, 0, "7");
  assert.equal(r1.state.hands[1].length, 0);
  assert.equal(r1.state.turn, 0);
  const r2 = ask(r1.state, 0, "7"); // Sam has none now: Nanna fishes the 2C
  assert.equal(r2.state.turn, 1);
  assert.equal(r2.state.hands[1].length, 1, "Sam took a replacement card");
  assert.ok(r2.events.some((e) => e.text === "Sam had no cards, so took one from the pond."));
  assert.ok(r2.events.some((e) => e.forSeat === 1 && /^You took the /.test(e.text)));
});

test("all 13 books made ends the game straight away", () => {
  const twelve = ["A", "2", "3", "4", "5", "6", "8", "9", "10", "J", "Q", "K"];
  const s = make({ h0: "7S 7H 7D", h1: "7C", pond: FILLER, books: [twelve.slice(0, 6), twelve.slice(6)] });
  const { state } = ask(s, 0, "7");
  assert.equal(g.isGameOver(state), true);
  assert.equal(g.score(state).winner, 0);
});

test("winner: more books; then more cards in hand; then most recent book; else a draw", () => {
  const base = { h0: "", h1: "", pond: "", phase: "over" };
  let s = make({ ...base, books: [["A", "2"], ["3"]] });
  assert.equal(g.score(s).winner, 0);
  assert.match(g.score(s).summary, /2 books to 1/);
  s = make({ ...base, h1: "4S", books: [["A"], ["3"]] });
  assert.equal(g.score(s).winner, 1);
  s = make({ ...base, books: [["A"], ["3"]] });
  s.lastBookOwner = 1;
  assert.equal(g.score(s).winner, 1);
  s.lastBookOwner = null;
  assert.equal(g.score(s).winner, null);
  assert.match(g.score(s).summary, /draw/);
});

test("books made in the deal don't count as the most recent book", () => {
  // Find a seed whose deal contains a book; there are plenty.
  for (let i = 0; i < 2000; i++) {
    const s = g.createGame({}, [{ seat: 0, name: "A" }, { seat: 1, name: "B" }], `book-${i}`);
    if (s.books[0].length + s.books[1].length) {
      assert.equal(s.lastBookOwner, null);
      return;
    }
  }
  assert.fail("no seed with a dealt book found");
});

test("the view hides the opponent's hand and the pond until the end", () => {
  const s = make({ h0: "AS 2D", h1: "KS 3H", pond: FILLER });
  const v = g.getPlayerView(s, 0);
  const json = JSON.stringify(v);
  for (const id of ["KS", "3H", ...FILLER.split(" ")]) assert.ok(!json.includes(`"${id}"`), `${id} leaked`);
  assert.equal(v.opponentCardCount, 2);
  assert.equal(v.pondCount, 8);
  const over = make({ h0: "AS", h1: "KS", pond: "", phase: "over" });
  assert.deepEqual(g.getPlayerView(over, 0).opponentHand.map((x) => x.id), ["KS"]);
});

test("random full games always end legally with all 52 cards accounted for", () => {
  for (let i = 0; i < 300; i++) {
    let s = g.createGame({}, [{ seat: 0, name: "A" }, { seat: 1, name: "B" }], `full-${i}`);
    let steps = 0;
    while (!g.isGameOver(s)) {
      const legal = g.legalActions(s, s.turn);
      assert.ok(legal.length > 0, `stuck at seed full-${i}`);
      const pick = legal[(i + steps) % legal.length];
      s = g.applyAction(s, s.turn, pick).state;
      assert.ok(++steps < 500, "game too long");
      const count = s.hands[0].length + s.hands[1].length + s.pond.length + (s.books[0].length + s.books[1].length) * 4;
      assert.equal(count, 52);
    }
    const sc = g.score(s);
    assert.ok(sc.summary.length > 0);
  }
});
