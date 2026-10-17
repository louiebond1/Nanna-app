// Fleet Finder screen: place ships on your board, then fire at theirs.
let chosenShip = 0;
let across = true;

const OWN = {
  water: { text: "water", cls: "cell-water" },
  ship: { symbol: "■", text: "your ship", cls: "cell-ship" },
  hit: { symbol: "✕", text: "your ship, hit", cls: "cell-hit" },
  miss: { symbol: "•", text: "they missed", cls: "cell-miss" },
};
const TARGET = {
  unknown: { text: "not tried yet", cls: "cell-water" },
  miss: { symbol: "•", text: "miss", cls: "cell-miss" },
  hit: { symbol: "✕", text: "hit", cls: "cell-hit" },
  sunk: { symbol: "✕", text: "sunk", cls: "cell-sunk" },
  ship: { symbol: "■", text: "ship they didn't find", cls: "cell-ship" },
};

function fleetList(h, title, fleet) {
  return h("div", {}, h("p", {}, title),
    h("ul", {}, fleet.map((f) => h("li", {}, `${f.name} (${f.length} squares): ${f.sunk ? "sunk" : "afloat"}`))));
}

export function render(match, { send, players, you, components: { h, bigButton, board, ruleHelp } }) {
  const v = match.view;
  const oppName = players[1 - you]?.name || "the other player";
  const help = ruleHelp("How to play Fleet Finder", [
    "First, hide your ships on your board. Choose a ship, choose Across or Down, then choose the square where it should start. On a phone, use the Row and Column selectors below the board. Or press “Place my ships for me”.",
    "When you're happy, press “My ships are ready”. Your ships can't be moved after that.",
    "Then take turns firing at one square on the other player's board. • means a miss, ✕ means a hit.",
    "When every square of a ship has been hit, it sinks. Sink all their ships to win.",
  ]);

  if (v.phase === "placing") {
    if (v.youReady) {
      return h("div", { class: "stack" },
        h("p", {}, v.opponentReady ? "Starting…" : `Your ships are ready. Waiting for ${oppName} to hide theirs.`),
        board(v.own, { look: (s) => OWN[s], label: "Your board" }), help);
    }
    if (chosenShip >= v.fleet.length) chosenShip = 0;
    const ship = v.fleet[chosenShip];
    const allPlaced = v.placed.every(Boolean);
    return h("div", { class: "stack" },
      h("h2", {}, "Hide your ships"),
      h("p", {}, "1. Choose a ship:"),
      h("div", { class: "row" }, v.fleet.map((f, i) =>
        bigButton(`${i === chosenShip ? "✓ " : ""}${f.name} (${f.length})${v.placed[i] ? ": placed" : ""}`,
          () => { chosenShip = i; send.redraw(); }, { primary: i === chosenShip, "aria-pressed": String(i === chosenShip) }))),
      h("p", {}, "2. Choose which way it points:"),
      h("div", { class: "row" },
        bigButton(`${across ? "✓ " : ""}Across →`, () => { across = true; send.redraw(); }, { primary: across, "aria-pressed": String(across) }),
        bigButton(`${!across ? "✓ " : ""}Down ↓`, () => { across = false; send.redraw(); }, { primary: !across, "aria-pressed": String(!across) })),
      h("p", {}, `3. Choose the square where the ${ship.name} should start.`),
      board(v.own, {
        look: (s) => OWN[s],
        label: "Your board",
        onclick: async (row, col) => {
          const placedShip = chosenShip;
          const res = await send({ type: "place", ship: placedShip, row, col, across });
          if (!res?.ok) return;
          const next = v.placed.findIndex((p, i) => !p && i !== placedShip);
          if (next !== -1 && chosenShip === placedShip) chosenShip = next;
          send.redraw();
        },
      }),
      h("div", { class: "row" },
        bigButton("Place my ships for me", () => send({ type: "randomise" })),
        bigButton("My ships are ready", () => send({ type: "ready" }), { primary: true, disabled: !allPlaced })),
      help);
  }

  return h("div", { class: "stack" },
    h("h2", {}, `${oppName}'s board`),
    match.yourTurn ? h("p", {}, "Choose a square you haven't tried yet.") : null,
    board(v.target, {
      look: (s) => TARGET[s],
      label: `${oppName}'s board`,
      onclick: match.yourTurn ? (row, col) => send({ type: "fire", row, col }) : null,
      canClick: (r, c) => v.target[r][c] === "unknown",
    }),
    fleetList(h, `${oppName}'s ships:`, v.theirFleet),
    h("h2", {}, "Your board"),
    board(v.own, { look: (s) => OWN[s], label: "Your board" }),
    fleetList(h, "Your ships:", v.yourFleet),
    help);
}

export function renderResults(match, ctx) {
  const { h, board } = ctx.components;
  const oppName = ctx.players[1 - ctx.you]?.name || "Other player";
  return h("section", { class: "panel stack" },
    h("h2", {}, `${oppName}'s board`),
    board(match.view.target, { look: (s) => TARGET[s], label: `${oppName}'s board` }));
}
