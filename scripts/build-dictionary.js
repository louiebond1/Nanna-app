"use strict";
// Builds the word lists in server/words/data from SCOWL (via the
// wordlist-english package, a dev dependency). Run once; the output is
// committed so production needs no download.
//
//   accept.txt: words a player may enter (SCOWL size 50, general + British)
//   common.txt: everyday words used to make puzzles and to show "words you
//               missed" (SCOWL size 35, general + British)
// Only lowercase a-z words of 3-16 letters are kept. That drops proper nouns,
// abbreviations, hyphenated words and words with apostrophes.
const fs = require("fs");
const path = require("path");

const src = path.dirname(require.resolve("wordlist-english/package.json"));
const out = path.join(__dirname, "..", "server", "words", "data");
const blocked = new Set(fs.readFileSync(path.join(out, "blocked.txt"), "utf8").split("\n").map((w) => w.trim()).filter(Boolean));

function collect(levels) {
  const words = new Set();
  for (const lvl of levels) {
    for (const kind of ["english", "british"]) {
      for (const w of JSON.parse(fs.readFileSync(path.join(src, `${kind}-words-${lvl}.json`), "utf8"))) {
        if (/^[a-z]{3,16}$/.test(w) && !blocked.has(w)) words.add(w);
      }
    }
  }
  return [...words].sort();
}

const accept = collect([10, 20, 35, 40, 50]);
const common = collect([10, 20, 35]);
fs.writeFileSync(path.join(out, "accept.txt"), accept.join("\n") + "\n");
fs.writeFileSync(path.join(out, "common.txt"), common.join("\n") + "\n");
fs.copyFileSync(path.join(src, "Copyright"), path.join(out, "SCOWL-COPYRIGHT.txt"));
console.log(`accept: ${accept.length} words, common: ${common.length} words`);
