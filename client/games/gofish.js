// Go Fish screen. Tap a card to choose its rank, then press the Ask button.
const RANK_PLURAL = { A: "Aces", J: "Jacks", Q: "Queens", K: "Kings", 6: "Sixes" };
const NUM = { 2: "Twos", 3: "Threes", 4: "Fours", 5: "Fives", 7: "Sevens", 8: "Eights", 9: "Nines", 10: "Tens" };
const plural = (r) => RANK_PLURAL[r] || NUM[r];

let selected = null;
let selectedAt = -1;

export function render(match, { send, you, players, components: { h, bigButton, card, ruleHelp } }) {
  const v = match.view;
  const opp = players[1 - you];
  const oppName = opp ? opp.name : "the other player";
  if (selectedAt !== match.version || !match.yourTurn || !v.yourHand.some((c) => c.rank === selected)) {
    selected = null;
    selectedAt = match.version;
  }
  const choose = (rank) => {
    selected = rank;
    send.redraw();
  };

  const phaseNote = {
    closing: "The pond is closing: 1 ask per turn.",
    final: "Final Round: no more fishing. One last ask each.",
  }[v.phase];

  const bookList = (ranks) => (ranks.length ? ranks.map(plural).join(", ") : "none yet");

  return h("div", { class: "stack" },
    phaseNote ? h("div", { class: "alert", role: "note" }, phaseNote) : null,
    h("section", { class: "panel stack" },
      h("p", {}, `Cards left in the pond: ${v.pondCount}`),
      h("p", {}, `${oppName} is holding ${v.opponentCardCount} card${v.opponentCardCount === 1 ? "" : "s"}.`),
      h("p", {}, `Your books (${v.books[you].length}): ${bookList(v.books[you])}`),
      h("p", {}, `${oppName}'s books (${v.books[1 - you].length}): ${bookList(v.books[1 - you])}`)),
    h("section", { class: "stack", "aria-label": "Your hand" },
      h("h2", {}, match.yourTurn ? "Your hand: tap a card to choose what to ask for" : "Your hand"),
      v.yourHand.length
        ? h("div", { class: "row" }, v.yourHand.map((c) =>
            card(c, match.yourTurn ? { onclick: () => choose(c.rank), selected: c.rank === selected } : {})))
        : h("p", {}, "You have no cards right now.")),
    match.yourTurn
      ? bigButton(selected ? `Ask ${oppName} for ${plural(selected)}` : "Choose a card first",
          () => send({ type: "ask", rank: selected }), { primary: true, block: true, disabled: !selected })
      : null,
    ruleHelp("How to play Go Fish", [
      "Make books: all four cards of one rank. The player with the most books at the end wins.",
      "On your turn, ask for a rank you already hold. If the other player has any, they hand them all over and you go again.",
      "If they have none, you go fishing: take one card from the pond. If it's the rank you asked for, that's a Lucky Catch and you go again.",
      "When only 5 cards are left in the pond, each turn is just one ask.",
      "When the pond is empty, each player gets one last ask, then the game ends.",
      "If books are tied, the player with more cards left wins. If that's tied too, whoever made the most recent book wins.",
    ]));
}

export function renderResults(match, { you, players, components: { h, card } }) {
  const v = match.view;
  const opp = players[1 - you];
  return h("section", { class: "panel stack" },
    h("h2", {}, "Cards left at the end"),
    h("p", {}, "Yours:"),
    v.yourHand.length ? h("div", { class: "row" }, v.yourHand.map((c) => card(c))) : h("p", {}, "None"),
    h("p", {}, `${opp ? opp.name : "Other player"}'s:`),
    v.opponentHand?.length ? h("div", { class: "row" }, v.opponentHand.map((c) => card(c))) : h("p", {}, "None"));
}
