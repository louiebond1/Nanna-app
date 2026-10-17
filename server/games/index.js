"use strict";
// Registry of playable games. A game is added here only once its rules,
// multiplayer flow and tests work (see docs/PLAN.md progress ledger).
const { assertEngine } = require("../engine/contract");

const GAMES = [
  require("./gofish"),
  require("./fleet"),
  require("./clash"),
  require("./cheat"),
  require("./gin"),
];

function createRegistry(engines = GAMES) {
  const map = new Map();
  for (const e of engines) map.set(e.id, assertEngine(e));
  return map;
}

module.exports = { createRegistry };
