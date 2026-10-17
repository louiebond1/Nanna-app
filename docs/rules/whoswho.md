# Who's Who: rules (Guess Who-style)

This is an original deduction game. The 24 characters, their names and their pictures are our own. The pictures are drawn by the app from each character's features (`server/games/whoswho/characters.js`, `client/games/whoswho.js`).

- **Setup:** the server secretly gives each player a different person at random, and picks who asks first at random.
- **Your turn:** either
  - **ask one question** from a fixed list (glasses, hat, beard, moustache, earrings, smiling with teeth showing, long hair, bald, or hair colour: black, brown, blonde, ginger or grey); or
  - **make a guess**, which you confirm first.
- **Answers:**
  - The *server* answers each question truthfully from the secret person's features. Players never type answers, so nobody can answer wrongly by mistake and the secret is never sent to the asker's device.
  - Questions and answers are shown to both players.
  - Each question can be asked once per player.
- **Flipping faces:**
  - Each player has their own private board and can flip faces down (or back up) at any time, even on the other player's turn.
  - "Flip down everyone who doesn't match" does it automatically for any answered question.
  - The other player only sees how many faces you've flipped down, never which.
- **Guessing:**
  - A correct guess wins.
  - A wrong guess **loses the game** under the standard rule. Under the gentler option (agreed in the lobby), it just ends your turn and that face is flipped down.
- **Fairness check:** every one of the 24 characters has a different combination of answers, so the puzzle can always be solved. This is tested.
- **Hats:** hair under a hat is still shown at the sides, so hair-colour questions can be judged by eye.
