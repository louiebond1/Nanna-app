"use strict";
// Loads the Look & Remember content pack and works out every question's
// answer and multiple-choice options from the card's own items.
const path = require("path");
const fs = require("fs");

const pack = JSON.parse(fs.readFileSync(path.join(__dirname, "cards.json"), "utf8"));
const { countries, illustratedCountries } = require('./countries');
const NAMES = { apple: "apples", ball: "balls", balloon: "balloons", bird: "birds", boat: "boats", car: "cars", cat: "cats", clock: "clocks", cup: "cups", fish: "fish", flower: "flowers", house: "houses", sign: "signs", star: "stars", tree: "trees", umbrella: "umbrellas" };
const TEXT_Q = { sign: "What word was on the sign?", house: "What number was on the house door?", clock: "What time did the clock show?" };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// Returns { text, answer, options } or throws if the question doesn't fit the card.
function resolve(card, q) {
  const of = (kind) => card.items.filter((i) => i.kind === kind);
  const pick = (answer, pool) => {
    const others = [...new Set(pool.map(String))].filter((o) => o !== String(answer));
    // Deterministic distractors: order the other options by a hash of the
    // card, question and option, so the same card always shows the same choices.
    const hash = (str) => [...str].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const key = card.id + q.type + (q.kind || "");
    const chosen = others.sort((a, b) => hash(key + a) - hash(key + b)).slice(0, 3);
    const opts = [String(answer), ...chosen];
    return opts.sort((a, b) => (/^\d+$/.test(a) && /^\d+$/.test(b) ? a - b : a.localeCompare(b)));
  };
  switch (q.type) {
    case "country": {
      const value = card.country[q.field];
      const answer = q.field === 'shirt' ? cap(value) : String(value);
      const pool = q.options || (q.field === 'birds' ? ['1', '2', '3', '4'] : [...countries,...illustratedCountries].map(c => c.country[q.field]).filter(v => v != null).map(v => q.field === 'shirt' ? cap(v) : v));
      return { text: q.text, answer, options: pick(answer, pool) };
    }
    case "count": {
      const n = of(q.kind).length;
      return { text: `How many ${NAMES[q.kind]} were there?`, answer: String(n), options: pick(n, [n - 1, n + 1, n + 2, n - 2, n + 3].filter((x) => x >= 0)) };
    }
    case "colour": {
      const it = of(q.kind);
      if (it.length !== 1) throw new Error(`${card.id}: colour question needs exactly one ${q.kind}`);
      return { text: `What colour was the ${q.kind}?`, answer: cap(it[0].colour), options: pick(cap(it[0].colour), pack.colours.map(cap)) };
    }
    case "has": {
      const yes = of(q.kind).length > 0;
      return { text: `Was there a ${q.kind} in the picture?`, answer: yes ? "Yes" : "No", options: ["Yes", "No"] };
    }
    case "text": {
      const it = of(q.kind);
      if (it.length !== 1 || !it[0].text) throw new Error(`${card.id}: text question needs exactly one ${q.kind} with text`);
      const pool = { sign: ["PARK", "SHOP", "HAPPY", "ICES", "TOYS", "DUCKS", "TRAINS", "OPEN", "CAFE", "BAKERY"], house: ["3", "5", "7", "9", "12", "14", "16", "21"], clock: ["2:30", "4:00", "9:15", "10:45", "6:00", "12:00", "3:15", "8:30"] }[q.kind];
      return { text: TEXT_Q[q.kind], answer: it[0].text, options: pick(it[0].text, pool) };
    }
    case "sky":
      return { text: "Was it daytime or night-time?", answer: card.sky === "day" ? "Daytime" : "Night-time", options: ["Daytime", "Night-time"] };
    default:
      throw new Error(`${card.id}: unknown question type ${q.type}`);
  }
}

// Keep old card IDs resolvable for games already saved before the countries update.
const CARDS = [...pack.cards, ...countries, ...illustratedCountries].map((card) => ({ ...card, resolved: card.questions.map((q) => resolve(card, q)) }));

module.exports = { pack, CARDS, resolve };
