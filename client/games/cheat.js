// Cheat screen: tap up to 4 cards, then put them down as the current rank.
const PLURAL = { A: "Aces", 2: "Twos", 3: "Threes", 4: "Fours", 5: "Fives", 6: "Sixes", 7: "Sevens", 8: "Eights", 9: "Nines", 10: "Tens", J: "Jacks", Q: "Queens", K: "Kings" };
const SINGLE = { A: "Ace", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", J: "Jack", Q: "Queen", K: "King" };
const claim = (n, rank) => (n === 1 ? `one ${SINGLE[rank]}` : `${n} ${PLURAL[rank]}`);

let chosen = [];
let chosenAt = -1;

export function render(match, { send, players, you, components: { h, bigButton, card, ruleHelp } }) {
  const v = match.view;
  const oppName = players[1 - you]?.name || "the other player";
  if (chosenAt !== match.version) { chosen = []; chosenAt = match.version; }
  const toggle = (id) => {
    if (chosen.includes(id)) chosen = chosen.filter((x) => x !== id);
    else if (chosen.length < 4) chosen = [...chosen, id];
    send.redraw();
  };
  const matching = v.yourHand.filter((c) => c.rank === v.rank).length;

  const info = h("section", { class: "panel stack" },
    h("p", {}, `Cards in the middle pile: ${v.pileCount}`),
    h("p", {}, `${oppName} has ${v.opponentCardCount} card${v.opponentCardCount === 1 ? "" : "s"} left. You have ${v.yourHand.length}.`),
    v.phase === "play" ? h("p", {}, `Cards put down next must be called ${PLURAL[v.rank]}.`) : null);

  let action = null;
  if (match.yourTurn && v.phase === "respond") {
    action = h("section", { class: "panel stack" },
      h("h2", {}, `${oppName} put down ${v.claim.count} card${v.claim.count === 1 ? "" : "s"} and says: “${claim(v.claim.count, v.claim.rank)}”`),
      h("p", {}, "If you call “Cheat!” and they were lying, they pick up the pile. If they were telling the truth, you pick it up."),
      h("div", { class: "row" },
        bigButton(`Believe ${oppName}`, () => send({ type: "accept" })),
        bigButton("Call “Cheat!”", () => send({ type: "call" }), { primary: true })));
  } else if (match.yourTurn) {
    action = h("div", { class: "stack" },
      h("p", {}, matching
        ? `Hint: you have ${claim(matching, v.rank)}. You can also bluff with other cards.`
        : `You have no ${PLURAL[v.rank]}, so you'll have to bluff.`),
      bigButton(chosen.length ? `Put down ${chosen.length} card${chosen.length === 1 ? "" : "s"} as “${claim(chosen.length, v.rank)}”` : "Tap 1 to 4 cards first",
        () => send({ type: "place", cardIds: chosen }), { primary: true, block: true, disabled: !chosen.length }));
  }

  return h("div", { class: "stack" },
    info,
    action,
    h("section", { class: "stack", "aria-label": "Your hand" },
      h("h2", {}, match.yourTurn && v.phase === "play" ? `Your cards: tap up to 4 (${chosen.length} chosen)` : "Your cards"),
      h("div", { class: "row" }, v.yourHand.map((c) =>
        card(c, match.yourTurn && v.phase === "play" ? { onclick: () => toggle(c.id), selected: chosen.includes(c.id) } : {})))),
    ruleHelp("How to play Cheat", [
      "Get rid of all your cards first.",
      "On your turn, put 1 to 4 cards face down and say they're the rank shown: Aces first, then Twos, Threes and so on up to Kings, then back to Aces.",
      "You may bluff and put down other cards instead.",
      "After each turn, the other player either believes you or calls “Cheat!”. The cards are turned over: a liar picks up the whole pile; if you told the truth, the caller picks it up.",
      "Then the other player takes their turn with the next rank.",
      "You win when your last cards are believed, or are checked and found honest.",
    ]));
}

export function renderResults(match, { players, you, components: { h, card } }) {
  const v = match.view;
  return h("section", { class: "panel stack" },
    h("h2", {}, `${players[1 - you]?.name || "Other player"}'s cards at the end`),
    v.opponentHand?.length ? h("div", { class: "row" }, v.opponentHand.map((c) => card(c))) : h("p", {}, "None"),
    h("h2", {}, "Your cards at the end"),
    v.yourHand.length ? h("div", { class: "row" }, v.yourHand.map((c) => card(c))) : h("p", {}, "None"));
}
