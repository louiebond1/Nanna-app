"use strict";
// Two real Socket.IO clients against a real server on a random port.
const test = require("node:test");
const assert = require("node:assert/strict");
const { io: connect } = require("socket.io-client");
const { createApp } = require("../server/app");
const { createRegistry } = require("../server/games");
const highcard = require("./fixtures/highcard");
const { tempFile } = require("./helpers");

const quiet = { error() {}, log() {} };

async function startServer(dataFile = tempFile()) {
  const app = createApp({ dataFile, games: createRegistry([highcard]), log: quiet });
  await new Promise((r) => app.server.listen(0, r));
  const url = `http://localhost:${app.server.address().port}`;
  const stop = async () => {
    app.io.close();
    await new Promise((r) => app.server.close(r));
    app.store.close();
  };
  return { ...app, url, dataFile, stop };
}

// A client that remembers every state it was sent.
function client(url) {
  const socket = connect(url, { transports: ["websocket"], forceNew: true, reconnection: false });
  const c = { socket, states: [], latest: null, waiters: [] };
  socket.on("room:state", (s) => {
    c.states.push(s);
    c.latest = s;
    c.waiters = c.waiters.filter((w) => !(w.pred(s) && (w.resolve(s), true)));
  });
  c.call = (event, payload = {}) => new Promise((r) => socket.emit(event, payload, r));
  c.until = (pred, ms = 2000) => {
    if (c.latest && pred(c.latest)) return Promise.resolve(c.latest);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timed out waiting for state")), ms);
      c.waiters.push({ pred, resolve: (s) => (clearTimeout(t), resolve(s)) });
    });
  };
  c.close = () => socket.disconnect();
  return new Promise((r) => socket.on("connect", () => r(c)));
}

async function startedPair(url) {
  const a = await client(url);
  const b = await client(url);
  const ra = await a.call("room:create", { name: "Nanna" });
  const code = (await a.until((s) => s.code)).code;
  const rb = await b.call("room:join", { room: code, name: "Sam" });
  await a.call("lobby:choose", { gameId: "highcard", settings: { handSize: 3 } });
  await a.call("lobby:ready", { ready: true });
  await b.call("lobby:ready", { ready: true });
  await a.until((s) => s.status === "playing");
  await b.until((s) => s.status === "playing");
  return { a, b, ra, rb };
}

const firstMove = (s) => ({ type: "play", cardId: s.match.legalActions[0].cardId });

test("create, join by code, both see each other connected", async () => {
  const srv = await startServer();
  const a = await client(srv.url);
  const b = await client(srv.url);
  const r = await a.call("room:create", { name: "Nanna" });
  assert.equal(r.ok, true);
  const code = (await a.until((s) => s.code)).code;
  assert.equal((await b.call("room:join", { room: code, name: "Sam" })).seat, 1);
  const s = await a.until((x) => x.players[1]?.connected);
  assert.equal(s.players[1].name, "Sam");
  assert.ok(s.players[0].connected);
  a.close(); b.close();
  await srv.stop();
});

test("actions before joining a room are refused", async () => {
  const srv = await startServer();
  const a = await client(srv.url);
  const r = await a.call("game:action", { actionId: "x", version: 0, move: { type: "play" } });
  assert.equal(r.noRoom, true);
  a.close();
  await srv.stop();
});

test("disconnect shows as offline; reconnect resumes the same seat and turn", async () => {
  const srv = await startServer();
  const { a, b, rb } = await startedPair(srv.url);
  await a.call("game:action", { actionId: "m1", version: 0, move: firstMove(a.latest) });
  const before = await b.until((s) => s.match.version === 1);
  b.close();
  await a.until((s) => s.players[1].connected === false);

  const b2 = await client(srv.url);
  const r = await b2.call("room:resume", { roomId: rb.roomId, token: rb.token });
  assert.deepEqual(r, { ok: true, roomId: rb.roomId, seat: 1 });
  const after = await b2.until((s) => s.match);
  assert.deepEqual(after.match.view, before.match.view);
  assert.equal(after.match.yourTurn, true);
  await a.until((s) => s.players[1].connected === true);
  assert.equal((await b2.call("room:resume", { roomId: rb.roomId, token: "bad" })).error !== undefined, true);
  a.close(); b2.close();
  await srv.stop();
});

