# Look & Remember: rules (BrainBox-style memory game)

This is an original picture-memory game. All pictures, titles and questions are our own.

- **Content pack:** `server/games/memory/cards.json`, version 1, with 12 picture cards. The format is described at the top of the file.
  - Each card is a list of items: kind, colour, position, and optional text such as a sign's word, a door number or a clock time.
  - Each card has exactly **six** questions.
  - Pictures are drawn by the app from the items, so there's no artwork to license.
- **Verifiable answers:** questions aren't typed in with answers. Each one is a *type*:
  - how many of a kind;
  - what colour (for a kind there's exactly one of);
  - was there a …;
  - what was written on the sign, door or clock;
  - day or night.
  The answer is **computed from the card's items**, so it can't disagree with the picture. Multiple-choice options are picked deterministically, and tests check that every option list contains the right answer exactly once.
- **Adding cards:** add an entry to `cards.json`. Tests reject a card without exactly 6 questions, an unknown kind or colour, an item outside the picture, or a question that doesn't fit the card (for example "what colour was the cat" when there are two cats).
- **Turns:**
  - Players take turns. On your turn you study a picture. The other player can watch.
  - Study time is **10, 20 or 30 seconds, or untimed (practice)**. Both players agree in the lobby, because changing it resets both Ready buttons.
  - You can press "I'm ready" early.
  - Then the picture is hidden, the server rolls a six-sided dice (1–6), and the matching question from that card is asked. Every card has 6 questions, so the dice always picks one that exists.
  - You choose an answer. A right answer scores 1 point.
- **Reveal:** the answer and the picture are shown again. Either player can **flag the question as unclear**. It's saved in the `reports` table for checking (`node scripts/show-reports.js`), and scoring isn't changed.
- **Game length:** 3 or 5 pictures each, with no picture repeated. The higher total wins, and equal totals are a tie.
- **Simplification:** the study countdown runs on the studying player's device. If they reload the page mid-study, the countdown starts again. That's harmless in a family game, and it's noted here for honesty.
