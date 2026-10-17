# Nanna Games

A private, two-player browser games app for Nanna and her grandson. One person starts a room and sends the link (or a six-letter code). The other joins on their own phone, tablet or computer. Then you pick a game and both press Ready.

**Live:** https://nanna-app-production.up.railway.app (Railway project `nanna-games`)

## The games

| Cards | Words | Thinking | Memory |
|---|---|---|---|
| Go Fish | Letter Wheel | Who's Who | Look & Remember |
| Colour Clash | Word Grid | Fleet Finder | |
| Cheat | | Island Conquest | |
| Gin Rummy | | | |
| Canasta | | | |

Every game is two real people on separate devices.
- **Saving:** games save after every move. Refreshing, the device going to sleep, or a dropped connection carries on from the exact same turn.
- **Layout:** big text, big buttons, plain-English messages, and nothing that depends on speed.
- **Rules:** each game has a "How to play" section. The exact house rules are in [docs/rules/](docs/rules/).

## Run it yourself

```
npm install
npm start        # http://localhost:3000
npm test         # 182 automated tests
```

Needs Node 22.14+. Stack: Express, Socket.IO, SQLite (`node:sqlite`), `node --test`. No accounts, no paid services and no secrets.

## Documents

- [docs/PLAN.md](docs/PLAN.md): decisions, the per-game completion ledger, and what was and wasn't verified.
- [docs/HANDOFF.md](docs/HANDOFF.md): structure, protocol, engine contract, deployment, demo scenarios and notes for the visual redesign.
- [docs/rules/](docs/rules/): rules for each game.
