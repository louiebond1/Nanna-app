"use strict";
// Every game module exports an engine with this shape. assertEngine() runs at
// startup so a game missing a method fails loudly instead of mid-match.
//
//   id, title, minPlayers, maxPlayers
//   defaultSettings, normaliseSettings(input) -> settings | { error }
//   createGame(settings, players, seed) -> state      players: [{ seat, name }]
//   legalActions(state, seat) -> [{ type, label, ...payload }]
//   applyAction(state, seat, action) -> { state, events } | { error }
//     must not mutate the state it was given; error is plain English
//   getPlayerView(state, seat) -> everything that seat may see, nothing more
//   isGameOver(state) -> boolean
//   score(state) -> { scores: { [seat]: number }, winner: seat | null, summary }
//   serialize(state) -> JSON-safe value, restore(value) -> state
const METHODS = [
  "normaliseSettings", "createGame", "legalActions", "applyAction",
  "getPlayerView", "isGameOver", "score", "serialize", "restore",
];

function assertEngine(engine) {
  if (!engine || typeof engine.id !== "string") throw new Error("Game engine needs an id");
  for (const m of METHODS) {
    if (typeof engine[m] !== "function") throw new Error(`Game "${engine.id}" is missing ${m}()`);
  }
  if (typeof engine.title !== "string") throw new Error(`Game "${engine.id}" needs a title`);
  return engine;
}

// Default serialize/restore for games whose state is already plain JSON.
const jsonState = {
  serialize: (state) => JSON.parse(JSON.stringify(state)),
  restore: (value) => JSON.parse(JSON.stringify(value)),
};

module.exports = { assertEngine, jsonState };
