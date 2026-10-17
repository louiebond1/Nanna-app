# Screen-fitting game UI

Only the game-selection catalogue remains a scrolling page. Home, invites, game settings, play, results, help and room controls use screen-sized layouts.

## Behaviour

- A game header, turn banner and latest move stay above the playing area. The next actions stay below it. The game view selector and Previous/Next page buttons are always reachable.
- Cards, faces, territory lists, word lists and rules use explicit pages when they exceed the available space. Selection is preserved across hand pages. The selected-card count remains visible.
- Scores, pile information, the secret person, answers and other secondary information have named views. The Menu button opens room status and Leave; Back returns to play.
- Word games offer separate Letters and Type a word views. Look & Remember prioritises the picture while studying, keeps the optional countdown beside the ready action and uses a large answer grid.
- Fleet Finder uses the coordinate controls on phones and on short desktop windows. Tall tablets retain direct board taps. Ship setup is a named view. Island Conquest keeps actions available on its map as well as its full-sized territory list.
- Errors use an acknowledged native dialog so a long message cannot push a board or its actions below the screen. Existing confirmations remain native dialogs too.
- Layout responds to viewport changes, reconnect banners and the visual viewport when a keyboard opens. Controls remain at least 56px and body/control text remains at least 20px; no scaling down of the app is used.

The workspace moves original controls into paged layout wrappers. It does not clone their handlers or calculate move legality. Forms retain their submit handlers and field IDs. Room networking and move shapes remain intact.

## Countries and characters

- New Look & Remember games use twelve original illustrated country cards, with six questions derived from each card's own visible fields. Cards feature a flag, landmark, food illustration, labelled capital and sea/ocean, coloured traveller and countable birds. Study time defaults to unlimited; timed options remain available. The server withholds the card and correct answer during the question. Old scene card IDs remain resolvable for saved games.
- Who's Who uses original feature-driven vector portraits, a 24-person board, persistent Ask/Guess actions and a secret-person label. The question and answer views remain separate. Faces flip privately and can be restored. Shorter display names Bert, Hugh and Quinn keep labels legible; character IDs and traits stay stable.

## Verification

- `npm test`: 184 passed, zero failures, including the new country-deck and legacy-save tests.
- `scripts/qa/run.sh viewport`: 638 checks passed, zero failures, including every game view and its pages in light/dark at 390×667, 390×844, 820×1180 and 1024×768. Checks cover document scrolling, overflowing page contents, 56px targets and off-screen controls.
- Following the countries/portraits update, 332 further viewport checks passed in light/dark at 390×667 and 820×1180. Both updated games completed browser playthroughs, results and rematches. The memory timer and question flag flow passed too.
- Existing game, platform and axe scripts navigate through the public view selector and pager before using off-page controls. They do not invoke app internals, force clicks or bypass server rules. The game navigation helper also checks the fitted page after interactions.
- `scripts/qa/run.sh accessibility` checks both colour schemes. `scripts/qa/run.sh platform` covers rooms, refresh, restart/reconnect, offline, results, rematch and leaving.

Real Safari/iPhone/iPad hardware, physical on-screen keyboards and VoiceOver remain untested. Chromium emulation is the device evidence; it does not establish those physical-device results. Unusually small landscape windows or extreme browser text enlargement may need additional layout work.
