# Nanna Games: UI redesign brief

**The build is finished. Your job is the visual redesign only.**

Nanna Games is a private, two-player browser games app. The players are an 80-year-old grandmother (Nanna) and her grandson, each on their own device: an iPad, an iPhone or a computer.

- **Code:** GitHub `louiebond1/Nanna-app`, branch `main`.
- **Live:** https://nanna-app-production.up.railway.app (Railway redeploys on every push to `main`).

Everything below already works and is tested:
- private rooms with an invite link or a 6-letter code;
- lobby, turns, saving after every move, reconnecting, rematch;
- all 11 games, playable to the end.

The current look is deliberately plain and provisional: big text, big buttons, high contrast, no animation.

**The task:** rebuild the look and feel of every screen so it's warm, attractive and a pleasure to use, **without changing game rules, networking or saved data.**

---

## 1. Who it's for: design principles (these must hold)

1. **An 80-year-old is the main user.**
   - Body text at least 20px, with large headings.
   - Tap targets at least 56×56px. No small or fiddly controls, and no drag-and-drop that's required to play.
2. **High contrast.** WCAG AA minimum: 4.5:1 for text and 3:1 for large text and controls. Never fade text below that. Dim pictures or borders instead.
3. **Colour is never the only cue.**
   - Playing cards show the suit symbol *and* the suit name.
   - Colour Clash colours each have a shape: Red ▲, Yellow ●, Green ■, Blue ◆.
   - Map owners show a letter.
   - Keep or improve all of these.
4. **The next step is always obvious.**
   - The turn banner says "Your turn: …" or "Waiting for Sam…".
   - "Last move" says what just happened.
   - Error messages are plain English.
   - Keep all three prominent.
5. **Nothing relies on speed.** Look & Remember has an optional study timer; everything else is untimed.
6. **Works on an iPhone (390px wide) and an iPad (820px wide)** with no sideways scrolling, and looks good on a desktop too.
7. **Light and dark mode** both supported. Tokens already switch on `prefers-color-scheme`.
8. **Respect `prefers-reduced-motion`.** Animation is welcome but must be optional and calm.
9. **Keyboard and screen reader friendly.** Keep the visible focus ring, the `aria-label`s, `role`s and `aria-live` regions.
10. **Original branding only.** Don't use Uno, Battleship, Guess Who, Boggle, BrainBox, WordStorm or Risk names, logos, artwork or card designs. The app's own names are listed in section 4.

The tone should be friendly, cosy and dignified: a nice family games table, not childish and not a casino. A suggested direction, open to change: warm paper/felt background, a deep green or navy accent, a rounded friendly typeface, generous spacing, and cards that look like real cards.

---

## 2. What you may change, and what you must not

**You may change freely:**

| File | What it is |
|---|---|
| `client/ui/tokens.css` | Design tokens: colours, sizes, spacing, radius, fonts. **Start here.** |
| `client/ui/base.css` | All styles, including the per-game sections |
| `client/ui/components.js` | Shared presentational pieces (see below). Keep each function's **name and parameters** so the game screens keep working; change the markup and classes inside as you like |
| `client/app.js` | Screen layout for home, lobby, game and results. **Don't change** the calls to `conn.*` or the `attempt()`/`draw()` flow logic |
| `client/games/<id>.js` | One screen per game: `render(match, ctx)` and an optional `renderResults(match, ctx)` |
| `client/index.html` | Page shell, fonts, icons |

**You must not change** (tests cover them, and changing them breaks the game):
- `server/**`: rules, rooms, networking, saving;
- `client/core/**`: connection, reconnect, saved session;
- the data the screens receive;
- the moves screens send.

A screen **only draws** what the server sent and calls `send({ type, … })` with the same move shapes as today. It must never decide whether a move is legal. The server explains illegal moves in plain English, and the app shows that message.

**Technical rules:**
- No build step. Plain ES modules and CSS, served as static files.
- No external scripts or CDNs. The Content-Security-Policy is `default-src 'self'` and will block them.
- Self-host any web font in `client/` and reference it from CSS.
- Inline `style="…"` attributes are blocked by the CSP. Set dynamic values with `el.style.setProperty(...)` (the board and map code already does this) or with classes.
- Inline SVG built in JavaScript is fine; the pictures in `whoswho.js` and `memory.js` already work this way.
- Keep everything working without network access to anything but the app itself.

---

## 3. Shared components (`client/ui/components.js`)

`h(tag, attrs, ...children)` is a tiny DOM helper. Strings are always added as text, never as HTML.

| Function | Used for |
|---|---|
| `bigButton(label, onclick, { primary, disabled, block, ...attrs })` | All buttons |
| `turnBanner({ yourTurn, prompt, waitingFor })` | "Your turn: …" / "Waiting for …" |
| `playerStatus(player, { isYou })` | Name plus online/offline |
| `card(c, { onclick, selected, faceDown })` | Playing card (`c.rank`, `c.suit`: S H D C) |
| `dice(value)` | A die face |
| `tile(letter, { onclick, selected, disabled })` | Letter tile (word games) |
| `board(cells, { look, onclick, canClick, label })` | Square grid (Fleet Finder) |
| `ruleHelp(title, paragraphs)` | Collapsible "How to play" |
| `confirmDialog(message, { confirmLabel, cancelLabel })` | Promise of true/false, used before anything that can't be undone |

