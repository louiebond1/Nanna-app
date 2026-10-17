"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/grid");

// C A T S
// O D E R
// G I N qu
// L A M P
const CELLS = ["c", "a", "t", "s", "o", "d", "e", "r", "g", "i", "n", "qu", "l", "a", "m", "p"];
function make(shared = "cancel") {
  return { names: ["Nanna", "Sam"], shared, cells: CELLS.slice(), common: ["cats", "code", "dine"], found: [[], []], finished: [false, false], phase: "playing" };
}
const word = (s, seat, w) => g.applyAction(s, seat, { type: "word", word: w });

test("tracing: neighbours including diagonals, no square used twice", () => {
  assert.ok(g.trace(CELLS, "cats"), "along the top row");
  assert.ok(g.trace(CELLS, "code"), "c-o-d-e: down, right, right");
  assert.ok(g.trace(CELLS, "dine"), "d-i-n-e uses diagonals");
  assert.equal(g.trace(CELLS, "cast"), null, "A (row 1) and S (row 1, col 4) are not neighbours");
  assert.equal(g.trace(CELLS, "tat"), null, "can't reuse the only T");
});

test("Qu is one square worth two letters", () => {
  const cells = ["qu", "i", "t", "e", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x", "x"];
  assert.ok(g.trace(cells, "quite"));
  assert.equal(g.trace(cells, "qite"), null);
});

test("valid words score; rules explained in plain English", () => {
  const s = make();
  const r = word(s, 0, "Cats");
  assert.deepEqual(r.state.found[0], ["cats"]);
  assert.match(word(r.state, 0, "cats").error, /already got CATS/);
  assert.match(word(s, 0, "at").error, /at least 3 letters/);
  assert.match(word(s, 0, "cast").error, /can't be made by joining neighbouring squares/);
  assert.match(word(s, 0, "dera").error, /can't be made|isn't in our dictionary/);
});

test("scoring table: 3-4 letters 1, 5 = 2, 6 = 3, 7 = 5, 8+ = 11", () => {
  assert.deepEqual(["cat", "cats", "coder", "coders", "gainers", "eighteen"].map(g.points), [1, 1, 2, 3, 5, 11]);
});

test("standard rule: words both players find score nothing", () => {
  let s = word(make("cancel"), 0, "cats").state;
  s = word(s, 0, "code").state;
  s = word(s, 1, "cats").state;
  s = g.applyAction(g.applyAction(s, 0, { type: "finish" }).state, 1, { type: "finish" }).state;
  const sc = g.score(s);
  assert.deepEqual([sc.scores[0], sc.scores[1]], [1, 0]);
  assert.deepEqual(g.getPlayerView(s, 0).bothFound, ["cats"]);
});

test("gentler rule: words both find score for both", () => {
  let s = word(make("both"), 0, "cats").state;
  s = word(s, 1, "cats").state;
  s = g.applyAction(g.applyAction(s, 0, { type: "finish" }).state, 1, { type: "finish" }).state;
  const sc = g.score(s);
  assert.deepEqual([sc.scores[0], sc.scores[1]], [1, 1]);
  assert.equal(sc.winner, null);
});

test("other player's words and the answer list stay hidden until the end", () => {
  const s = word(make(), 0, "code").state;
  const json = JSON.stringify(g.getPlayerView(s, 1));
  for (const w of ["code", "cats", "dine"]) assert.ok(!json.includes(`"${w}"`), w);
  assert.equal(g.getPlayerView(s, 1).opponentWordCount, 1);
});

test("generated grids: 16 squares, enough everyday words, all traceable", () => {
  for (let i = 0; i < 5; i++) {
    const s = g.createGame({ shared: "cancel" }, [{ name: "A" }, { name: "B" }], `t${i}`);
    assert.equal(s.cells.length, 16);
    assert.ok(s.common.length >= 25);
    for (const w of s.common.slice(0, 10)) assert.ok(g.trace(s.cells, w), w);
  }
});
