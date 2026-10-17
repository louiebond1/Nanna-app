// Talks to the server. Has no DOM code, so a redesign never touches this file.
//
// - Reconnects automatically and re-joins the saved seat (resume).
// - Every move gets a unique actionId. If the network drops before the server
//   answers, the same move is re-sent after reconnecting; the server applies
//   it at most once.
import { io } from "/socket.io/socket.io.esm.min.js";
import { loadSession, saveSession, clearSession } from "./session.js";

const ACK_TIMEOUT_MS = 8000;

// crypto.randomUUID needs HTTPS; getRandomValues also works over plain http on a home network.
function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createConnection({ onState, onStatus, onGone }) {
  const socket = io({ reconnectionDelayMax: 4000 });
  let session = loadSession();
  let latest = null;
  const pending = new Map(); // actionId -> { payload, resolve }

  const call = (event, payload) =>
    new Promise((resolve) => {
      socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, res) => {
        resolve(err ? { error: "The connection is slow. Trying again…", timeout: true } : res);
      });
    });

  const sendPending = (id) => {
    const p = pending.get(id);
    if (!p || !socket.connected) return;
    call("game:action", p.payload).then((res) => {
      if (res.timeout) return; // retried on the next reconnect
      pending.delete(id);
      p.resolve(res);
    });
  };

  socket.on("connect", async () => {
    onStatus("connected");
    if (session) {
      const res = await call("room:resume", session);
      if (res.error && !res.timeout) {
        clearSession();
        session = null;
        onGone(res.error);
        return;
      }
      for (const id of pending.keys()) sendPending(id);
    }
  });
  socket.on("disconnect", () => onStatus("reconnecting"));
  socket.io.on("reconnect_attempt", () => onStatus("reconnecting"));
  socket.on("room:state", (state) => {
    latest = state;
    onState(state);
  });
  socket.on("room:gone", ({ message }) => {
    clearSession();
    session = null;
    latest = null;
    onGone(message);
  });

  const enter = async (event, payload) => {
    const res = await call(event, payload);
    if (res.ok) {
      session = { roomId: res.roomId, token: res.token };
      saveSession(session);
    }
    return res;
  };

  return {
    hasSession: () => !!session,
    createRoom: (name) => enter("room:create", { name }),
    joinRoom: (room, name) => enter("room:join", { room, name }),
    chooseGame: (gameId, settings) => call("lobby:choose", { gameId, settings }),
    setReady: (ready) => call("lobby:ready", { ready }),
    rematch: () => call("game:rematch", {}),
    leave: async () => {
      const res = await call("room:leave", {});
      clearSession();
      session = null;
      latest = null;
      return res;
    },
    // Resolves with the server's answer to this move (after any retries).
    sendMove(move) {
      const actionId = newId();
      const payload = { actionId, version: latest?.match?.version, move };
      return new Promise((resolve) => {
        pending.set(actionId, { payload, resolve });
        sendPending(actionId);
      });
    },
  };
}
