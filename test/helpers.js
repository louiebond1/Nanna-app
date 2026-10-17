"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Store } = require("../server/store/db");
const { RoomService } = require("../server/rooms/service");
const { createRegistry } = require("../server/games");
const highcard = require("./fixtures/highcard");

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nanna-test-"));
  return path.join(dir, "test.sqlite");
}

function makeService(file = ":memory:", seed = "fixed-seed") {
  const store = new Store(file);
  const service = new RoomService({ store, games: createRegistry([highcard]), newSeed: () => seed });
  return { store, service };
}

// Two players in a room with High Card started.
function startedRoom(service) {
  const a = service.createRoom("Nanna");
  const b = service.joinRoom(a.roomId, "Sam");
  service.chooseGame(a.roomId, 0, "highcard", { handSize: 3 });
  service.setReady(a.roomId, 0, true);
  service.setReady(a.roomId, 1, true);
  return { roomId: a.roomId, a, b };
}

module.exports = { tempFile, makeService, startedRoom };
