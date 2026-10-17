"use strict";
// Seeded demo scenarios: for each game, creates a room with Nanna and Sam,
// starts the game with a fixed seed (so the same cards/board every time) and
// prints one link per player. Open the two links in two browser windows.
//
//   DATA_DIR=./data node scripts/demo.js            all eleven games
//   DATA_DIR=./data node scripts/demo.js gofish     one game
//   BASE_URL=http://localhost:3000 SEED=demo-2 ...   other options
//
// The links carry each player's private session token after a "#", which the
// browser never sends to the server. Use them for local demos only.
const path = require("path");
const { Store } = require("../server/store/db");
const { RoomService } = require("../server/rooms/service");
const { createRegistry } = require("../server/games");

const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const seed = process.env.SEED || "demo-1";
const games = createRegistry();
const wanted = process.argv.slice(2);

const store = new Store(path.join(dir, "nanna.sqlite"));
const service = new RoomService({ store, games, newSeed: () => seed });
for (const engine of games.values()) {
  if (wanted.length && !wanted.includes(engine.id)) continue;
  const a = service.createRoom("Nanna");
  const b = service.joinRoom(a.roomId, "Sam");
  service.chooseGame(a.roomId, 0, engine.id, engine.defaultSettings);
  service.setReady(a.roomId, 0, true);
  service.setReady(a.roomId, 1, true);
  console.log(`${engine.title} (seed "${seed}")`);
  console.log(`  Nanna: ${base}/#session=${a.roomId}.${a.token}`);
  console.log(`  Sam:   ${base}/#session=${b.roomId}.${b.token}`);
}
store.close();
