"use strict";
// Move picker for automated playthroughs. Engines list real plays before
// fallbacks (drawing, passing), so the bot mostly takes the first option,
// sometimes one of the first few, and sometimes anything. Seeded, so a
// failure can be replayed.
const rng = require("../server/engine/rng");

function createBot(seed) {
  const r = rng.create(seed);
  return (options) => {
    const roll = rng.next(r);
    const pool = roll < 0.5 ? 1 : roll < 0.7 ? Math.min(3, options.length) : options.length;
    return options[rng.int(r, pool)];
  };
}

module.exports = { createBot };
