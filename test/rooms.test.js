"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeService, startedRoom, tempFile } = require("./helpers");
const { cleanName } = require("../server/rooms/service");

let n = 0;
const id = () => `action-${++n}`;
const legalFor = (service, roomId, seat) => service.viewFor(roomId, seat).match.legalActions;
const play = (service, roomId, seat, extra = {}) => {
  const v = service.viewFor(roomId, seat).match;
  const { type, cardId } = v.legalActions[0];
  return service.act(roomId, seat, { actionId: id(), version: v.version, move: { type, cardId }, ...extra });
};

test("create gives an unguessable id, a short code and a secret token", () => {
  const { service } = makeService();
  const r = service.createRoom("Nanna");
  assert.match(r.roomId, /^[0-9a-f]{32}$/);
  assert.match(r.token, /^[0-9a-f]{64}$/);
  const view = service.viewFor(r.roomId, 0);
  assert.match(view.code, /^[A-HJKMNP-Z2-9]{6}$/);
  assert.equal(view.players[0].name, "Nanna");
  assert.equal(view.players[1], null);
  assert.ok(!JSON.stringify(view).includes(r.token));
  assert.ok(!JSON.stringify(view).includes("tokenHash"));
});

test("join by code is forgiving about case and spaces; a third player is turned away", () => {
  const { service } = makeService();
  const a = service.createRoom("Nanna");
  const code = service.viewFor(a.roomId, 0).code;
  const messy = ` ${code.slice(0, 3).toLowerCase()} ${code.slice(3)} `;
  const b = service.joinRoom(messy, "Sam");
  assert.equal(b.seat, 1);
  assert.equal(service.joinRoom(code, "Extra").error, "This room already has two players.");
  assert.match(service.joinRoom("ZZZZZZ", "x").error, /couldn't find/);
});

test("names are cleaned and default sensibly", () => {
  assert.equal(cleanName("  <b>Nan</b>\n  na ", "P"), "bNan/b na");
  assert.equal(cleanName("", "Player 2"), "Player 2");
  assert.equal(cleanName("x".repeat(50), "P").length, 20);
});

test("resume needs the right token", () => {
  const { service } = makeService();
  const a = service.createRoom("Nanna");
  assert.equal(service.resume(a.roomId, a.token).seat, 0);
  assert.ok(service.resume(a.roomId, "wrong").error);
  assert.ok(service.resume("nope", a.token).error);
});

test("game starts only when both players are present and ready", () => {
  const { service } = makeService();
  const a = service.createRoom("Nanna");
  assert.equal(service.setReady(a.roomId, 0, true).error, "Choose a game first.");
  service.chooseGame(a.roomId, 0, "highcard", {});
  service.setReady(a.roomId, 0, true);
  assert.equal(service.viewFor(a.roomId, 0).status, "lobby");
  service.joinRoom(a.roomId, "Sam");
  service.setReady(a.roomId, 1, true);
  assert.equal(service.viewFor(a.roomId, 0).status, "playing");
});

test("changing settings resets ready so both players agree", () => {
  const { service } = makeService();
  const a = service.createRoom("Nanna");
  service.joinRoom(a.roomId, "Sam");
  service.chooseGame(a.roomId, 0, "highcard", { handSize: 3 });
  service.setReady(a.roomId, 0, true);
  service.chooseGame(a.roomId, 1, "highcard", { handSize: 1 });
  assert.deepEqual(service.viewFor(a.roomId, 0).lobby.ready, [false, false]);
  assert.match(service.chooseGame(a.roomId, 0, "highcard", { handSize: 9 }).error, /Hand size/);
  assert.match(service.chooseGame(a.roomId, 0, "monopoly", {}).error, /isn't available/);
});

test("only the player whose turn it is can move, and they get a plain-English reason", () => {
  const { service } = makeService();
  const { roomId } = startedRoom(service);
  assert.deepEqual(legalFor(service, roomId, 1), []);
  const v = service.viewFor(roomId, 0).match;
  const r = service.act(roomId, 1, { actionId: id(), version: v.version, move: { type: "play", cardId: v.view.yourHand[0].id } });
  assert.equal(r.error, "It's Nanna's turn.");
  const bad = service.act(roomId, 0, { actionId: id(), version: v.version, move: { type: "play", cardId: "nope" } });
  assert.equal(bad.error, "That card isn't in your hand.");
  assert.equal(service.viewFor(roomId, 0).match.version, 0);
});

test("opponent's hand never appears in a player's view", () => {
  const { service } = makeService();
  const { roomId } = startedRoom(service);
  const v0 = service.viewFor(roomId, 0);
  const v1 = service.viewFor(roomId, 1);
  const json0 = JSON.stringify(v0);
  for (const c of v1.match.view.yourHand) assert.ok(!json0.includes(`"${c.id}"`), `${c.id} leaked to seat 0`);
  assert.ok(!json0.includes("fixed-seed"), "seed leaked");
  assert.equal(v0.match.view.opponentCardCount, 3);
});

test("a repeated action ID is applied once and returns the same result", () => {
  const { service } = makeService();
  const { roomId } = startedRoom(service);
  const v = service.viewFor(roomId, 0).match;
  const input = { actionId: "same-id", version: v.version, move: { type: "play", cardId: v.legalActions[0].cardId } };
  const first = service.act(roomId, 0, input);
  const second = service.act(roomId, 0, input);
  assert.equal(first.version, 1);
  assert.equal(second.version, 1);
  assert.equal(second.duplicate, true);
  assert.equal(service.viewFor(roomId, 0).match.view.yourHand.length, 2);
  assert.ok(service.act(roomId, 1, input).error, "other seat can't replay my ID");
});

test("a move sent against an old version is rejected as stale, not applied", () => {
  const { service } = makeService();
  const { roomId } = startedRoom(service);
  play(service, roomId, 0);
  const v1 = service.viewFor(roomId, 1).match;
  const r = service.act(roomId, 1, { actionId: id(), version: 0, move: { type: "play", cardId: v1.legalActions[0].cardId } });
  assert.equal(r.stale, true);
  assert.equal(service.viewFor(roomId, 1).match.version, 1);
});

test("full game to a result, saved in history, then rematch starts fresh", () => {
  const { service } = makeService();
  const { roomId } = startedRoom(service);
  for (let i = 0; i < 6; i++) assert.equal(play(service, roomId, i % 2).ok, true);
  const done = service.viewFor(roomId, 0);
  assert.equal(done.status, "finished");
  assert.ok(done.match.outcome.summary);
  assert.equal(done.recentResults.length, 1);
  assert.equal(service.voteRematch(roomId, 0).ok, true);
  assert.equal(service.viewFor(roomId, 0).status, "finished");
  service.voteRematch(roomId, 1);
  const again = service.viewFor(roomId, 0);
  assert.equal(again.status, "playing");
  assert.equal(again.match.version, 0);
  assert.equal(again.match.view.yourHand.length, 3);
});

test("leaving mid-game returns the room to the lobby and frees the seat", () => {
  const { service } = makeService();
  const { roomId, b } = startedRoom(service);
  service.leave(roomId, 1);
  const v = service.viewFor(roomId, 0);
  assert.equal(v.status, "lobby");
  assert.equal(v.players[1], null);
  assert.equal(v.notice, "Sam left the room.");
  assert.ok(service.resume(roomId, b.token).error);
  assert.equal(service.joinRoom(roomId, "Alex").seat, 1);
});

test("restart keeps the exact turn, hands and version", () => {
  const file = tempFile();
  const first = makeService(file);
  const { roomId, a } = startedRoom(first.service);
  play(first.service, roomId, 0);
  const before = first.service.viewFor(roomId, 1);
  first.store.close();

  const second = makeService(file);
  assert.equal(second.service.resume(roomId, a.token).seat, 0);
  const after = second.service.viewFor(roomId, 1);
  assert.deepEqual(after.match, before.match);
  assert.equal(play(second.service, roomId, 1).ok, true);
  second.store.close();
});

test("migrations run once and are recorded", () => {
  const file = tempFile();
  makeService(file).store.close();
  const { store } = makeService(file);
  const rows = store.db.prepare("SELECT version FROM schema_migrations").all();
  assert.deepEqual(rows.map((r) => r.version), [1, 2]);
  store.close();
});
