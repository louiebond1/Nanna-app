"use strict";
// Checks every registered game against the engine contract with random
// full playthroughs: always someone to move, legal actions accepted, no input
// mutation, JSON round trip, and a scored ending.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createRegistry } = require("../../server/games");
const { createBot } = require("../bot");

const players = [{ seat: 0, name: "Nanna" }, { seat: 1, name: "Sam" }];

for (const engine of createRegistry().values()) {
  test(`${engine.id}: random games reach a scored ending`, () => {
    const settings = engine.normaliseSettings({ ...engine.defaultSettings });
    assert.ok(!settings.error, settings.error);
    for (let i = 0; i < 60; i++) {
      let state = engine.createGame(settings, players, `conf-${engine.id}-${i}`);
      let steps = 0;
      const pick = createBot(`pick-${i}`);
      while (!engine.isGameOver(state)) {
        const options = [0, 1].flatMap((seat) =>
          engine.legalActions(state, seat).filter((a) => !a.input).map((a) => ({ seat, a })));
        assert.ok(options.length > 0, `${engine.id} stuck at step ${steps}, seed ${i}`);
        const { seat, a } = pick(options);
        const before = JSON.stringify(state);
        const { label, ...move } = a;
        const out = engine.applyAction(state, seat, move);
        assert.ok(!out.error, `${engine.id}: legal action refused: ${out.error} ${JSON.stringify(move)}`);
        assert.equal(JSON.stringify(state), before, `${engine.id} mutated its input`);
        state = engine.restore(JSON.parse(JSON.stringify(engine.serialize(out.state))));
        assert.ok(++steps < 10000, `${engine.id} game too long`);
      }
      const sc = engine.score(state);
      assert.ok(sc.summary && typeof sc.scores[0] === "number" && typeof sc.scores[1] === "number");
      assert.ok(sc.winner === null || sc.winner === 0 || sc.winner === 1);
      for (const seat of [0, 1]) assert.deepEqual(engine.legalActions(state, seat), []);
    }
  });
}
