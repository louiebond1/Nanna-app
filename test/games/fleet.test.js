"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/fleet");

const players = [{ seat: 0, name: "Nanna" }, { seat: 1, name: "Sam" }];
const act = (s, seat, a) => {
  const r = g.applyAction(s, seat, a);
  if (r.error) throw new Error(r.error);
  return r.state;
};
// 8x8 fleet: Liner 4, Ferry 3, Trawler 3, Dinghy 2. Seat 0 uses rows 0-3,
// seat 1 rows 4-7 (column 1), so the two layouts differ.
function placed(seed = "s") {
  let s = g.createGame({ size: 8 }, players, seed);
  for (const seat of [0, 1]) {
    s.fleet.forEach((_, i) => { s = act(s, seat, { type: "place", ship: i, row: i + seat * 4, col: seat, across: true }); });
    s = act(s, seat, { type: "ready" });
  }
  return s;
}

test("settings: only 8 or 10", () => {
  assert.ok(g.normaliseSettings({ size: 9 }).error);
  assert.deepEqual(g.normaliseSettings({ size: "10" }), { size: 10 });
});

test("placement: must fit on the board and not overlap", () => {
  const s = g.createGame({ size: 8 }, players, "x");
  assert.match(g.applyAction(s, 0, { type: "place", ship: 0, row: 0, col: 6, across: true }).error, /doesn't fit/);
  const s2 = act(s, 0, { type: "place", ship: 0, row: 2, col: 2, across: true });
  assert.match(g.applyAction(s2, 0, { type: "place", ship: 1, row: 0, col: 3, across: false }).error, /overlap/);
  const moved = act(s2, 0, { type: "place", ship: 0, row: 5, col: 0, across: true });
  assert.deepEqual(moved.ships[0][0].cells[0], [5, 0], "a ship can be moved");
});

test("can't lock in until every ship is placed; then locked", () => {
  const s = g.createGame({ size: 8 }, players, "x");
  assert.match(g.applyAction(s, 0, { type: "ready" }).error, /Place all/);
  const r = act(act(s, 0, { type: "randomise" }), 0, { type: "ready" });
  assert.match(g.applyAction(r, 0, { type: "randomise" }).error, /locked in/);
  assert.equal(r.phase, "placing");
});

test("random placement is always legal", () => {
  for (const size of [8, 10]) {
    for (let i = 0; i < 200; i++) {
      const s = act(g.createGame({ size }, players, `r${i}`), 0, { type: "randomise" });
      const cells = s.ships[0].flatMap((x) => x.cells.map(([r, c]) => `${r},${c}`));
      assert.equal(new Set(cells).size, cells.length);
      assert.ok(s.ships[0].every((x) => x.cells.every(([r, c]) => r >= 0 && c >= 0 && r < size && c < size)));
    }
  }
});

test("battle: alternate turns, hits, misses, no repeat shots", () => {
  let s = placed();
  const first = s.turn;
  assert.match(g.applyAction(s, 1 - first, { type: "fire", row: 7, col: 7 }).error, /turn/);
  const r = g.applyAction(s, first, { type: "fire", row: 7, col: 7 });
  assert.ok(r.events[0].text.endsWith("miss."));
  s = r.state;
  assert.equal(s.turn, 1 - first);
  s = act(s, 1 - first, { type: "fire", row: 0, col: 0 });
  const again = g.applyAction(s, first, { type: "fire", row: 7, col: 7 });
  assert.match(again.error, /already fired at H8/);
  assert.match(g.applyAction(s, first, { type: "fire", row: 9, col: 0 }).error, /isn't on the board/);
});

test("sinking announces the ship; sinking all wins", () => {
  let s = placed();
  const a = s.turn;
  const b = 1 - a;
  // a fires at every ship square of b; b fires at the empty bottom rows.
  const targets = s.ships[b].flatMap((x) => x.cells);
  let filler = 0;
  let sawSunk = false;
  for (const [r, c] of targets) {
    const res = g.applyAction(s, a, { type: "fire", row: r, col: c });
    if (res.events.some((e) => /sank Sam's|sank Nanna's/.test(e.text))) sawSunk = true;
    s = res.state;
    if (g.isGameOver(s)) break;
    // b fires down columns 7 then 6; no ship reaches past column 4
    s = act(s, b, { type: "fire", row: filler % 8, col: 7 - Math.floor(filler++ / 8) });
  }
  assert.ok(sawSunk);
  assert.equal(g.isGameOver(s), true);
  assert.equal(g.score(s).winner, a);
  assert.equal(g.score(s).scores[a], 12);
});

test("the other player's unhit ships never show on your target board", () => {
  let s = placed();
  const a = s.turn;
  const view = g.getPlayerView(s, a);
  assert.ok(view.target.flat().every((x) => x === "unknown"));
  const json = JSON.stringify(view);
  assert.ok(!json.includes(JSON.stringify(s.ships[1 - a])));
  // After a hit, only that square changes.
  const [r, c] = s.ships[1 - a][0].cells[0];
  s = act(s, a, { type: "fire", row: r, col: c });
  const v2 = g.getPlayerView(s, a);
  assert.equal(v2.target[r][c], "hit");
  assert.equal(v2.target.flat().filter((x) => x !== "unknown").length, 1);
  assert.ok(v2.theirFleet.every((f) => f.sunk === false));
});

test("during placement the opponent learns nothing about your ships", () => {
  let s = g.createGame({ size: 8 }, players, "p");
  s = act(s, 0, { type: "randomise" });
  const v = g.getPlayerView(s, 1);
  assert.ok(v.placed.every((x) => x === null));
  assert.ok(v.target.flat().every((x) => x === "unknown"));
  assert.ok(!JSON.stringify(v).includes(JSON.stringify(s.ships[0][0].cells)));
});

test("at the end, the remaining ships are revealed", () => {
  let s = placed();
  s.phase = "over";
  const v = g.getPlayerView(s, 0);
  assert.equal(v.target.flat().filter((x) => x === "ship").length, 12);
});
