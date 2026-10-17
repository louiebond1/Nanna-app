# Nanna Games: plan, decisions and progress ledger

Status (17 October 2026): **the platform and all 11 games are implemented, tested and pushed.** See the ledger in section 5 for exactly what was verified and how. Technical details are in [HANDOFF.md](HANDOFF.md), and the rules of each game are in [rules/](rules/).

## 1. Audit

- `louiebond1/nanna-app` (since renamed `Nanna-app` on GitHub) was empty, so this is a standalone project.
- The owner's other project, `louiebond1/dobble-app`, has a working stack:
  - Node 22 and Express
  - Socket.IO
  - `node:sqlite`
  - `node --test`
  - Railway
- This project reuses **the same stack and conventions**, but not its code or deployment, so Dobble isn't affected.

## 2. Decisions

| # | Decision | Made by |
|---|---|---|
| D1 | Host on a **new Railway project** (`nanna-games`) in the owner's account, with a volume at `/data` for SQLite | Owner |
| D2 | Go Fish uses the **Dobble app's rules** (Closing Phase, Final Round, tiebreaks) | Owner |
| D3 | The other card games use the standard rules written in `docs/rules/*.md`, because no family house rules were given. Settings cover the main variations: shared-word scoring, wrong-guess penalty, game length | Defaulted |
| D4 | Original branding for the games named after commercial products: **Colour Clash** (Uno-style), **Fleet Finder** (Battleship-style), **Who's Who** (Guess Who-style), **Letter Wheel** (WordStorm-style), **Word Grid** (Boggle-style), **Look & Remember** (BrainBox-style), **Island Conquest** (Risk-inspired). Go Fish, Cheat, Gin Rummy and Canasta are traditional public-domain games | Claude |
| D5 | Dictionary: SCOWL (general + British, size 50 to accept, size 35 for puzzles and "missed words"), stored locally. Proper nouns, abbreviations and hyphenated words excluded; plurals allowed; offensive words removed | Claude |
| D6 | No accounts. Private rooms with a 128-bit id in the invite link, plus a 6-character code. Each device keeps a secret seat token | Claude |

## 3. Architecture (summary)

- **Server-authoritative:**
  - Clients send moves. The server checks each one with the game's engine, saves it, then sends each player only their own view.
  - The full game state and the random seed never leave the server.
- **Engine contract:** each game in `server/games/<id>/` implements `createGame`, `legalActions`, `applyAction`, `getPlayerView`, `isGameOver`, `score`, `serialize` and `restore`. See `server/engine/contract.js`.
- **Safe to retry:**
  - Every move has an `actionId`, so a repeated move is applied once.
  - A move made from an out-of-date screen is refused and the latest state is sent instead.
  - Moves both players make at the same time (placing ships, finding words) are exempt from the out-of-date check.
- **Randomness:** a seeded generator on the server, whose state is stored inside the game state. Tests use fixed seeds.
- **Saving:** SQLite, with each room's state written as part of every move. Migrations are numbered (two so far). Reconnecting, refreshing, device sleep and a server restart all resume the exact turn.

## 4. Delivery

| Phase | Status |
|---|---|
| A: audit and plan | Done |
| B: platform | Done |
| C: Go Fish vertical slice | Done |
| D: remaining ten games | Done |
| E: hardening and handoff | Done, apart from the items under "Not verified" below |

## 5. Progress ledger

### How things were tested

- **Automated** (`npm test`, 182 tests):
  - unit tests for every game's rules: legal and illegal moves, turn order, endings, scoring, ties, edge cases, hidden information;
  - a **conformance test** that plays 60 random full games of every game through the engine contract;
  - an **end-to-end test** that, for every game, has two real Socket.IO clients create a room, play a whole game over the network, check every payload for the other player's secrets, see the result and rematch;
  - platform tests for create/join, disconnect and reconnect, refresh, duplicate moves, simultaneous taps, out-of-date screens, server restart, leaving and rate limits.
- **Browser QA** (`scripts/qa/run.sh games|platform|accessibility`):
  - Two headless Chromium windows side by side: iPad-sized 820×1180 and iPhone-sized 390×844.
  - Every game is played to the end **by tapping the real screens**, then the results are checked and a rematch is started.
  - Invalid moves are checked for plain-English messages.
  - The platform run covers refresh mid-game, **server restart mid-game**, opponent offline, reopening without the link, leaving, and a bad code.
