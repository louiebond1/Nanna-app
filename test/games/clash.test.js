"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/clash");

const players = [{ seat: 0, name: "Nanna" }, { seat: 1, name: "Sam" }];
// "red-5", "blue-skip", "wild", "wild4"; ids get a suffix to stay unique.
let n = 0;
function c(spec) {
  if (spec === "wild" || spec === "wild4") return { id: `${spec}-t${++n}`, colour: null, value: spec };
  const [colour, value] = spec.split("-");
  return { id: `${spec}-t${++n}`, colour, value };
}
function make({ h0, h1, top = "red-5", colour, deck = "green-1 green-2 green-3 green-4 green-6 green-7", turn = 0, target = 0, totals = [0, 0] }) {
  const t = c(top);
  return {
    names: ["Nanna", "Sam"],
    target, totals, round: 1, roundStarter: 0,
    rng: [1, 2, 3, 4], reshuffles: 0, phase: "playing", winner: null, lastRound: null,
    hands: [h0.split(" ").map(c), h1.split(" ").map(c)],
    deck: deck ? deck.split(" ").map(c) : [],
    discard: [t],
    colour: colour || t.colour,
    drawnCardId: null,
    turn,
  };
}
const play = (s, seat, i, colour) => g.applyAction(s, seat, { type: "play", cardId: s.hands[seat][i].id, colour });

test("deal: 108 cards, 7 each, starting card is a plain number", () => {
  for (let i = 0; i < 50; i++) {
    const s = g.createGame({ target: 0 }, players, `d${i}`);
    assert.equal(s.hands[0].length, 7);
    const ids = [...s.hands[0], ...s.hands[1], ...s.deck, ...s.discard].map((x) => x.id);
    assert.equal(ids.length, 108);
    assert.equal(new Set(ids).size, 108);
    assert.match(s.discard[0].value, /^[0-9]$/);
  }
});

