"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../../server/games/whoswho");
const { CHARACTERS, QUESTIONS } = require("../../server/games/whoswho/characters");

function make(wrongGuess = "lose") {
  return {
    names: ["Nanna", "Sam"], wrongGuess, secret: ["ada", "felix"], down: [[], []], asked: [],
    turn: 0, phase: "playing", winner: null, wrongGuesses: [[], []],
  };
}
const act = (s, seat, a) => g.applyAction(s, seat, a);

test("30 characters, every one can be told apart by the questions", () => {
  assert.equal(CHARACTERS.length, 30);
  const sigs = new Set(CHARACTERS.map((c) => QUESTIONS.map((q) => (q.test(c) ? 1 : 0)).join("")));
  assert.equal(sigs.size, 30);
});

test("secrets are two different people", () => {
  for (let i = 0; i < 50; i++) {
    const s = g.createGame({ wrongGuess: "lose" }, [{ name: "A" }, { name: "B" }], `s${i}`);
    assert.notEqual(s.secret[0], s.secret[1]);
  }
});

test("questions are answered truthfully by the server, then the turn passes", () => {
  // Sam's secret is Felix: ginger, glasses, smiling.
  let r = act(make(), 0, { type: "ask", questionId: "glasses" });
  assert.ok(r.events.some((e) => e.text === "Sam's answer: Yes."));
  assert.equal(r.state.turn, 1);
  r = act(r.state, 1, { type: "ask", questionId: "hat" }); // Ada: no hat
  assert.ok(r.events.some((e) => e.text === "Nanna's answer: No."));
  assert.match(act(r.state, 1, { type: "ask", questionId: "beard" }).error, /Nanna's turn/);
});

test("a player's secret is never in the other player's view until the end", () => {
  const s = make();
  const v1 = g.getPlayerView(s, 1);
  assert.equal(v1.yourPerson, "felix");
  assert.equal(v1.theirPerson, null);
  assert.ok(!JSON.stringify({ ...v1, characters: undefined }).includes('"ada"'), "only the public list mentions ada");
  const over = act(s, 0, { type: "guess", characterId: "felix" }).state;
  assert.equal(g.getPlayerView(over, 1).theirPerson, "ada", "revealed at the end");
});

test("flipping faces is private to your own board and can be undone", () => {
  let s = act(make(), 1, { type: "flip", characterId: "gwen" }).state;
  assert.deepEqual(s.down[1], ["gwen"]);
  assert.deepEqual(s.down[0], []);
  assert.equal(g.getPlayerView(s, 0).theirDownCount, 1);
  assert.ok(!JSON.stringify(g.getPlayerView(s, 0).yourDown).includes("gwen"));
  s = act(s, 1, { type: "flip", characterId: "gwen" }).state;
  assert.deepEqual(s.down[1], []);
  assert.equal(s.turn, 0, "flipping never changes whose turn it is");
});

test("flip down everyone who doesn't match an answer", () => {
  let s = act(make(), 0, { type: "ask", questionId: "glasses" }).state; // yes
  assert.match(act(s, 0, { type: "flipNonMatching", questionId: "hat" }).error, /haven't asked/);
  s = act(s, 0, { type: "flipNonMatching", questionId: "glasses" }).state;
  const up = g.getPlayerView(s, 0).characters.filter((c) => !s.down[0].includes(c.id));
  assert.ok(up.every((c) => c.glasses));
  assert.ok(up.some((c) => c.id === "felix"));
});

test('new illustrated roster preserves secret answers and legacy saved games', () => {
  const legacy = make();
  assert.equal(g.getPlayerView(legacy, 0).characters.length, 24);
  const current = g.createGame({wrongGuess:'lose'}, [{name:'A'},{name:'B'}], 'illustrated');
  assert.equal(g.getPlayerView(current,0).characters.length,30);
  assert.equal(new Set(CHARACTERS.map(c => c.artIndex)).size,30);
  for(const secret of CHARACTERS) for(const question of QUESTIONS) {
    const state={...current,secret:[secret.id,secret.id],turn:0};
    const asked=act(state,0,{type:'ask',questionId:question.id}).state;
    assert.equal(asked.asked.at(-1).answer,!!question.test(secret));
    const flipped=act(asked,0,{type:'flipNonMatching',questionId:question.id}).state;
    assert.equal(flipped.down[0].includes(secret.id),false);
  }
});

test("right guess wins", () => {
  const r = act(make(), 0, { type: "guess", characterId: "felix" });
  assert.equal(g.isGameOver(r.state), true);
  assert.equal(g.score(r.state).winner, 0);
  assert.match(g.score(r.state).summary, /Felix, after 0 questions/);
});

test("wrong guess: loses under the standard rule", () => {
  const r = act(make("lose"), 0, { type: "guess", characterId: "gwen" });
  assert.equal(g.isGameOver(r.state), true);
  assert.equal(g.score(r.state).winner, 1);
});

test("wrong guess: gentler rule just passes the turn and flips that face down", () => {
  const r = act(make("turn"), 0, { type: "guess", characterId: "gwen" });
  assert.equal(g.isGameOver(r.state), false);
  assert.equal(r.state.turn, 1);
  assert.ok(r.state.down[0].includes("gwen"));
  assert.ok(!g.legalActions(r.state, 0).some((a) => a.characterId === "gwen"));
});

test("unknown question or person is refused", () => {
  assert.match(act(make(), 0, { type: "ask", questionId: "x" }).error, /Choose one of the questions/);
  assert.match(act(make(), 0, { type: "guess", characterId: "x" }).error, /Choose a person/);
});
