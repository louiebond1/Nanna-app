"use strict";
// SQLite persistence (node:sqlite, so there's no native build step).
// Each room, with its lobby and its current match, is one JSON row, written
// in the same synchronous call that changed it. A crash or restart therefore
// never loses an acknowledged move.
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

// Append only. Never edit a migration that has shipped.
const MIGRATIONS = [
  `CREATE TABLE rooms(
     id TEXT PRIMARY KEY,
     code TEXT NOT NULL UNIQUE,
     data TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   );
   CREATE TABLE actions(
     room_id TEXT NOT NULL,
     action_id TEXT NOT NULL,
     seat INTEGER NOT NULL,
     result TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     PRIMARY KEY(room_id, action_id)
   );
   CREATE TABLE results(
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     room_id TEXT NOT NULL,
     game_id TEXT NOT NULL,
     finished_at INTEGER NOT NULL,
     players TEXT NOT NULL,
     outcome TEXT NOT NULL
   );
   CREATE INDEX results_room ON results(room_id, finished_at);`,
  // 2: things players report from inside a game, e.g. a flagged question.
  `CREATE TABLE reports(
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     room_id TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     report TEXT NOT NULL
   );`,
];

const ROOM_TTL_MS = 60 * 24 * 60 * 60 * 1000; // idle rooms kept 60 days
const ACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

class Store {
  constructor(file) {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    this.migrate();
    this.prune();
  }

  migrate() {
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY)");
    const done = new Set(this.db.prepare("SELECT version FROM schema_migrations").all().map((r) => r.version));
    MIGRATIONS.forEach((sql, i) => {
      const version = i + 1;
      if (done.has(version)) return;
      this.transaction(() => {
        this.db.exec(sql);
        this.db.prepare("INSERT INTO schema_migrations VALUES(?)").run(version);
      });
    });
  }

  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.db.exec("COMMIT");
      return out;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  prune(now = Date.now()) {
    this.db.prepare("DELETE FROM rooms WHERE updated_at < ?").run(now - ROOM_TTL_MS);
    this.db.prepare("DELETE FROM actions WHERE created_at < ?").run(now - ACTION_TTL_MS);
  }

  saveRoom(room) {
    this.db
      .prepare(
        `INSERT INTO rooms(id, code, data, updated_at) VALUES(?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
      )
      .run(room.id, room.code, JSON.stringify(room), room.updatedAt);
  }

  getRoom(id) {
    const row = this.db.prepare("SELECT data FROM rooms WHERE id=?").get(id);
    return row ? JSON.parse(row.data) : null;
  }

  getRoomIdByCode(code) {
    const row = this.db.prepare("SELECT id FROM rooms WHERE code=?").get(code);
    return row ? row.id : null;
  }

  codeInUse(code) {
    return !!this.db.prepare("SELECT 1 FROM rooms WHERE code=?").get(code);
  }

  getAction(roomId, actionId) {
    const row = this.db.prepare("SELECT seat, result FROM actions WHERE room_id=? AND action_id=?").get(roomId, actionId);
    return row ? { seat: row.seat, result: JSON.parse(row.result) } : null;
  }

  saveAction(roomId, actionId, seat, result, now = Date.now()) {
    this.db
      .prepare("INSERT INTO actions(room_id, action_id, seat, result, created_at) VALUES(?,?,?,?,?)")
      .run(roomId, actionId, seat, JSON.stringify(result), now);
  }

  saveResult(roomId, gameId, players, outcome, now = Date.now()) {
    this.db
      .prepare("INSERT INTO results(room_id, game_id, finished_at, players, outcome) VALUES(?,?,?,?,?)")
      .run(roomId, gameId, now, JSON.stringify(players), JSON.stringify(outcome));
  }

  saveReport(roomId, report, now = Date.now()) {
    this.db.prepare("INSERT INTO reports(room_id, created_at, report) VALUES(?,?,?)").run(roomId, now, JSON.stringify(report));
  }

  reports() {
    return this.db.prepare("SELECT room_id, created_at, report FROM reports ORDER BY id").all()
      .map((r) => ({ roomId: r.room_id, createdAt: r.created_at, ...JSON.parse(r.report) }));
  }

  recentResults(roomId, limit = 10) {
    return this.db
      .prepare("SELECT game_id, finished_at, players, outcome FROM results WHERE room_id=? ORDER BY id DESC LIMIT ?")
      .all(roomId, limit)
      .map((r) => ({
        gameId: r.game_id,
        finishedAt: r.finished_at,
        players: JSON.parse(r.players),
        outcome: JSON.parse(r.outcome),
      }));
  }

  close() {
    this.db.close();
  }
}

module.exports = { Store, MIGRATIONS };