test("the same action sent twice at once is applied once", async () => {
  const srv = await startServer();
  const { a, b } = await startedPair(srv.url);
  const payload = { actionId: "dup-1", version: 0, move: firstMove(a.latest) };
  const [r1, r2] = await Promise.all([a.call("game:action", payload), a.call("game:action", payload)]);
  assert.equal(r1.version, 1);
  assert.equal(r2.version, 1);
  const s = await b.until((x) => x.match.version === 1);
  assert.equal(s.match.view.opponentCardCount, 2);
  a.close(); b.close();
  await srv.stop();
});

test("both players tapping at once: only the player whose turn it is moves", async () => {
  const srv = await startServer();
  const { a, b } = await startedPair(srv.url);
  const bCard = b.latest.match.view.yourHand[0].id;
  const [ra, rb] = await Promise.all([
    a.call("game:action", { actionId: "a1", version: 0, move: firstMove(a.latest) }),
    b.call("game:action", { actionId: "b1", version: 0, move: { type: "play", cardId: bCard } }),
  ]);
  assert.equal(ra.ok, true);
  assert.ok(rb.error, "Sam's out-of-turn tap is refused");
  const s = await b.until((x) => x.match.version === 1);
  assert.equal(s.match.view.yourHand.length, 3);
  a.close(); b.close();
  await srv.stop();
});

test("a client with stale state is refused and sent the latest", async () => {
  const srv = await startServer();
  const { a, b } = await startedPair(srv.url);
  await a.call("game:action", { actionId: "s1", version: 0, move: firstMove(a.latest) });
  await b.until((x) => x.match.version === 1);
  const count = b.states.length;
  const r = await b.call("game:action", { actionId: "s2", version: 0, move: firstMove(b.latest) });
  assert.equal(r.stale, true);
  await b.until(() => b.states.length > count);
  assert.equal(b.latest.match.version, 1);
  a.close(); b.close();
  await srv.stop();
});

test("no payload sent to one player ever contains the other's secret cards", async () => {
  const srv = await startServer();
  const { a, b } = await startedPair(srv.url);
  const secrets = (c) => c.states.filter((s) => s.match).flatMap((s) => s.match.view.yourHand.map((x) => x.id));
  const bSecretsAtStart = new Set(b.latest.match.view.yourHand.map((c) => c.id));
  let version = 0;
  for (let turn = 0; turn < 6; turn++) {
    const p = turn % 2 === 0 ? a : b;
    const s = await p.until((x) => x.match.version === version && x.match.yourTurn);
    await p.call("game:action", { actionId: `t${turn}`, version, move: firstMove(s) });
    version++;
  }
  await a.until((s) => s.status === "finished");
  // Cards are only public once played; check every state a got before b played each one.
  for (const s of a.states.filter((x) => x.match && x.status === "playing")) {
    const playedByB = new Set(s.match.view.played[1].map((c) => c.id));
    const json = JSON.stringify(s);
    for (const id of bSecretsAtStart) if (!playedByB.has(id)) assert.ok(!json.includes(`"${id}"`), `${id} leaked`);
  }
  assert.ok(secrets(a).length > 0);
  a.close(); b.close();
  await srv.stop();
});

test("server restart: a client resumes into the exact same turn", async () => {
  const file = tempFile();
  let srv = await startServer(file);
  const { a, b, ra } = await startedPair(srv.url);
  await a.call("game:action", { actionId: "r1", version: 0, move: firstMove(a.latest) });
  const before = await a.until((s) => s.match.version === 1);
  a.close(); b.close();
  await srv.stop();

  srv = await startServer(file);
  const a2 = await client(srv.url);
  assert.equal((await a2.call("room:resume", { roomId: ra.roomId, token: ra.token })).seat, 0);
  const after = await a2.until((s) => s.match);
  assert.deepEqual(after.match.view, before.match.view);
  assert.equal(after.match.version, 1);
  a2.close();
  await srv.stop();
});

test("leaving on one device tells that player's other device", async () => {
  const srv = await startServer();
  const { a, b, rb } = await startedPair(srv.url);
  const b2 = await client(srv.url);
  await b2.call("room:resume", { roomId: rb.roomId, token: rb.token });
  const gone = new Promise((r) => b2.socket.on("room:gone", r));
  await b.call("room:leave");
  await gone;
  const s = await a.until((x) => x.players[1] === null);
  assert.equal(s.status, "lobby");
  a.close(); b.close(); b2.close();
  await srv.stop();
});

test("health check and security headers", async () => {
  const srv = await startServer();
  const res = await fetch(`${srv.url}/healthz`);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  assert.equal(res.headers.get("x-powered-by"), null);
  await srv.stop();
});
