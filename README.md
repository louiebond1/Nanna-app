# Nanna Games

A private, two-player browser games app for Nanna and her grandson. Two devices join one private room with a link or short code, then play cards, word, deduction, strategy and memory games.

**Status:** the platform (rooms, lobby, turns, reconnect, saving) is built and tested. No real games are playable yet. See [docs/PLAN.md](docs/PLAN.md) for the plan and progress ledger, and [docs/HANDOFF.md](docs/HANDOFF.md) for technical details.

## Run it

```
npm install
npm start        # http://localhost:3000
npm test
```

Needs Node 22.14+. Stack: Express, Socket.IO, SQLite (`node:sqlite`), `node --test`.
