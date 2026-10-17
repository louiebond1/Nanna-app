// Canasta screen. Tap cards to select them, or use a suggested move.
const NAMES = { 3: "Threes", 4: "Fours", 5: "Fives", 6: "Sixes", 7: "Sevens", 8: "Eights", 9: "Nines", 10: "Tens", J: "Jacks", Q: "Queens", K: "Kings", A: "Aces" };
const isWild = (c) => c.rank === "2" || c.rank === "JK";
const value = (c) => (c.rank === "JK" ? 50 : c.rank === "2" || c.rank === "A" ? 20 : ["K", "Q", "J", "10", "9", "8"].includes(c.rank) ? 10 : 5);

let selected = [];
let selectedAt = -1;

// Splits selected cards into meld groups by rank; wilds join the single group.
function groupsFrom(cards, melds) {
  const byRank = {};
  for (const c of cards.filter((x) => !isWild(x))) (byRank[c.rank] ||= []).push(c.id);
  const wilds = cards.filter(isWild).map((c) => c.id);
  const ranks = Object.keys(byRank);
  if (wilds.length) {
    if (ranks.length === 1) byRank[ranks[0]].push(...wilds);
    else if (ranks.length === 0 && melds.length === 1) return [{ cardIds: wilds, meldRank: melds[0].rank }];
    else return { error: "Choose wild cards together with the cards of one rank, so we know where they go." };
  }
  return ranks.map((r) => ({ cardIds: byRank[r], meldRank: melds.some((m) => m.rank === r) ? r : undefined }));
}

function cardFace(card, c, opts) {
  if (c.rank === "JK") {
    const el = card({ rank: "★", suit: "S" }, opts);
    el.setAttribute("aria-label", "Joker (wild)");
    el.querySelector("small").textContent = "Joker";
    return el;
  }
  return card(c, opts);
}

