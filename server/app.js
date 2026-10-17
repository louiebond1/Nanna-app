"use strict";
const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { Store } = require("./store/db");
const { RoomService } = require("./rooms/service");
const { attachSockets } = require("./socket");
const { createRegistry } = require("./games");

function createApp({ dataFile, games = createRegistry(), log = console, limits } = {}) {
  const store = new Store(dataFile);
  const service = new RoomService({ store, games });
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    next();
  });
  app.get("/healthz", (req, res) => res.json({ ok: true }));
  app.use(express.static(path.join(__dirname, "..", "client"), { extensions: ["html"] }));

  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 16 * 1024, serveClient: true });
  attachSockets(io, service, { log, limits });

  return { app, server, io, store, service };
}

module.exports = { createApp };
