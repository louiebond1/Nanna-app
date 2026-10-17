"use strict";
// Local British English dictionary (built from SCOWL by
// scripts/build-dictionary.js). Loaded once, on first use.
const fs = require("fs");
const path = require("path");

let accept = null;
let common = null;
let commonSet = null;
let trie = null;

function load() {
  if (accept) return;
  const read = (f) => fs.readFileSync(path.join(__dirname, "data", f), "utf8").split("\n").filter(Boolean);
  accept = new Set(read("accept.txt"));
  common = read("common.txt");
  commonSet = new Set(common);
}

// Lowercases and strips anything that isn't a letter.
const clean = (input) => String(input ?? "").toLowerCase().replace(/[^a-z]/g, "");

// Prefix tree of every acceptable word, for searching letter grids.
function getTrie() {
  load();
  if (!trie) {
    trie = {};
    for (const w of accept) {
      let node = trie;
      for (const ch of w) node = node[ch] ||= {};
      node.$ = true;
    }
  }
  return trie;
}

module.exports = {
  trie: getTrie,
  clean,
  isWord(w) { load(); return accept.has(w); },
  isCommon(w) { load(); return commonSet.has(w); },
  commonWords() { load(); return common; },
  acceptWords() { load(); return accept; },
};
