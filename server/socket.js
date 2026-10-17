"use strict";
// Socket.IO protocol. Every client event takes (payload, ack) and acks with
// { ok: true, ... } or { error: "plain English" }. The server pushes
// "room:state" with that seat's private view whenever the room changes.
const { RateLimiter } = require("./ratelimit");

function clientIp(socket) {
  const fwd = socket.handshake.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return socket.handshake.address;
}

function attachSockets(io, service, { log = console } = {}) {
  const entryLimit = new RateLimiter({ capacity: 20, refillPerSecond: 20 / 60 });
  const actionLimit = new RateLimiter({ capacity: 30, refillPerSecond: 3 });

  const connectedSeats = (roomId) => {
    const seats = [false, false];
    const ids = io.sockets.adapter.rooms.get(roomId);
    if (ids) for (const id of ids) {
      const s = io.sockets.sockets.get(id);
      if (s && s.data.roomId === roomId) seats[s.data.seat] = true;
    }
    return seats;
  };

  const broadcast = (roomId) => {
    const ids = io.sockets.adapter.rooms.get(roomId);
    if (!ids) return;
    const connected = connectedSeats(roomId);
    for (const id of ids) {
      const s = io.sockets.sockets.get(id);
      if (!s || s.data.roomId !== roomId) continue;
      const view = service.viewFor(roomId, s.data.seat, connected);
      if (view && view.players[s.data.seat]) s.emit("room:state", view);
      else {
        // This seat was removed (the player left on another device).
        s.emit("room:gone", { message: "You've left this room." });
        detach(s);
      }
    }
  };

  const detach = (socket) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.leave(roomId);
    socket.data.roomId = null;
    socket.data.seat = null;
  };

  const attach = (socket, roomId, seat) => {
    const old = socket.data.roomId;
    if (old && old !== roomId) {
      detach(socket);
      broadcast(old);
    }
    socket.data.roomId = roomId;
    socket.data.seat = seat;
    socket.join(roomId);
  };

  service.onChange(broadcast);

  io.on("connection", (socket) => {
    const ip = clientIp(socket);

    const handle = (event, { limit, needsRoom = true }, fn) => {
      socket.on(event, (payload, ack) => {
        const reply = typeof ack === "function" ? ack : () => {};
        if (!limit.take(limit === entryLimit ? ip : socket.id)) {
          return reply({ error: "That's a lot of taps in a row. Please wait a moment and try again." });
        }
        if (needsRoom && !socket.data.roomId) return reply({ error: "You're not in a room yet.", noRoom: true });
        try {
          reply(fn(payload && typeof payload === "object" ? payload : {}) || { ok: true });
        } catch (err) {
          log.error(`[${event}]`, err);
          reply({ error: "Something went wrong on our side. Your game is saved; please try again." });
        }
      });
    };

    const enter = (result) => {
      if (result.error) return result;
      attach(socket, result.roomId, result.seat);
      broadcast(result.roomId);
      return result;
    };

    handle("room:create", { limit: entryLimit, needsRoom: false }, (p) => enter(service.createRoom(p.name)));
    handle("room:join", { limit: entryLimit, needsRoom: false }, (p) => enter(service.joinRoom(p.room, p.name)));
    handle("room:resume", { limit: entryLimit, needsRoom: false }, (p) => {
      const r = enter(service.resume(p.roomId, p.token));
      return r.error ? r : { ok: true, roomId: r.roomId, seat: r.seat };
    });

    const here = () => [socket.data.roomId, socket.data.seat];

    handle("lobby:choose", { limit: actionLimit }, (p) => service.chooseGame(...here(), p.gameId, p.settings));
    handle("lobby:ready", { limit: actionLimit }, (p) => service.setReady(...here(), p.ready));
    handle("game:action", { limit: actionLimit }, (p) => {
      const [roomId, seat] = here();
      const r = service.act(roomId, seat, p);
      // A stale or duplicate client gets a fresh copy of the state.
      if (r.stale || r.duplicate) socket.emit("room:state", service.viewFor(roomId, seat, connectedSeats(roomId)));
      return r;
    });
    handle("game:rematch", { limit: actionLimit }, () => service.voteRematch(...here()));
    handle("room:leave", { limit: actionLimit }, () => {
      const [roomId, seat] = here();
      const r = service.leave(roomId, seat);
      detach(socket);
      broadcast(roomId);
      return r;
    });

    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      if (roomId) broadcast(roomId);
    });
  });

  return { broadcast };
}

module.exports = { attachSockets };
