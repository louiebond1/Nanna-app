"use strict";
// Meld finding for Gin Rummy. Hands are at most 11 cards, so an exhaustive
// search over candidate melds is fast and always finds the best arrangement.
const { RANKS } = require("../../engine/cards");

const order = (c) => RANKS.indexOf(c.rank); // Ace low: A=0 ... K=12
const value = (c) => Math.min(order(c) + 1, 10); // A=1, 2-10 face value, J/Q/K=10
const deadwoodOf = (cards) => cards.reduce((s, c) => s + value(c), 0);

function candidateMelds(hand) {
  const melds = [];
  const byRank = {};
  for (const c of hand) (byRank[c.rank] ||= []).push(c);
  for (const group of Object.values(byRank)) {
    if (group.length >= 3) melds.push(group);
    if (group.length === 4) {
      for (let skip = 0; skip < 4; skip++) melds.push(group.filter((_, i) => i !== skip));
    }
  }
  const bySuit = {};
  for (const c of hand) (bySuit[c.suit] ||= []).push(c);
  for (const group of Object.values(bySuit)) {
    group.sort((a, b) => order(a) - order(b));
    for (let start = 0; start < group.length; start++) {
      const run = [group[start]];
      for (let j = start + 1; j < group.length && order(group[j]) === order(run[run.length - 1]) + 1; j++) {
        run.push(group[j]);
        if (run.length >= 3) melds.push(run.slice());
      }
    }
  }
  return melds;
}

// Best arrangement: { melds, deadwood (cards), points }.
function bestMelds(hand) {
  const cands = candidateMelds(hand);
  let best = { melds: [], deadwood: hand.slice(), points: deadwoodOf(hand) };
  const search = (from, used, chosen) => {
    const rest = hand.filter((c) => !used.has(c.id));
    const pts = deadwoodOf(rest);
    if (pts < best.points) best = { melds: chosen.slice(), deadwood: rest, points: pts };
    for (let i = from; i < cands.length; i++) {
      const m = cands[i];
      if (m.some((c) => used.has(c.id))) continue;
      m.forEach((c) => used.add(c.id));
      chosen.push(m);
      search(i + 1, used, chosen);
      chosen.pop();
      m.forEach((c) => used.delete(c.id));
    }
  };
  search(0, new Set(), []);
  return best;
}

// Can `card` extend `meld` (a set or a run)?
function fits(meld, card) {
  const isSet = meld.every((c) => c.rank === meld[0].rank);
  if (isSet) return meld.length < 4 && card.rank === meld[0].rank;
  if (card.suit !== meld[0].suit) return false;
  const lo = Math.min(...meld.map(order));
  const hi = Math.max(...meld.map(order));
  return order(card) === lo - 1 || order(card) === hi + 1;
}

// Defender's best result against the knocker's melds: tries every way of
// melding the defender's hand, then lays off deadwood onto the knocker's
// melds (repeatedly, so a run can grow card by card). Returns the lowest score.
function bestDefence(hand, knockerMelds) {
  const cands = candidateMelds(hand);
  let best = null;
  const tryArrangement = (melds) => {
    const used = new Set(melds.flat().map((c) => c.id));
    let dead = hand.filter((c) => !used.has(c.id));
    const extended = knockerMelds.map((m) => m.slice());
    const layoffs = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const card of dead.slice().sort((a, b) => value(b) - value(a))) {
        const target = extended.find((m) => fits(m, card));
        if (target) {
          target.push(card);
          layoffs.push(card);
          dead = dead.filter((c) => c.id !== card.id);
          changed = true;
        }
      }
    }
    const points = deadwoodOf(dead);
    if (!best || points < best.points) best = { melds: melds.slice(), layoffs, deadwood: dead, points };
  };
  const search = (from, used, chosen) => {
    tryArrangement(chosen);
    for (let i = from; i < cands.length; i++) {
      const m = cands[i];
      if (m.some((c) => used.has(c.id))) continue;
      m.forEach((c) => used.add(c.id));
      chosen.push(m);
      search(i + 1, used, chosen);
      chosen.pop();
      m.forEach((c) => used.delete(c.id));
    }
  };
  search(0, new Set(), []);
  return best;
}

module.exports = { bestMelds, bestDefence, deadwoodOf, value, fits };