export function render(match, { send, players, you, components: { h, bigButton, card, ruleHelp, confirmDialog } }) {
  const v = match.view;
  const oppName = players[1 - you]?.name || "the other player";
  if (selectedAt !== match.version) { selected = []; selectedAt = match.version; }
  const mine = match.yourTurn && v.phase === "playing";
  const hand = v.yourHand;
  const sel = hand.filter((c) => selected.includes(c.id));
  const toggle = (id) => { selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]; send.redraw(); };
  const myMelds = v.melds[you];

  const meldBlock = (ms, who) => h("div", { class: "stack" },
    h("h2", {}, `${who} melds (${v.canastas[who === "Your" ? you : 1 - you]} canasta${v.canastas[who === "Your" ? you : 1 - you] === 1 ? "" : "s"})`),
    ms.length ? ms.map((m) => h("div", { class: "stack" },
      h("p", {}, `${NAMES[m.rank]}: ${m.cards.length} card${m.cards.length === 1 ? "" : "s"}, ${m.points} points${m.canasta ? ` (${m.natural ? "natural canasta +500" : "mixed canasta +300"})` : m.cards.length >= 5 ? ` (${7 - m.cards.length} more for a canasta)` : ""}`),
      h("div", { class: "row" }, m.cards.map((c) => cardFace(card, c, {})))))
      : h("p", {}, "None yet."));

  let controls = null;
  if (mine) {
    const quick = match.legalActions.filter((a) => !a.input && a.type !== "discard" && a.type !== "drawStock");
    const selPoints = sel.reduce((t, c) => t + value(c), 0);
    if (v.step === "draw") {
      const top = v.pileTop;
      // Selected cards of the top card's rank (and wilds) go with it; others form extra melds.
      const pileUse = top ? sel.filter((c) => c.rank === top.rank || isWild(c)) : [];
      const pileExtra = groupsFrom(sel.filter((c) => !pileUse.includes(c)), myMelds);
      controls = h("section", { class: "panel stack" },
        h("h2", {}, "Start your turn"),
        bigButton("Draw two cards from the stock", () => send({ type: "drawStock" }), { primary: true, block: true }),
        quick.map((a) => bigButton(a.label, () => send(Object.fromEntries(Object.entries(a).filter(([k]) => k !== "label"))), { block: true })),
        top && sel.length && !pileExtra.error ? bigButton(`Take the pile using my ${sel.length} selected card${sel.length === 1 ? "" : "s"}`,
          () => send({ type: "takePile", useIds: pileUse.map((c) => c.id), melds: pileExtra }), { block: true }) : null,
        sel.length && pileExtra.error ? h("p", { class: "alert" }, pileExtra.error) : null,
        v.yourMinimum && sel.length ? h("p", {}, `Selected cards plus the top card are worth ${selPoints + (top ? value(top) : 0)} points. Your first meld needs ${v.yourMinimum}.`) : null);
    } else {
      const groups = sel.length ? groupsFrom(sel, myMelds) : [];
      controls = h("section", { class: "panel stack" },
        h("h2", {}, "Meld, then discard one card"),
        quick.length ? h("p", {}, "Suggested moves:") : null,
        quick.map((a) => bigButton(a.label, () => send(Object.fromEntries(Object.entries(a).filter(([k]) => k !== "label"))), { block: true })),
        sel.length ? h("p", {}, `Selected: ${sel.length} card${sel.length === 1 ? "" : "s"}, worth ${selPoints} points.${v.yourMinimum ? ` Your first meld needs ${v.yourMinimum}.` : ""}`) : h("p", {}, "Or tap cards in your hand to choose them yourself."),
        sel.length && !groups.error ? bigButton("Meld the selected cards", () => send({ type: "meld", groups }), { block: true }) : null,
        groups.error ? h("p", { class: "alert" }, groups.error) : null,
        sel.length === 1 ? bigButton(`Discard the selected card${hand.length === 1 ? " and go out" : ""}`, async () => {
          if (hand.length === 1 && !(await confirmDialog("Go out and end the hand?", { confirmLabel: "Yes, go out" }))) return;
          send({ type: "discard", cardId: sel[0].id });
        }, { primary: true, block: true }) : h("p", {}, "To end your turn, select one card to discard."));
    }
  } else if (v.phase === "handOver") {
    controls = bigButton("Next hand", () => send({ type: "nextHand" }), { primary: true, block: true });
  }

  return h("div", { class: "stack" },
    h("section", { class: "panel stack" },
      h("p", {}, `Hand ${v.handNumber}. Points: you ${v.totals[you]}, ${oppName} ${v.totals[1 - you]}${v.target > 1 ? ` (first to ${v.target})` : ""}.`),
      h("div", { class: "row" },
        h("div", {}, h("p", {}, `Discard pile (${v.pileCount}):`), v.pileTop ? cardFace(card, v.pileTop, {}) : h("p", {}, "empty")),
        h("div", {},
          h("p", {}, v.frozen ? "The pile is frozen by a wild card." : "The pile isn't frozen."),
          h("p", {}, `Stock: ${v.stockCount} cards. ${oppName} holds ${v.opponentCardCount}.`),
          v.yourMinimum ? h("p", {}, `Your first meld must be worth at least ${v.yourMinimum} points.`) : null,
          h("p", {}, `Red Threes: you ${v.red3s[you].length}, ${oppName} ${v.red3s[1 - you].length}.`)))),
    controls,
    h("section", { class: "stack", "aria-label": "Your hand" },
      h("h2", {}, `Your hand (${hand.length})`),
      h("div", { class: "row" }, hand.map((c) => cardFace(card, c, mine ? { onclick: () => toggle(c.id), selected: selected.includes(c.id) } : {})))),
    meldBlock(myMelds, "Your"),
    meldBlock(v.melds[1 - you], `${oppName}'s`),
    v.opponentHand ? h("section", { class: "panel stack" }, h("h2", {}, `${oppName}'s hand`), h("div", { class: "row" }, v.opponentHand.map((c) => cardFace(card, c, {})))) : null,
    ruleHelp("How to play Canasta", [
      "Make melds: three or more cards of the same rank. Twos and Jokers are wild and can join a meld (at most three per meld, and at least two real cards).",
      "On your turn, draw two from the stock, or take the whole discard pile if you can meld its top card. Then meld if you like, and discard one card.",
      "Your first meld must be worth a minimum number of points (shown above). Jokers 50, Aces and Twos 20, Eight to King 10, Four to Seven 5.",
      "A meld of seven cards is a canasta: 500 with no wild cards, 300 with some. You need two canastas before you can go out.",
      "Red Threes are put down automatically for a 100-point bonus. Black Threes stop the next player taking the pile.",
      "Discarding a wild card freezes the pile: then it can only be taken with two matching natural cards.",
      "At the end of a hand the app adds up melds, bonuses and the cards left in your hand for you.",
    ]));
}
