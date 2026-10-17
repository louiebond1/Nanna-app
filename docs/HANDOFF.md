# Technical handoff

This is for whoever works on the code next, including the later visual redesign.

## Commands

```
npm install
npm start                        # http://localhost:3000, data in ./data
npm test                         # unit + two-client socket integration tests
node scripts/dev-test-game.js    # QA server that also lists the test-only "High Card" game
```

Requires Node 22.14 or later (`node:sqlite`). Environment variables are listed in `.env.example`. No secrets are needed.

## Folder structure

| Path | What it is | Redesign may change? |
|---|---|---|
| `server/engine/` | Engine contract, seeded RNG, card helpers | No |
| `server/games/` | One folder per game + registry | No |
| `server/rooms/service.js` | Rooms, lobby, matches, idempotent actions | No |
| `server/socket.js` | Socket.IO protocol, rate limits | No |
| `server/store/db.js` | SQLite + migrations | No |
| `client/core/` | Connection, reconnect, saved session (no DOM) | No |
| `client/ui/tokens.css` | Colours, sizes, spacing | **Yes: start here** |
| `client/ui/base.css` | Base styles built on the tokens | **Yes** |
| `client/ui/components.js` | Presentational components | **Yes**, keep the function signatures |
| `client/app.js` | Screen flow (home, lobby, game, results) | Layout yes, calls into `conn` no |
| `client/games/` | Per-game screens (`render(match, ctx)`) | Yes |

## Socket protocol

Every client event takes `(payload, ack)`. The server acks with `{ ok: true, ... }` or `{ error: "plain English" }`.

| Event | Payload | Ack on success |
|---|---|---|
| `room:create` | `{ name }` | `{ roomId, seat, token }` |
| `room:join` | `{ room, name }` (`room` is the id or code) | `{ roomId, seat, token }` |
| `room:resume` | `{ roomId, token }` | `{ roomId, seat }` |
| `lobby:choose` | `{ gameId, settings }` | `{}` (resets both Ready flags) |
| `lobby:ready` | `{ ready }` | `{}` (starts the game when both players are present and ready) |
| `game:action` | `{ actionId, version, move }` | `{ version }`. Also `duplicate: true` on a repeat, or `stale: true` (an error) when `version` is old. |
| `game:rematch` | `{}` | `{}` (starts when both players have voted) |
| `room:leave` | `{}` | `{}` |

The server pushes:
- `room:state` with that seat's view (below), after every change and every connect or disconnect;
- `room:gone` when that seat no longer exists, for example after the player left on another device.

Rate limits: 20 create/join/resume per minute per IP, and about 3 actions per second per connection.

## `room:state` shape

```
{
  roomId, code, you,                       // you = your seat, 0 or 1
  status: "lobby" | "playing" | "finished",
  notice,                                  // plain-English line, or null
  players: [{ seat, name, connected } | null, ...],
  lobby: { gameId, settings, ready: [bool, bool] },
  rematch: [bool, bool],
  games: [{ id, title, blurb, defaultSettings, settingsOptions }],
  match: null | {
    gameId, title, settings, version,
    view,              // engine.getPlayerView for you only
    legalActions,      // [{ type, label, ... }]; empty when it isn't your turn
    yourTurn,
    events: [{ text }],// what the last move did, from your point of view
    outcome            // null, or { scores, winner, summary } when finished
  },
  recentResults: [{ gameId, finishedAt, players, outcome }]
}
```

`settingsOptions` (optional, per game): `{ key: { label, choices: [{ value, label }] } }`. The lobby renders these as dropdowns.

## Engine contract

This is documented at the top of `server/engine/contract.js` and checked at startup. Rules for every game:
- `applyAction` never mutates its input and returns `{ error }` in plain English for any illegal move. It must check legality itself, not trust the client.
- `getPlayerView` is the only place a client's data comes from. Never put the seed, the deck order or the opponent's hidden data in it.
- An event with `forSeat` is shown only to that seat. Use it for private news like "You drew the 7 of Hearts".
- Randomness comes only from `server/engine/rng.js`, with its state stored inside the game state. A given seed must replay identically.

## Persistence

- One SQLite file: `DATA_DIR/nanna.sqlite`.
  - `rooms`: one JSON row per room, including the serialized match and its version.
  - `actions`: action ids already applied, for idempotency. Kept for 7 days.
  - `results`: finished games.
- Rooms idle for 60 days are deleted.
- Schema changes are appended to `MIGRATIONS` in `server/store/db.js`. Never edit one that has shipped.

## Adding a game

1. Write `server/games/<id>/index.js` implementing the contract. Write the rules first in `docs/rules/<id>.md`.
2. Add tests in `test/games/<id>.test.js`. They must cover legal and illegal moves, turn order, the ending, scoring, ties and hidden-information views.
3. Register it in `server/games/index.js`.
4. Optionally add `client/games/<id>.js` and map it in `client/games/registry.js`. Without one, the generic big-button screen is used.

## Design TODOs (for the redesign pass)

- The final visual design: colours, type, card faces, illustrations.
- Animation for card moves and dice, with reduced-motion versions.
- Better layout on larger screens. Everything is currently a single column.
- Keyboard focus after a redraw is restored by id or button text (`client/app.js` `draw()`). A proper keyed renderer would be more robust.
