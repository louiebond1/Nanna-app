# Letter Wheel: rules (WordStorm-style word puzzle)

This is an original letter-wheel puzzle. The name, wording and layout are our own.

- **Puzzle:**
  - Seven letters: one in the middle and six around it.
  - The server picks an everyday seven-letter word, then chooses which of its letters goes in the middle, so that the puzzle has between 12 and 60 everyday answers.
- **Both players play the same puzzle at the same time**, each at their own pace. There's no time limit and nothing is speed-based.
- **A valid word:**
  - has 4–7 letters;
  - includes the middle letter;
  - uses each wheel letter at most once (a letter that appears twice on the wheel can be used twice);
  - is in the dictionary.
- **Dictionary:**
  - Built locally from SCOWL (size 50, general and British English). See `server/words/data/SCOWL-COPYRIGHT.txt`.
  - Only lowercase a–z entries are kept, so **proper nouns, abbreviations, hyphenated words and words with apostrophes are excluded**.
  - **Plurals and other inflections are allowed** when SCOWL lists them.
  - British spellings ("colour") are accepted, and US-only spellings ("color") aren't.
  - A short list of offensive words is removed (`server/words/data/blocked.txt`).
- **Repeats:** you can't enter the same word twice. Both players may find the same word, and it counts for both.
- **Scoring:** 4 letters = 1, 5 = 2, 6 = 3, and all seven letters = 10. The higher total wins, and equal totals are a tie.
- **Ending:**
  - Each player presses "I've finished" and confirms.
  - When both have finished, both word lists are shown, along with the seven-letter word and the *everyday* words nobody found (from SCOWL size 35, so obscure words don't appear).
- **Privacy:**
  - Until the end, you only see how many words the other player has found, never which.
  - The answer list never leaves the server until the end.
