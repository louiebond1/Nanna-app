"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const rng = require("../server/engine/rng");
const { standardDeck, rankName } = require("../server/engine/cards");
const { assertEngine } = require("../server/engine/contract");
const { createRegistry } = require("../server/games");
const highcard = require("./fixtures/highcard");

test("same seed gives the same shuffle; different seeds differ", () => {
  const ids = (seed) => rng.shuffle(rng.create(seed), standardDeck()).map((c) => c.id).join();
  assert.equal(ids("abc"), ids("abc"));
  assert.notEqual(ids("abc"), ids("abd"));
});

test("shuffle keeps every card exactly once", () => {
  const out = rng.shuffle(rng.create("x"), standardDeck());
  assert.equal(out.length, 52);
  assert.equal(new Set(out.map((c) => c.id)).size, 52);
});

test("rng state survives JSON round trip mid-sequence", () => {
  const a = rng.create("s");
  rng.next(a);
  const b = JSON.parse(JSON.stringify(a));
  assert.equal(rng.next(a), rng.next(b));
});

test("dice are fair-ish and in range", () => {
  const r = rng.create("dice");
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 60000; i++) counts[rng.rollDie(r) - 1]++;
  for (const c of counts) assert.ok(c > 9500 && c < 10500, `count ${c}`);
});

test("rank plurals read naturally", () => {
  assert.equal(rankName("6", 2), "Sixes");
  assert.equal(rankName("K", 3), "Kings");
  assert.equal(rankName("A", 1), "Ace");
});

test("contract check rejects an incomplete engine", () => {
  assert.throws(() => assertEngine({ id: "x", title: "X" }), /missing normaliseSettings/);
  assert.doesNotThrow(() => createRegistry([highcard]));
});