- **Accessibility:** axe-core (WCAG 2 A/AA plus best practice) on the home screen, the lobby and the opening screen of every game, on both window sizes, in light and dark mode. That's 48 screens, with **0 violations** after the fixes below.
- Screenshots of the main states are in `docs/screenshots/`, and the raw QA output is in `docs/qa-log.txt`.

### Per-game matrix

| Game | Implemented | Unit tests | Network e2e | UI playthrough | Known limitations / simplifications |
|---|---|---|---|---|---|
| Go Fish | Yes | 20 | Yes | Yes | No CPU opponent (two humans only). |
| Fleet Finder (Battleship-style) | Yes | 9 | Yes | Yes | Turns always alternate, hit or miss. |
| Colour Clash (Uno-style) | Yes | 13 | Yes | Yes | No Wild Draw Four challenge; no stacking; starting card is always a number. |
| Cheat | Yes | 11 | Yes | Yes | The rank sequence is strict (Ace up to King, then round again). |
| Gin Rummy | Yes | 14 | Yes | Yes | No first-turn upcard offer, Big Gin, or box/line bonuses. |
| Letter Wheel (WordStorm-style) | Yes | 8 | Yes (bot finishes without words) | Yes (real words typed) | Dictionary quality is SCOWL's; some obscure inflections ("trued") are accepted. |
| Word Grid (Boggle-style) | Yes | 8 | Yes (bot finishes without words) | Yes (word spelled by tapping) | 4×4 only. |
| Who's Who (Guess Who-style) | Yes | 10 | Yes | Yes | Questions come from a fixed list of 13 (no free-text questions). |
| Look & Remember (BrainBox-style) | Yes | 7 | Yes | Yes (including the timer running out) | 12 cards in the first content pack; the study countdown restarts if the page is reloaded mid-study. |
| Canasta | Yes | 20 | Yes (one-hand game) | Yes (one-hand game) | No concealed-going-out bonus; simplified stock exhaustion and starting discard. |
| Island Conquest (Risk-inspired) | Yes | 10 | Yes (10-round game) | Yes (10-round game) | No territory cards; dice count and armies moving in are automatic. Not official Risk rules. |

### Bugs found and fixed during QA

- Fleet Finder: after a failed ship placement, the next ship was wrongly selected.
- Gin Rummy: sets of exactly three weren't recognised as melds.
- Canasta:
  - taking the pile onto an existing meld ignored the incoming pile cards when checking the "keep two cards" rule;
  - the move list could offer moves the rules refused. Moves are now filtered through the rules.
- Who's Who:
  - both players saw "Your turn", because face-flipping counted as a move;
  - hats hid the hair colour;
  - the secret-person picture collapsed to zero width.
- Results banner: the winner saw "You won! Sam wins…".
- Island Conquest: map letters differed between the two devices; labels were too small on phones, so a list view was added.
- Opening a new invite link in the same tab did nothing until the page was reloaded.
- Contrast: unplayable Colour Clash cards and flipped Who's Who faces were faded below readable contrast.
- The action rate limit was low enough that a quick-tapping person could hit it.

### Deployment

- Railway project **`nanna-games`**, service `nanna-app`, region europe-west4, volume `nanna-data` mounted at `/data`, health check `/healthz`.
- URL: **https://nanna-app-production.up.railway.app**
- Railway reported the first deployment (platform only) as SUCCESS, with the health check passing and the volume mounted.
- Later pushes didn't trigger deploys, because the GitHub repo had been renamed. The service was reconnected to `louiebond1/Nanna-app`.
  - The deploy of commit `1829a60` (all 11 games) then reported **SUCCESS**. Its logs show the server starting on the existing volume with no errors (only Node's "SQLite is experimental" warning).
  - Pushes to `main` trigger deploys again: commit `2295079` (hardening) deployed automatically and reported **SUCCESS** at 15:11 UTC on 17 October 2026.

### Not verified (honest gaps)

- **No real iPad or iPhone has been used.** Testing used Chromium at those screen sizes. Safari on iOS (WebKit) has not been run.
- **No screen-reader walkthrough** (VoiceOver or TalkBack) has been done. axe-core checks markup, not the actual spoken experience.
- **The live site couldn't be opened from this build environment**, because its network blocks the Railway domain. Deployment status comes from Railway's own deploy and health-check reports, not from loading the page.
- The UI is deliberately plain and provisional, ready for the visual redesign. See HANDOFF.md.
