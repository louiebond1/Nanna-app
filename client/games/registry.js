// Maps a game id to its screen module. Each module exports
//   render(matchView, ctx) -> Node
// where ctx = { send(move), you, players, components }. Screens only draw what
// the server sent and call send(); they never decide whether a move is legal.
import * as generic from "./generic.js";
import * as gofish from "./gofish.js";
import * as fleet from "./fleet.js";
import * as clash from "./clash.js";
import * as cheat from "./cheat.js";

const screens = { gofish, fleet, clash, cheat };

export function screenFor(gameId) {
  return screens[gameId] || generic;
}
