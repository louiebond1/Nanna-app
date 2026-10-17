# Gin Rummy: house rules (two players)

Gin Rummy is a traditional public-domain card game. This version uses the standard rules with the simplifications listed at the end.

- **Deal:**
  - 10 cards each, one card face up to start the discard pile, and the rest (31) as the stock.
  - The first player is chosen at random by the server, and alternates each hand.
- **Melds:**
  - A **set** is 3 or 4 cards of the same rank.
  - A **run** is 3 or more consecutive cards of one suit, with Ace low (A-2-3 is a run, Q-K-A isn't).
  - A card can only be in one meld. The app always works out the arrangement that leaves the least deadwood.
- **Deadwood:**
  - Cards not in a meld. Ace = 1, 2–10 = face value, J/Q/K = 10.
  - Your melds and your deadwood total are shown on screen at all times, so there's no adding up to do.
- **Your turn:**
  - Take the top card of the stock (face down) or of the discard pile, then discard one card.
  - You can't discard the card you just took from the discard pile.
- **Knocking:**
  - Instead of an ordinary discard, you may discard and **knock** if your remaining deadwood is 10 or less. You're asked to confirm first.
  - If it's 0, that's **Gin**.
- **Laying off:**
  - After a knock (not Gin), the other player's best melds are found automatically.
  - Any of their deadwood that extends the knocker's sets or runs is laid off automatically, which lowers their deadwood.
  - Runs can grow one card at a time.
- **Scoring a hand:**
  - **Knock:** if the knocker has less deadwood, they score the difference.
  - **Undercut:** if the other player has the same or less, they score the difference plus 25.
  - **Gin:** 25 plus all of the other player's deadwood. No laying off is allowed against Gin.
  - The full working is shown in the move log, for example "43 − 2 = 41 points".
- **Drawn hand:** if a player discards without knocking when the stock is down to 2 cards, the hand is a draw and nobody scores.
- **Game:**
  - First to 100 points (standard) or 50 points (shorter). Both players agree in the lobby.
  - After each hand, both see the result and either player presses "Next hand".
- **Simplifications** (on purpose):
  - There's no special first-turn "upcard" offer. The first player simply takes from the stock or the discard pile.
  - There's no "Big Gin", and no end-of-game box or line bonuses.
- **Privacy:**
  - The stock and the other player's hand are never sent to your device until the hand ends.
  - A card drawn from the stock is named only to the player who drew it. A card taken from the discard pile is public, as it would be at a real table.
