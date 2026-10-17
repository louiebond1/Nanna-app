// Colour Clash screen. Playable cards are outlined; tap one to play it.
const NAMES = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue" };
const SHAPES = { red: "▲", yellow: "●", green: "■", blue: "◆" };
const SYMBOL = { skip: "⊘", reverse: "⇄", draw2: "+2", wild: "★", wild4: "+4" };
const WORDS = { skip: "Skip", reverse: "Reverse", draw2: "Draw Two", wild: "Wild", wild4: "Wild Draw Four" };
const nameOf = (c) => (c.colour ? `${NAMES[c.colour]} ${WORDS[c.value] || c.value}` : WORDS[c.value]);

let choosingWild = null; // card id waiting for a colour choice

function ccard(h, c, { onclick, playable } = {}) {
  const cls = `ccard cc-${c.colour || "wild"}${onclick ? (playable ? " playable" : " not-playable") : ""}`;
  const body = [
    h("small", { "aria-hidden": "true" }, c.colour ? `${SHAPES[c.colour]} ${NAMES[c.colour]}` : "Any colour"),
    h("span", { class: "big", "aria-hidden": "true" }, SYMBOL[c.value] || c.value),
    h("small", { "aria-hidden": "true" }, WORDS[c.value] || ""),
  ];
  const label = `${nameOf(c)}${onclick ? (playable ? ", can be played" : ", can't be played now") : ""}`;
  return onclick
    ? h("button", { type: "button", class: cls, onclick, "aria-label": label }, body)
    : h("div", { class: cls, role: "img", "aria-label": label }, body);
}

export function render(match, { send, players, you, components: { h, bigButton, ruleHelp } }) {
  const v = match.view;
  const oppName = players[1 - you]?.name || "the other player";
  const legal = match.legalActions;
  const playableIds = new Set(legal.filter((a) => a.type === "play").map((a) => a.cardId));
  if (!match.yourTurn || !playableIds.has(choosingWild)) choosingWild = null;

  const tap = (c) => {
    if (!playableIds.has(c.id)) {
      send({ type: "play", cardId: c.id }); // the server explains why it can't be played
      return;
    }
    if (!c.colour) {
      choosingWild = c.id;
      send.redraw();
      return;
    }
    send({ type: "play", cardId: c.id });
  };

  const extra = legal.find((a) => a.type === "draw" || a.type === "pass");
  return h("div", { class: "stack" },
    h("section", { class: "panel stack" },
      h("div", { class: "row" },
        h("div", {}, h("p", {}, "Top card:"), ccard(h, v.top)),
        h("div", {},
          h("p", {}, `Colour to match: ${SHAPES[v.colour]} ${NAMES[v.colour]}`),
          h("p", {}, `${oppName} has ${v.opponentCardCount} card${v.opponentCardCount === 1 ? "" : "s"}.`),
          h("p", {}, `Cards left to draw: ${v.deckCount}`),
          v.target ? h("p", {}, `Round ${v.round}. Points: you ${v.totals[you]}, ${oppName} ${v.totals[1 - you]} (first to ${v.target}).`) : null))),
    choosingWild
      ? h("section", { class: "panel stack", "aria-label": "Choose a colour" },
          h("h2", {}, "Choose the new colour"),
          h("div", { class: "row" }, Object.keys(NAMES).map((col) =>
            bigButton(`${SHAPES[col]} ${NAMES[col]}`, () => { const id = choosingWild; choosingWild = null; send({ type: "play", cardId: id, colour: col }); }))),
          bigButton("Cancel", () => { choosingWild = null; send.redraw(); }))
      : null,
    h("section", { class: "stack", "aria-label": "Your hand" },
      h("h2", {}, match.yourTurn ? "Your cards: outlined cards can be played" : "Your cards"),
      h("div", { class: "row" }, v.yourHand.map((c) =>
        ccard(h, c, match.yourTurn ? { onclick: () => tap(c), playable: playableIds.has(c.id) } : {})))),
    match.yourTurn && extra
      ? bigButton(extra.label, () => send({ type: extra.type }), { block: true, primary: playableIds.size === 0 })
      : null,
    ruleHelp("How to play Colour Clash", [
      "Get rid of all your cards first. Play a card that matches the top card's colour, or its number or symbol.",
      "Wild cards can be played on anything, and you choose the next colour.",
      "If you can't play, or don't want to, draw a card. If the new card can be played, you can play it straight away or keep it.",
      "Skip ⊘ and Reverse ⇄: with two players, both mean you have another go.",
      "Draw Two +2 and Wild Draw Four +4: the other player picks up cards and misses their turn. You can't pass a pick-up back.",
      "When someone runs out, they score points from the cards left in the other hand: numbers count their value, action cards 20, Wilds 50.",
    ]));
}

export function renderResults(match, { players, you, components }) {
  const v = match.view;
  const ch = components.h;
  return ch("section", { class: "panel stack" },
    ch("h2", {}, `Cards left in ${players[1 - you]?.name || "the other player"}'s hand`),
    v.opponentHand?.length ? ch("div", { class: "row" }, v.opponentHand.map((c) => ccard(ch, c))) : ch("p", {}, "None"),
    ch("h2", {}, "Cards left in your hand"),
    v.yourHand.length ? ch("div", { class: "row" }, v.yourHand.map((c) => ccard(ch, c))) : ch("p", {}, "None"));
}
