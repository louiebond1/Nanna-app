"use strict";
// Standard 52-card deck helpers shared by the card games.
const SUITS = ["S", "H", "D", "C"];
const SUIT_NAMES = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_NAMES = {
  A: "Ace", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven",
  8: "Eight", 9: "Nine", 10: "Ten", J: "Jack", Q: "Queen", K: "King",
};
const RANK_PLURALS = { Six: "Sixes" };

function standardDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: rank + suit, rank, suit });
  return deck;
}

function rankName(rank, count = 1) {
  const name = RANK_NAMES[rank];
  if (count === 1) return name;
  return RANK_PLURALS[name] || name + "s";
}

function cardName(card) {
  return `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}

module.exports = { SUITS, SUIT_NAMES, RANKS, RANK_NAMES, standardDeck, rankName, cardName };