test("match by colour or by number/symbol; mismatches explained", () => {
  const s = make({ h0: "red-9 blue-5 blue-7 green-skip", h1: "yellow-1" });
  assert.ok(!play(s, 0, 0).error, "same colour");
  assert.ok(!play(s, 0, 1).error, "same number");
  assert.match(play(s, 0, 2).error, /Blue 7 doesn't match\. You need something Red, a 5, or a Wild\./);
});

test("wild can always be played and needs a colour", () => {
  const s = make({ h0: "wild blue-1", h1: "yellow-1" });
  assert.match(play(s, 0, 0).error, /Choose a colour/);
  const r = play(s, 0, 0, "blue");
  assert.equal(r.state.colour, "blue");
  assert.equal(r.state.turn, 1);
});

test("two players: Skip and Reverse both mean you go again", () => {
  for (const v of ["skip", "reverse"]) {
    const r = play(make({ h0: `red-${v} red-1`, h1: "yellow-1" }), 0, 0);
    assert.equal(r.state.turn, 0, v);
    assert.ok(r.events.some((e) => /misses a turn/.test(e.text)));
  }
});

test("Draw Two and Wild Draw Four: opponent picks up and misses a turn; no stacking", () => {
  const r = play(make({ h0: "red-draw2 red-1", h1: "yellow-1 blue-draw2" }), 0, 0);
  assert.equal(r.state.hands[1].length, 4);
  assert.equal(r.state.turn, 0, "Sam can't stack a Draw Two back");
  const priv = r.events.find((e) => e.forSeat === 1);
  assert.match(priv.text, /^You picked up /);
  const r4 = play(make({ h0: "wild4 red-1", h1: "yellow-1" }), 0, 0, "green");
  assert.equal(r4.state.hands[1].length, 5);
  assert.equal(r4.state.colour, "green");
  assert.equal(r4.state.turn, 0);
});

test("drawing: an unplayable draw ends the turn; a playable one can be played or kept", () => {
  let s = make({ h0: "blue-1", h1: "yellow-1", deck: "green-9" });
  let r = g.applyAction(s, 0, { type: "draw" });
  assert.equal(r.state.turn, 1);
  s = make({ h0: "blue-1", h1: "yellow-1", deck: "green-9 red-2" });
  r = g.applyAction(s, 0, { type: "draw" });
  assert.equal(r.state.turn, 0);
  assert.equal(r.state.drawnCardId, r.state.hands[0][1].id);
  assert.deepEqual(g.legalActions(r.state, 0).map((a) => a.type), ["play", "pass"]);
  assert.match(g.applyAction(r.state, 0, { type: "draw" }).error, /already drawn/);
  assert.match(g.applyAction(r.state, 0, { type: "play", cardId: r.state.hands[0][0].id }).error, /only play the card you just drew|doesn't match/);
  const kept = g.applyAction(r.state, 0, { type: "pass" });
  assert.equal(kept.state.turn, 1);
  assert.equal(kept.state.hands[0].length, 2);
});

test("the drawn card is only named to the player who drew it", () => {
  const r = g.applyAction(make({ h0: "blue-1", h1: "yellow-1", deck: "green-9" }), 0, { type: "draw" });
  assert.ok(r.events.filter((e) => e.forSeat === undefined).every((e) => !/Green 9/.test(e.text)));
  assert.ok(r.events.some((e) => e.forSeat === 0 && e.text === "You drew Green 9."));
});

test("empty deck reshuffles the discard pile, keeping the top card", () => {
  const s = make({ h0: "blue-1", h1: "yellow-1", deck: "" });
  s.discard = [c("green-3"), c("green-4"), c("red-5")];
  const r = g.applyAction(s, 0, { type: "draw" });
  assert.equal(r.state.discard.length, 1);
  assert.equal(r.state.discard[0].value, "5");
  assert.equal(r.state.reshuffles, 1);
  assert.equal(r.state.hands[0].length + r.state.deck.length, 3);
});

test("no cards anywhere to draw and nothing playable: pass is allowed", () => {
  const s = make({ h0: "blue-1", h1: "yellow-1", deck: "" });
  assert.deepEqual(g.legalActions(s, 0).map((a) => a.type), ["pass"]);
  assert.equal(g.applyAction(s, 0, { type: "pass" }).state.turn, 1);
});

test("going out wins the round and scores the other hand", () => {
  const s = make({ h0: "red-1", h1: "yellow-7 blue-skip wild" });
  const r = play(s, 0, 0);
  assert.equal(g.isGameOver(r.state), true);
  const sc = g.score(r.state);
  assert.equal(sc.winner, 0);
  assert.equal(sc.scores[0], 7 + 20 + 50);
});

test("going out on a Draw Two: the pick-up happens first and counts towards the score", () => {
  // Deck draws from the end: Green 7, then Green 6.
  const r = play(make({ h0: "red-draw2", h1: "yellow-7" }), 0, 0);
  assert.equal(g.isGameOver(r.state), true);
  assert.equal(r.state.hands[1].length, 3);
  assert.equal(r.state.totals[0], 7 + 7 + 6);
});

test("first to 200: a round win below the target deals a new round", () => {
  const s = make({ h0: "red-1", h1: "yellow-7", target: 200, totals: [100, 0] });
  const r = play(s, 0, 0);
  assert.equal(g.isGameOver(r.state), false);
  assert.equal(r.state.round, 2);
  assert.equal(r.state.totals[0], 107);
  assert.equal(r.state.hands[0].length, 7);
  assert.ok(r.events.some((e) => /Round 2/.test(e.text)));
  const s2 = make({ h0: "red-1", h1: "wild wild wild wild", target: 200, totals: [10, 0] });
  const r2 = play(s2, 0, 0);
  assert.equal(g.isGameOver(r2.state), true);
  assert.equal(r2.state.totals[0], 210);
});

test("view hides the other hand and the deck", () => {
  const s = make({ h0: "red-1", h1: "yellow-7 blue-2" });
  const json = JSON.stringify(g.getPlayerView(s, 0));
  for (const id of g.hiddenFrom(s, 0)) assert.ok(!json.includes(`"${id}"`), id);
  assert.equal(g.getPlayerView(s, 0).opponentCardCount, 2);
});
