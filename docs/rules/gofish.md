# Go Fish: house rules (two players)

These are ported from the owner's Dobble app (`dobble-app/docs/GO_FISH_RULES.md`), minus the CPU opponent. The engine is in `server/games/gofish/`.

- **Deal:** one 52-card deck, no jokers. 7 cards each, and the other 38 go face down in the pond. The starting player is chosen at random by the server.
- **Books:** a book is all four cards of one rank. Books are removed automatically after the deal, after a transfer and after a draw. Books made in the deal don't count for the "most recent book" tiebreak.
- **Asking:**
  - You may only ask for a rank you hold.
  - If the other player has any, they hand over **all** of them, and you normally ask again.
  - If they have none, you draw one card from the pond. If it's the rank you asked for (a **Lucky Catch**), you normally ask again. Any other card ends your turn, even if it completes a book.
- **Empty hand:** if your hand is empty when it's your turn and the pond has cards, you automatically take one replacement card and carry on.
- **Closing Phase:** once the pond is down to **5 cards**:
  - the move that got it there finishes first;
  - from then on, each turn is exactly one ask, so successful asks and Lucky Catches no longer give another turn;
  - the player who would normally act next goes first.
- **Final Round:** once the last pond card is drawn:
  - the current move finishes first;
  - each player then gets exactly one more ask, with the player who would normally act next going first;
  - a failed ask draws nothing;
  - an empty-handed player's final turn is skipped;
  - the game then ends.
- **Early end:** if all 13 books are made, the game ends at once.
- **Winner:** the player with more books wins. If books are tied, more cards left in hand wins. If that's tied too, whoever made the most recent in-play book wins. Otherwise it's a draw.
- **Privacy:**
  - The pond order and the other player's hand are never sent to a client.
  - A drawn card is shown only to the player who drew it. A Lucky Catch reveals only the rank, which is already public because it was asked for.
  - Both hands are revealed at the end.
