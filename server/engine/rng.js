"use strict";
// Seeded PRNG (sfc32). The server makes seeds with crypto; tests pass fixed ones.
// The generator state is plain numbers, so it can be saved inside game state.
const crypto = require("crypto");

function newSeed() {
  return crypto.randomBytes(16).toString("hex");
}

function seedToState(seed) {
  const h = crypto.createHash("sha256").update(String(seed)).digest();
  return [h.readUInt32LE(0), h.readUInt32LE(4), h.readUInt32LE(8), h.readUInt32LE(12)];
}

// Advances `rng` (an array of four uint32s) in place and returns a float in [0, 1).
function next(rng) {
  let [a, b, c, d] = rng;
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = (b ^ (b >>> 9)) >>> 0;
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  rng[0] = a; rng[1] = b; rng[2] = c; rng[3] = d;
  return t / 4294967296;
}

function int(rng, maxExclusive) {
  return Math.floor(next(rng) * maxExclusive);
}

function shuffle(rng, items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rollDie(rng, sides = 6) {
  return int(rng, sides) + 1;
}

function create(seed) {
  const rng = seedToState(seed);
  for (let i = 0; i < 12; i++) next(rng);
  return rng;
}

module.exports = { newSeed, create, next, int, shuffle, rollDie };
