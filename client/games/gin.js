// Gin Rummy screen. Your melds and deadwood total are worked out for you.
let selected = null;
let selectedAt = -1;

const isSet = (m) => m.every((c) => c.rank === m[0].rank);

export function render(match, { send, players, you, components: { h, bigButton, card, ruleHelp, confirmDialog } }) {
  const v = match.view;
  const oppName = players[1 - you]?.name || "the other player";
  if (selectedAt !== match.version) { selected = null; selectedAt = match.version; }
  const legal = match.legalActions;
  const canDiscard = match.yourTurn && v.step === "discard" && v.phase === "playing";
  const pick = (c) => { selected = c.id; send.redraw(); };
  const cardEl = (c) => card(c, canDiscard && c.id !== v.takenFromDiscard ? { onclick: () => pick(c), selected: c.id === selected } : {});

  const handBlock = h("section", { class: "stack", "aria-label": "Your hand" },
    h("h2", {}, canDiscard ? "Your hand: tap the card you want to get rid of" : "Your hand"),
    v.yourMelds.map((m) => h("div", { class: "stack" },
      h("p", {}, `${isSet(m) ? "Set" : "Run"} (no points against you):`),
      h("div", { class: "row" }, m.map(cardEl)))),
    v.yourDeadwood.length
      ? h("div", { class: "stack" },
          h("p", {}, `Leftover cards (deadwood), worth ${v.yourDeadwoodPoints} point${v.yourDeadwoodPoints === 1 ? "" : "s"}:`),
          h("div", { class: "row" }, v.yourDeadwood.map(cardEl)))
      : h("p", {}, "Every card is in a set or run!"));

  let controls = null;
  if (match.yourTurn && v.phase === "playing" && v.step === "draw") {
    controls = h("div", { class: "stack" }, legal.map((a) => bigButton(a.label, () => send({ type: a.type }), { block: true, primary: a.type === "drawStock" })));
  } else if (canDiscard) {
    const knock = legal.find((a) => a.type === "knock" && a.cardId === selected);
    controls = h("div", { class: "stack" },
      bigButton(selected ? legal.find((a) => a.type === "discard" && a.cardId === selected)?.label || "Discard" : "Tap a card to discard",
        () => send({ type: "discard", cardId: selected }), { block: true, primary: true, disabled: !selected }),
      knock ? bigButton(knock.label, async () => {
        if (await confirmDialog(`${knock.label}? This ends the hand for both of you.`, { confirmLabel: "Yes, knock" })) send({ type: "knock", cardId: selected });
      }, { block: true }) : null,
      legal.some((a) => a.type === "knock") && !knock
        ? h("p", {}, "You can knock this turn: some discards would leave 10 points or less. Tap a card to see if it's one of them.")
        : null);
  } else if (v.phase === "handOver") {
    controls = bigButton("Next hand", () => send({ type: "nextHand" }), { block: true, primary: true });
  }

  return h("div", { class: "stack" },
    h("section", { class: "panel stack" },
      h("p", {}, `Hand ${v.handNumber}. Points so far: you ${v.totals[you]}, ${oppName} ${v.totals[1 - you]}. First to ${v.target} wins.`),
      h("div", { class: "row" },
        h("div", {}, h("p", {}, "Discard pile:"), v.discardTop ? card(v.discardTop) : h("p", {}, "empty")),
        h("div", {},
          h("p", {}, `Stock pile: ${v.stockCount} cards`),
          h("p", {}, `${oppName} has ${v.opponentCardCount} cards.`)))),
    controls,
    handBlock,
    v.opponentHand ? h("section", { class: "panel stack" }, h("h2", {}, `${oppName}'s hand`), h("div", { class: "row" }, v.opponentHand.map((c) => card(c)))) : null,
    ruleHelp("How to play Gin Rummy", [
      "Make sets (3 or 4 cards of the same rank) and runs (3 or more in a row in the same suit, Ace low).",
      "On your turn, take one card, from the stock or the top of the discard pile, then discard one card. You can't discard a card you just took from the discard pile.",
      "Cards not in a set or run are deadwood. Ace counts 1, number cards their value, picture cards 10. The app adds this up for you.",
      "When your deadwood is 10 or less after discarding, you may knock to end the hand. With no deadwood at all, that's Gin.",
      "When you knock, the other player can lay off cards that fit your sets and runs. Then the lower deadwood wins the difference.",
      "Gin scores 25 extra. If the other player matches or beats a knock, that's an undercut: they score 25 extra.",
      "If the stock gets down to two cards with no knock, the hand is a draw.",
    ]));
}
