"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/islands");
const { TERRITORIES, ADJ, ISLANDS } = require("../../server/games/islands/map");

const players = [{ seat: 0, name: "Nanna" }, { seat: 1, name: "Sam" }];
const act = (s, seat, a) => {
  const r = g.applyAction(s, seat, a);
  if (r.error) throw new Error(r.error);
  return r;
};
// Hand-made position: Nanna owns North Isle, Sam owns West Isle, neutral owns East Isle.
function make({ armies = {}, owner = {} } = {}) {
  const o = {};
  const a = {};
  for (const t of TERRITORIES) {
    o[t.id] = t.island === "north" ? 0 : t.island === "west" ? 1 : 2;
    a[t.id] = 3;
  }
  return {
    names: ["Nanna", "Sam"], owner: { ...o, ...owner }, armies: { ...a, ...armies }, maxRounds: 20, round: 1,
    firstPlayer: 0, turn: 0, step: "attack", toPlace: 0, phase: "playing", winner: null, winReason: null,
    lastRoll: null, fortified: false, rng: [1, 2, 3, 4],
  };
}

test("map: 12 territories, 3 islands, every link goes both ways and the map is connected", () => {
  assert.equal(TERRITORIES.length, 12);
  for (const [id, ns] of Object.entries(ADJ)) for (const n of ns) assert.ok(ADJ[n].includes(id));
  const seen = new Set(["puffin"]);
  const queue = ["puffin"];
  while (queue.length) for (const n of ADJ[queue.shift()]) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  assert.equal(seen.size, 12);
});

test("balanced start: 4 territories each and 4 neutral, 3 armies per player territory", () => {
  for (let i = 0; i < 50; i++) {
    const s = g.createGame({ maxRounds: 20 }, players, `b${i}`);
    const count = (seat) => Object.values(s.owner).filter((o) => o === seat).length;
    assert.deepEqual([count(0), count(1), count(2)], [4, 4, 4]);
    for (const isl of ISLANDS) {
      const ids = TERRITORIES.filter((t) => t.island === isl.id).map((t) => t.id);
      assert.ok(ids.some((id) => s.owner[id] === 0) && ids.some((id) => s.owner[id] === 1), "both players start on every island");
    }
    assert.equal(s.step, "reinforce");
    assert.equal(s.toPlace, 3);
  }
});

test("reinforcements: at least 3, one per three territories, plus island bonuses", () => {
  const s = make();
  assert.equal(g.reinforcements(s, 0), 3 + 2, "4 territories -> 3, plus North Isle bonus 2");
  const big = make({ owner: Object.fromEntries(TERRITORIES.filter((t) => t.island !== "east").map((t) => [t.id, 0])) });
  assert.equal(g.reinforcements(big, 0), 3 + 2 + 2);
});

test("placing: only on your own territories, all must be placed before attacking", () => {
  let s = make();
  s.step = "reinforce";
  s.toPlace = 3;
  assert.match(g.applyAction(s, 0, { type: "place", territory: "bramble", count: 1 }).error, /isn't yours/);
  assert.match(g.applyAction(s, 0, { type: "attack", from: "moor", to: "bramble" }).error, /First place your 3/);
  s = act(s, 0, { type: "place", territory: "moor", count: 2 }).state;
  assert.equal(s.step, "reinforce");
  s = act(s, 0, { type: "place", territory: "moor", count: 1 }).state;
  assert.equal(s.step, "attack");
  assert.equal(s.armies.moor, 6);
});

test("attacking: must be neighbours, must leave one behind, server rolls fair dice", () => {
  const s = make({ armies: { puffin: 1 } });
  assert.match(g.applyAction(s, 0, { type: "attack", from: "puffin", to: "bramble" }).error, /aren't next to each other/);
  assert.match(g.applyAction(s, 0, { type: "attack", from: "moor", to: "harbour" }).error, /already yours/);
  const one = make({ armies: { moor: 1 } });
  assert.match(g.applyAction(one, 0, { type: "attack", from: "moor", to: "bramble" }).error, /at least 2 armies/);
  const r = act(s, 0, { type: "attack", from: "moor", to: "bramble" });
  const roll = r.state.lastRoll;
  assert.equal(roll.attacker.length, 2, "3 armies attack with 2 dice");
  assert.equal(roll.defender.length, 2);
  assert.equal(roll.aLoss + roll.dLoss, 2);
  assert.ok([...roll.attacker, ...roll.defender].every((d) => d >= 1 && d <= 6));
});

test("dice comparison: highest against highest, ties go to the defender", () => {
  // Find a seed position where we can check the losses against the dice.
  for (let i = 0; i < 200; i++) {
    const s = make({ armies: { moor: 10, bramble: 5 } });
    s.rng = require("../../server/engine/rng").create(`dice${i}`);
    const { lastRoll: r } = act(s, 0, { type: "attack", from: "moor", to: "bramble" }).state;
    let aLoss = 0;
    for (let k = 0; k < 2; k++) if (r.attacker[k] <= r.defender[k]) aLoss++;
    assert.equal(r.aLoss, aLoss);
    assert.equal(r.dLoss, 2 - aLoss);
  }
});

test("capturing moves armies in; taking every enemy territory wins", () => {
  let s = make({ armies: { moor: 10, bramble: 1 }, owner: { mill: 0, fox: 0, shell: 0 } });
  for (let i = 0; i < 30 && s.owner.bramble !== 0; i++) s = act(s, 0, { type: "attack", from: "moor", to: "bramble" }).state;
  assert.equal(s.owner.bramble, 0);
  assert.ok(s.armies.bramble >= 1);
  assert.equal(g.isGameOver(s), true);
  assert.match(g.score(s).summary, /took every one of Sam's territories/);
});

test("holding two whole islands at the end of your turn wins", () => {
  const owner = Object.fromEntries(TERRITORIES.filter((t) => t.island === "east").map((t) => [t.id, 0]));
  const s = make({ owner });
  s.step = "fortify";
  const r = act(s, 0, { type: "endTurn" });
  assert.equal(g.isGameOver(r.state), true);
  assert.match(g.score(r.state).summary, /two whole islands/);
});

test("fortify: one move between your own neighbours, leaving one behind, then the turn passes", () => {
  let s = make();
  s.step = "fortify";
  assert.match(g.applyAction(s, 0, { type: "fortify", from: "moor", to: "harbour", count: 1 }).error, /aren't next to each other/);
  assert.match(g.applyAction(s, 0, { type: "fortify", from: "moor", to: "puffin", count: 3 }).error, /between 1 and 2/);
  s = act(s, 0, { type: "fortify", from: "moor", to: "puffin", count: 2 }).state;
  assert.equal(s.armies.puffin, 5);
  assert.equal(s.turn, 1);
  assert.equal(s.step, "reinforce");
});

test("round limit: most territories wins, then most armies, else a draw", () => {
  let s = make({ owner: { bramble: 0 } });
  s.maxRounds = 1;
  s.turn = 1;
  s.step = "fortify";
  s = act(s, 1, { type: "endTurn" }).state;
  assert.equal(g.isGameOver(s), true);
  assert.equal(s.winner, 0);
  assert.match(s.winReason, /holds 5 territories to 3/);
});
