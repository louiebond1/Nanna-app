"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/wheel");
const words = require("../../server/words");

const players = [{ seat: 0, name: "Nanna" }, { seat: 1, name: "Sam" }];
// A fixed wheel: centre E, outer D T U R T E (from "uttered").
function make() {
  return {
    names: ["Nanna", "Sam"], centre: "e", outer: ["d", "t", "u", "r", "t", "e"], source: "uttered",
    answers: ["deer", "deter", "duet", "reed", "rude", "tree", "true", "uttered"],
    found: [[], []], finished: [false, false], phase: "playing",
  };
}
const word = (s, seat, w) => g.applyAction(s, seat, { type: "word", word: w });

test("dictionary: British spellings in, American-only spellings and names out", () => {
  assert.equal(words.isWord("colour"), true);
  assert.equal(words.isWord("analyse"), true);
  assert.equal(words.isWord("color"), false);
  assert.equal(words.isWord("london"), false);
  assert.equal(words.isWord("cats"), true, "plurals allowed");
});

test("puzzles always have a seven-letter answer and a sensible number of words", () => {
  for (let i = 0; i < 5; i++) {
    const s = g.createGame({}, players, `p${i}`);
    assert.equal(s.outer.length, 6);
    assert.ok(s.answers.includes(s.source));
    assert.ok(s.answers.length >= 12 && s.answers.length <= 60);
  }
});

test("valid word scores; the same word can't be entered twice", () => {
  const r = word(make(), 0, " Tree ");
  assert.deepEqual(r.state.found[0], ["tree"]);
  assert.match(word(r.state, 0, "TREE").error, /already got TREE/);
  assert.equal(word(r.state, 1, "tree").state.found[1][0], "tree", "the other player can find it too");
});

test("rules: length, centre letter, letters on the wheel used once, dictionary", () => {
  const s = make();
  assert.match(word(s, 0, "tee").error, /at least 4 letters/);
  assert.match(word(s, 0, "turd").error, /doesn't use the middle letter, E/);
  assert.match(word(s, 0, "street").error, /can't be made from these letters/);
  assert.match(word(s, 0, "reeder").error, /can't be made|isn't in our dictionary/);
  assert.match(word(s, 0, "dertu").error, /isn't in our dictionary/);
});

test("scoring: 4 letters 1, 5 letters 2, 6 letters 3, all seven 10", () => {
  assert.equal(g.points("tree"), 1);
  assert.equal(g.points("deter"), 2);
  assert.equal(g.points("rutted"), 3);
  assert.equal(g.points("uttered"), 10);
});

test("words are private until the end; the other player only sees a count", () => {
  let s = word(make(), 0, "tree").state;
  const r = word(s, 0, "deter");
  assert.ok(r.events.find((e) => e.forSeat === 1).text === "Nanna found a word.");
  s = r.state;
  const v1 = g.getPlayerView(s, 1);
  assert.equal(v1.opponentWordCount, 2);
  const json = JSON.stringify(v1);
  for (const w of ["tree", "deter", "uttered", "rude"]) assert.ok(!json.includes(`"${w}"`), w);
});

test("ends when both finish; shows both lists, scores and everyday words nobody found", () => {
  let s = word(make(), 0, "uttered").state;
  s = word(s, 1, "tree").state;
  s = g.applyAction(s, 0, { type: "finish" }).state;
  assert.match(word(s, 0, "true").error, /already finished/);
  assert.equal(g.isGameOver(s), false);
  s = g.applyAction(s, 1, { type: "finish" }).state;
  assert.equal(g.isGameOver(s), true);
  const v = g.getPlayerView(s, 0);
  assert.deepEqual(v.opponentWords, ["tree"]);
  assert.ok(v.missed.includes("deer") && !v.missed.includes("tree"));
  const sc = g.score(s);
  assert.equal(sc.winner, 0);
  assert.equal(sc.scores[0], 10);
});

test("a tie is a tie", () => {
  let s = word(make(), 0, "tree").state;
  s = word(s, 1, "true").state;
  s = g.applyAction(g.applyAction(s, 0, { type: "finish" }).state, 1, { type: "finish" }).state;
  assert.equal(g.score(s).winner, null);
});