---

## 4. The screens to redesign

The **app-wide screens** live in `client/app.js`:
- **Home:** your name, "Start a room", and "Join a room" with a code. Invite links open a "You've been invited" version.
- **Lobby:**
  - players with online status;
  - the invite code, plus share/copy link (shown until the second player joins);
  - "Choose a game", listing the 11 games;
  - settings dropdowns for the chosen game;
  - "I'm ready" for each player;
  - Leave.
  - A nicer game picker would be welcome, for example cards with an icon, the name and a one-line blurb. The blurb comes from `games[].blurb`.
- **Game:** title, turn banner, error alert, "Last move" list, the game's own screen, players, Leave.
- **Results:** "You won!", "Sam won." or "It's a draw.", the summary line, any game-specific results, scores, "Play again" (rematch), "Choose a different game", and Leave.
- **Connection banner:** "Connection lost. Reconnecting… your game is saved."

**Game screens** (`client/games/<id>.js`). The data each screen gets is in `match.view`. Read the current file for exact field names.

| id | Name (shown to players) | Type | What's on screen now |
|---|---|---|---|
| `gofish` | Go Fish | Cards | Pond count, books, your hand (tap a card, then "Ask Sam for Sevens"), Closing Phase and Final Round notices |
| `clash` | Colour Clash (Uno-style) | Cards | Top card, colour to match, your hand (playable cards outlined, unplayable cards dashed), colour picker for Wilds, Draw/Keep button |
| `cheat` | Cheat | Cards | Pile count, rank to call, choose 1–4 cards, "Believe" or "Call Cheat!" |
| `gin` | Gin Rummy | Cards | Discard and stock, your hand grouped as sets, runs and deadwood with the points total, Discard/Knock (with confirmation), Next hand |
| `canasta` | Canasta | Cards | Pile/stock/frozen status, first-meld minimum, red Threes, suggested-move buttons, select cards to meld or discard, both players' melds with canasta badges |
| `wheel` | Letter Wheel (WordStorm-style) | Words | 7 letters in a 2-3-2 "wheel" with the middle letter highlighted, tap or type words, word list, "I've finished" |
| `grid` | Word Grid (Boggle-style) | Words | 4×4 letter tiles, tap neighbouring tiles (the order is numbered), type a word, word list, "I've finished" |
| `whoswho` | Who's Who (Guess Who-style) | Deduction | Your secret person, question buttons, answers with "Flip down everyone who doesn't match", a board of 24 drawn faces (SVG from features: hair, glasses, hat, beard, moustache, earrings, smile), guess mode |
| `fleet` | Fleet Finder (Battleship-style) | Strategy | Placement (choose ship, Across/Down, tap a square, or "Place my ships for me"), then fire at their board; • miss, ✕ hit |
| `islands` | Island Conquest (Risk-inspired) | Strategy | SVG map of 3 islands and 12 territories with HTML buttons for each territory (army count plus owner letter), plus a list view. Reinforce, attack (dice shown), move |
| `memory` | Look & Remember (BrainBox-style) | Memory | Study a picture (SVG drawn from items: apples, birds, boats, houses with door numbers, signs, clocks…), countdown, then the hidden picture, the die and multiple-choice answers, reveal, "Flag this question" |

**Artwork you're welcome to improve:**
- playing-card faces;
- Colour Clash cards;
- the Who's Who faces (keep each person's listed features visible, especially hair colour under hats);
- the Look & Remember pictures (each item must stay clearly countable and identifiable, because questions ask "how many birds" and "what colour was the boat");
- the Island Conquest map (keep each territory at its position);
- a logo or wordmark for "Nanna Games".

All of it must be original.

---

## 5. How to check you haven't broken anything

```
npm install
npm start                        # http://localhost:3000
npm test                         # must stay 182 passing
node scripts/demo.js             # prints a link per player for a started game of each kind
scripts/qa/run.sh games          # Playwright plays every game through the UI on tablet + phone sizes
scripts/qa/run.sh platform       # rooms, refresh, server restart, offline, rematch
scripts/qa/run.sh accessibility  # axe-core: must stay at 0 violations, light and dark
```

The browser QA scripts (`scripts/qa/*.mjs`) find things by visible text and a few classes. Examples:
- buttons labelled "Start a room", "I'm ready", "Play again", "Leave room", "Ask …", "Draw a card", "My ships are ready", "I've finished", "Next hand";
- classes such as `.banner-yours`, `.card`, `.ccard.playable`, `.cell`, `.tile`, `.lettergrid`, `.face`, `.terr`.

If you rename a label or class, update the QA script to match. Don't weaken it.

**Before and after:** screenshots of today's screens are in `docs/screenshots/`. Please save new ones in the same place.

**Done means:**
1. Every screen above has the new look, on iPhone and iPad sizes, in light and dark mode.
2. `npm test` passes, and all three QA runs pass with 0 accessibility violations.
3. The principles in section 1 still hold, especially text size, tap size, contrast and colour-plus-shape cues.
4. No game rules, server code or move shapes have changed.
5. You've listed what you changed, and anything you couldn't check. Testing on a real iPhone or iPad and with VoiceOver hasn't been done yet; say so if you can't do it either.

More background: `docs/HANDOFF.md` (structure, protocol, design TODOs), `docs/PLAN.md` (completion ledger) and `docs/rules/` (rules for each game).
