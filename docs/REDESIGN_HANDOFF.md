# Nanna Games visual redesign

The app now uses warm paper and sage surfaces, forest green actions, a serif heading system and original line-art branding. Dark mode uses the same hierarchy with deep green surfaces and pale sage actions. All assets are local; no build step, font download, CDN or paid API is needed.

## Presentation changes

- Home has a clearer introduction and separate start/join panels. Invites, room codes, player status, last moves, errors and reconnect notices retain their existing wording and behaviour.
- The lobby has an illustrated game picker with every server-provided game blurb and an explicit chosen state.
- All eleven games share a framed playing surface. Cards, letter tiles, colour-and-shape cards, faces, memory pictures, dice and map controls use consistent spacing, borders and typography. Suit names, shape cues, owner initials, focus rings, live regions and confirmations remain.
- Results have a game illustration and clear outcome, scores and rematch actions.
- On phones, Fleet Finder shows a noninteractive board overview with large Row and Column selectors and a Choose square button. This calls the exact existing placement/fire callback. Tablet and desktop retain direct board taps. Previously tried squares are unavailable according to the existing view/canClick callback.
- On phones, Island Conquest shows a noninteractive overview at the same territory positions and uses the existing full-size territory list for input. Tablet/desktop keep the tappable map and list.
- Controls are at least 56px and body/control text is at least 20px. Motion is limited to a small button press response and respects reduced motion. No game timing was added.

No tracked server, networking, persistence, game-rule or move-shape changes were made. The optional SVG face and memory illustrations retain their original features and countable items.

## Checks

- `npm test`: **182 passed, 0 failed**, with locally reconstructed dictionary assets (see repository issue below).
- `scripts/qa/run.sh games`: all eleven games played to completion on 820px tablet and 390px phone; results and rematch passed. This run retained the production CSP.
- `scripts/qa/run.sh accessibility`: **48 screens, 0 violations**, both colour schemes, tablet and phone game views; additional checks for horizontal overflow and 56px controls.
- `scripts/qa/run.sh platform`: create/join, refresh, server restart/reconnect, opponent offline, resume, results, rematch, leave confirmation and invalid code. Its screenshots are scanned with axe in light and dark mode as well.
- QA now accepts optional `PW_EXECUTABLE_PATH` for an existing Chromium installation. It otherwise uses Playwright's default browser. Axe-injected runs bypass CSP for axe's own temporary styles; the game playthrough run does not bypass CSP.
- Screenshots are in `docs/screenshots/redesign/`; the original before screenshots are preserved. `playthrough/` includes in-game, error and results states; `platform/` includes light/dark room and connection states.

## Existing repository issue to resolve before deployment

A fresh checkout is missing **all** of `server/words/data/`, including `accept.txt`, `common.txt`, `blocked.txt` and the dictionary copyright file. The existing `.gitignore` pattern `data/` ignores this directory. The existing dictionary builder also cannot run without `blocked.txt`. As checked out, the word games cannot start and the test suite fails with ENOENT.

For local QA only, an empty **temporary** blocked list was supplied and the existing builder regenerated the SCOWL dictionaries from the pinned installed dependency: 61,320 accepted words and 39,087 common words. These are ignored files, not changes in this PR. This verifies UI integration but does not verify the intended blocked-word filtering or the deployed dictionary contents.

Recover the intended dictionary and blocked list from the existing build/deployment, then explicitly track those assets (or provide an equivalent reproducible build) as a separate backend/deployment fix. Do not replace the intended blocked list with the temporary empty local file. This visual branch is prepared for review rather than pushed to `main`, which would trigger Railway.

Real iPhone/iPad hardware, Safari, VoiceOver and testing with Nanna have not been performed. Automated Chromium phone/tablet emulation is the available device evidence. A physical-device and VoiceOver pass is still needed.
