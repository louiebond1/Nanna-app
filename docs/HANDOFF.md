# Technical handoff

This is for whoever works on the code next, including the later visual redesign.

## Commands

```
npm install
npm start                        # http://localhost:3000, data in ./data
npm test                         # 182 tests: rules, conformance, two-client network e2e (~75 s)
node scripts/demo.js [gameId…]   # seeded demo rooms: prints a link per player for each game
node scripts/show-reports.js     # questions players flagged as unclear (Look & Remember)
node scripts/build-dictionary.js # rebuild server/words/data from SCOWL (dev dependency)
scripts/qa/run.sh games          # browser QA: play every game to the end through the UI
scripts/qa/run.sh platform       # browser QA: rooms, refresh, server restart, offline, rematch
scripts/qa/run.sh accessibility  # axe-core scan of every screen, light and dark mode
```

Requires Node 22.14 or later (`node:sqlite`). The browser QA needs Playwright with Chromium; set `PW_ROOT` to its install folder if it isn't installed globally.

Environment variables (see `.env.example`):
- `PORT`
- `DATA_DIR`: point it at a persistent volume in production.
- `ENTRY_LIMIT_PER_MINUTE`: create/join/resume per IP per minute, default 20.

No secrets are needed, and there are no paid APIs.

## Deployment (Railway)

- Project `nanna-games`, service `nanna-app` (europe-west4).
- It builds from GitHub `louiebond1/Nanna-app`, branch `main`, with Railpack (Node from `engines`). The start command is `npm start`.
- The health check is `GET /healthz`.
- Variables: `DATA_DIR=/data`, `NODE_ENV=production`.
- The volume `nanna-data` (5 GB) is mounted at `/data`. It holds `nanna.sqlite`, so rooms, games in progress, results and reports survive redeploys.
- The service runs one replica. That's required: SQLite and in-memory socket rooms assume a single process.
- Public URL: https://nanna-app-production.up.railway.app
- Pushing to `main` redeploys. If deploys stop after a GitHub repo rename, reconnect the service's source in Railway.

## Demo scenarios

`node scripts/demo.js` creates a started game of every kind, with players Nanna and Sam and a fixed seed (`SEED=…` to change it), so the cards, board or puzzle are the same each time. It prints two links per game.

Open each link in a separate browser window to be that player. The link carries the seat token after `#session=`. That part is never sent to the server, and the app removes it from the address bar on load. Use these links for demos only.

## Screenshots

`docs/screenshots/` holds the main states, captured by the QA scripts:
- lobby: `01-lobby-waiting-for-player`, `02-lobby-choose-and-ready`;
- your turn: `*-your-turn`;
- waiting: `04-waiting`;
- invalid move: `*-invalid-move`;
- results: `*-results`;
- reconnect: `05-reconnecting`, `06-opponent-offline`;
- game-specific: Go Fish hand, Fleet Finder board, Letter Wheel, Who's Who board, Look & Remember study and question, Gin hand-over, Cheat respond.

## Folder structure

| Path | What it is | Redesign may change? |
|---|---|---|
| `server/engine/` | Engine contract, seeded RNG, card helpers | No |
| `server/games/<id>/` | One folder per game: `index.js` (rules) plus data (`cards.json`, `characters.js`, `map.js`, `melds.js`) | No (content files: yes, carefully) |
| `server/games/index.js` | Registry of the 11 games | No |
| `server/words/` | Local British dictionary (`data/accept.txt`, `common.txt`, `blocked.txt`) | No |
| `server/rooms/service.js` | Rooms, lobby, matches, idempotent actions, reports | No |
| `server/socket.js` | Socket.IO protocol, rate limits | No |
| `server/store/db.js` | SQLite + migrations | No |
| `client/core/` | Connection, reconnect, saved session (no DOM) | No |
| `client/ui/tokens.css` | Colours, sizes, spacing | **Yes: start here** |
| `client/ui/base.css` | Base and per-game styles built on the tokens | **Yes** |
| `client/ui/components.js` | Presentational components: `bigButton`, `turnBanner`, `playerStatus`, `card`, `dice`, `tile`, `board`, `ruleHelp`, `confirmDialog` | **Yes**, keep the function signatures |
| `client/app.js` | Screen flow (home, lobby, game, results) | Layout yes, calls into `conn` no |
| `client/games/<id>.js` | Per-game screens: `render(match, ctx)`, optional `renderResults` | Yes; they only draw what the server sent and call `send()` |
| `docs/rules/<id>.md` | Exact house rules for each game | Keep in sync with the engine |
| `scripts/` | Demo, reports, dictionary build, browser QA | — |
| `test/` | Unit, conformance and end-to-end tests | — |

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

Rate limits: 20 create/join/resume per minute per IP. Other events: a burst of 60, then 10 per second per connection.

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

## Game events

`match.events` is a list of plain-English lines describing the last move ("Sam asked Nanna for Sevens.", "Dice: Nanna 6, 3; Sam 5, 5…"). Lines with `forSeat` (private news, for example "You drew the 7 of Hearts") are only sent to that player. The screens show them under "Last move", which is the single place to restyle, or to animate in future.

Each game's view shape is documented by its `getPlayerView` in `server/games/<id>/index.js`. Views contain only what that player may see. Tests check this for every game.

## Persistence

- One SQLite file: `DATA_DIR/nanna.sqlite`. Migration 2 added the `reports` table (flagged questions).
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

The current look is intentionally plain: large text and buttons, high contrast, no animation. Nothing about gameplay depends on it.

- Card faces are text and suit symbols. Colour Clash cards are coloured blocks with shapes. Who's Who faces and Look & Remember pictures are simple SVG drawings made in `client/games/whoswho.js` and `memory.js` from data, and can be replaced with illustrations that keep the same features.
- The Island Conquest map is SVG with HTML buttons on top. A drawn map could replace the background as long as each territory keeps its position.

- The final visual design: colours, type, card faces, illustrations.
- Animation for card moves and dice, with reduced-motion versions.
- Better layout on larger screens. Everything is currently a single column.
- Keyboard focus after a redraw is restored by id or button text (`client/app.js` `draw()`). A proper keyed renderer would be more robust.
