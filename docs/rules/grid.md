# Word Grid: rules (Boggle-style word search)

This is an original letter-grid word search. The name, letter tiles and wording are our own.

- **Grid:**
  - 4×4 letters picked at random by the server, weighted by roughly how often each letter is used in English.
  - Q always appears as **Qu**, which is one square worth two letters.
  - The server only deals grids with 4–8 vowels and at least 25 everyday words.
- **Both players search the same grid at the same time.** There's no time limit. Each player presses "I've finished" (with confirmation).
- **A valid word:**
  - has at least 3 letters;
  - can be traced through squares that touch (across, up/down or diagonally);
  - uses no square twice;
  - is in the dictionary. This is the same British dictionary as Letter Wheel: proper nouns, abbreviations and hyphenated words are excluded, and plurals are allowed.
- **Repeats:** you can't enter the same word twice.
- **Scoring (standard table):** 3–4 letters = 1, 5 = 2, 6 = 3, 7 = 5, 8 or more = 11.
- **Words both players find:**
  - **Standard rule (default):** they score nothing for either player.
  - **Gentler option:** they score for both. Both players agree on this in the lobby.
- **Results:** both word lists (with words you both found marked), the scores, and up to 40 everyday words nobody found.
- **Privacy:** you only see how many words the other player has found until the end. The answer list never leaves the server.
