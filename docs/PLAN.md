# Nanna Games: Phase A audit and build plan

Status: **Phase B (platform) done. No real games yet.** Technical details are in [HANDOFF.md](HANDOFF.md).

## 1. Audit

- `louiebond1/nanna-app` was empty when this plan was written. There's nothing to preserve, so this is a standalone project.
- The owner's other project, `louiebond1/dobble-app`, has a working stack:
  - Node 22 and Express
  - Socket.IO for real-time play
  - `node:sqlite` for persistence (no native build step)
  - `node --test` for tests
  - Railway for deployment
- We'll reuse **the same stack and conventions** but not the same code or deployment, so Dobble can't be destabilised.
- `dobble-app/docs/GO_FISH_RULES.md` already sets out a two-player Go Fish ruleset (Closing Phase, Final Round, tiebreaks). See decision D2.

## 2. Architecture

```
server/
  index.js            Express + Socket.IO bootstrap
  rooms/              room lifecycle, lobby, ready/settings/rematch
  store/              SQLite persistence + migrations
  engine/contract.js  engine interface + shared helpers (seeded RNG, deck)
  games/<game>/       one folder per game: rules.js, view.js, tests
client/
  core/               socket client, reconnect, state store (no UI)
  ui/tokens.css       design tokens (colours, sizes, spacing)
  ui/components/      Card, Dice, Tile, TurnBanner, PlayerStatus, ConfirmDialog, RuleHelp, BigButton
  games/<game>/       presentational screens only
docs/                 rules matrix, API contracts, state schemas, handoff notes
```

### Engine contract (every game implements it)

```
createGame(config, players, seed) -> state
legalActions(state, playerId)     -> action[]
applyAction(state, playerId, action) -> { state, events } | { error: "plain English" }
getPlayerView(state, playerId)    -> what that player is allowed to see
isGameOver(state)                 -> boolean
score(state)                      -> { perPlayer, winner, breakdown }
serialize(state) / restore(json)
```

- **Server-authoritative.** Clients send actions only. The server validates them, applies them, saves them, then sends each player their own `getPlayerView`. Full state never goes over the network.
- **Idempotent.** Every action carries a client-generated `actionId` and the room's `stateVersion`. Duplicates get the same result back. Stale versions get the current view back, not an error.
- **Randomness.** A seeded PRNG runs on the server, with the seed taken from `crypto.randomBytes`. Tests pass a fixed seed.
- **Rooms.** The room ID is 128-bit random and goes in the invite link. A short 6-character code (no confusable letters) is also offered, and join attempts are rate-limited. Display names are the only personal data.
- **Reconnect.** Each device stores a per-player secret token in `localStorage`. Refresh, sleep or a lost connection rejoins the exact same seat and turn.
- **Persistence.** One SQLite file holds rooms, matches (state JSON + version), an action log, and recent results. Schema changes go through numbered migrations. Production needs a Railway volume.

## 3. Rules matrix (proposed; see open decisions)

| Game | Proposed 2-player rules | Priority |
|---|---|---|
| Go Fish | Vertical slice. Ruleset per decision D2. | 1 |
| Battleship-style | 10×10 grid, 5 ships, random or manual placement, alternate shots, sunk announced. | 2 |
| Guess Who-style | 24 original illustrated characters. Yes/no questions picked from a list (no free text, so nothing can leak). Flip-down is private to each player. A wrong final guess loses. | 2 |
| Uno-style | 7 cards each. In 2-player, Reverse acts as Skip. Draw-stacking off by default. Wild +4 allowed at any time (no challenge rule). Single round or to 500. | 3 |
| Cheat | 26 cards each. Claim the next rank in sequence, 1–4 cards. Opponent may call Cheat. Loser of the challenge picks up the pile. First to empty their hand wins. | 3 |
| Gin Rummy | 10 cards. Knock at deadwood ≤10. Gin bonus 25, undercut bonus 25. Game to 100. | 4 |
| WordStorm-style | 7-letter wheel with a required centre letter, minimum 4 letters, British dictionary. Both play the same puzzle at their own pace, then compare. | 4 |
| Boggle-style | 4×4 original dice, adjacent-cell paths with no cell reused, minimum 3 letters. Untimed by default. Words both players found score 0. | 4 |
| BrainBox-style | Original illustrated cards. Study time 10, 20 or 30 seconds, or untimed (both players must agree). The die picks one of the card's 6 questions. Points for correct answers. | 5 |
| Canasta | 2-player variant: 15 cards each, draw 2 per turn, 2 canastas needed to go out. Game to 5000. | 6 |
| Risk-inspired | Original small map (about 12 territories, 3 regions), 2 players, plus a neutral player for balance. Phases: reinforce, attack, fortify. Win by eliminating the opponent or holding 2 regions. Not official Risk rules. | 7 |

Dictionary: SCOWL `en_GB` word list (permissive licence), stored locally. Proper nouns, abbreviations and hyphenated words are excluded. Plurals are allowed.

IP: every name, artwork item, character and question shown in the app will be original. Familiar game names are used only internally, as labels for the mechanics.

## 4. Delivery order

A plan → B platform → C Go Fish end to end → D games in priority order above → E hardening, QA, deploy, handoff.

## 5. Open decisions (need the owner)

- **D1 Hosting.** Should this be a new Railway project in the same account as Dobble, with a volume for SQLite?
- **D2 Go Fish.** Should we reuse the Dobble app's Go Fish rules (Closing Phase, Final Round, tiebreaks) or use plain classic Go Fish?
- **D3 House rules.** Does the family play any of the card games differently from section 3, especially Canasta, Uno and Cheat?

## 6. Progress ledger

### Platform (Phase B): done

| Area | Status | Evidence |
|---|---|---|
| Engine contract, seeded RNG, dice | Done | `test/engine.test.js` |
| Rooms: create, join by link or code, ready, settings agreement, rematch, leave | Done | `test/rooms.test.js` |
| Server validation, turn order, plain-English errors | Done | `test/rooms.test.js` |
| Idempotent actions, stale-state recovery, simultaneous taps | Done | `test/sockets.test.js` (two real clients) |
| Persistence across restart, exact turn kept | Done | `test/rooms.test.js`, `test/sockets.test.js` |
| Hidden info absent from every payload sent to the opponent | Done (tested with the test game) | `test/sockets.test.js` |
| Rate limits, security headers, unguessable ids | Done | `server/socket.js`, `server/app.js` |
| Shared UI components + design tokens | Done (provisional look) | `client/ui/` |

**Browser QA run on 17 Oct 2026:** headless Chromium, with an iPad-sized window (820×1180) and an iPhone-sized window (390×844) open side by side. This was **not** tested on a real iPad or iPhone. The test-only High Card game was used. Checks that passed:
- create room;
- join via the link;
- ready, then start;
- turn banners on both screens;
- refresh mid-game resumes the turn;
- **server restart mid-game** shows "Reconnecting", then both players resume the same turn;
- closing one page shows that player as offline;
- reopening the app without the link goes straight back into the game;
- play to the end, results, rematch;
- Leave asks for confirmation;
- an unknown code gets a plain-English message;
- no sideways scrolling on either size.

Screenshots are in `docs/screenshots/`.

**Not done yet:** deployment (waiting on D1), and an accessibility audit with a screen reader.

### Games

| Game | Implemented | Tested | Notes |
|---|---|---|---|
| Go Fish | No | No | Next. Waiting on D2. |
| Other 10 | No | No | |
