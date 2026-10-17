// Maps a game id to its screen module. Each module exports
//   render(matchView, ctx) -> Node
// where ctx = { send(move), you, players, components }. Screens only draw what
// the server sent and call send(); they never decide whether a move is legal.
import * as generic from "./generic.js";

const screens = {};

export function screenFor(gameId) {
  return screens[gameId] || generic;
}
