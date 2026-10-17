// Island Conquest screen: tap your territory, then a neighbour.
const NS = "http://www.w3.org/2000/svg";
let from = null;
let to = null;
let moveCount = 1;
let selAt = -1;

function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function render(match, { send, players, you, components: { h, bigButton, dice, ruleHelp } }) {
  const v = match.view;
  const T = Object.fromEntries(v.territories.map((t) => [t.id, t]));
  const adj = {};
  for (const l of v.links) { (adj[l.a] ||= []).push(l.b); (adj[l.b] ||= []).push(l.a); }
  if (selAt !== match.version) { selAt = match.version; if (v.step !== "attack") { from = null; to = null; } moveCount = 1; }
  if (from && v.owner[from] !== you) from = null;
  if (to && from && !adj[from].includes(to)) to = null;
  const myTurn = match.yourTurn;
  const nameOf = (seat) => (seat === 2 ? "Neutral" : seat === you ? "You" : players[seat]?.name || "Them");
  // Map letters use each player's own initial, the same on both devices.
  const initials = [0, 1].map((s) => (players[s]?.name || `P${s + 1}`).toUpperCase());
  const letterOf = (seat) => (seat === 2 ? "–" : initials[0][0] !== initials[1][0] ? initials[seat][0] : initials[seat].slice(0, 2));
  const redraw = () => send.redraw();

  const tap = (id) => {
    if (!myTurn) return;
    if (v.step === "reinforce") { from = v.owner[id] === you ? id : null; to = null; }
    else if (v.step === "attack") {
      if (v.owner[id] === you) { from = id; to = null; }
      else if (from && adj[from].includes(id)) to = id;
    } else if (v.step === "fortify") {
      if (v.owner[id] !== you) return;
      if (from && adj[from].includes(id) && id !== from) { to = id; moveCount = Math.max(1, v.armies[from] - 1); }
      else { from = id; to = null; }
    }
    redraw();
  };

  const map = h("div", { class: "map", role: "group", "aria-label": "Map of the islands" });
  const bg = svg("svg", { viewBox: "0 0 100 70", "aria-hidden": "true" });
  bg.append(svg("rect", { x: 0, y: 0, width: 100, height: 70, fill: "#bfe0f5" }));
  const islandShapes = { north: [50, 18, 22, 14], west: [21, 50, 15, 19], east: [77, 48, 16, 18] };
  for (const [, [cx, cy, rx, ry]] of Object.entries(islandShapes)) bg.append(svg("ellipse", { cx, cy, rx, ry, fill: "#cfe8b8", stroke: "#7a9a5a", "stroke-width": 0.6 }));
  for (const l of v.links) {
    bg.append(svg("line", { x1: T[l.a].x, y1: T[l.a].y, x2: T[l.b].x, y2: T[l.b].y, stroke: l.sea ? "#2a6f97" : "#6b4f2a", "stroke-width": l.sea ? 0.7 : 0.9, "stroke-dasharray": l.sea ? "2 1.5" : "none" }));
  }
  map.append(bg);
  for (const t of v.territories) {
    const owner = v.owner[t.id];
    const btn = h("button", {
      type: "button",
      class: `terr terr-${owner}${t.id === to ? " target" : ""}`,
      "aria-pressed": String(t.id === from),
      "aria-label": `${t.name}: ${nameOf(owner)}, ${v.armies[t.id]} ${v.armies[t.id] === 1 ? "army" : "armies"}`,
      onclick: () => tap(t.id),
    }, h("span", { class: "armies" }, String(v.armies[t.id])), h("span", { class: "owner", "aria-hidden": "true" }, letterOf(owner)));
    btn.style.setProperty("left", `${t.x}%`);
    btn.style.setProperty("top", `${(t.y / 70) * 100}%`);
    const label = h("span", { class: "terr-label", "aria-hidden": "true" }, t.name);
    label.style.setProperty("left", `${t.x}%`);
    label.style.setProperty("top", `calc(${(t.y / 70) * 100}% + 1.9rem)`);
    map.append(btn, label);
  }

  let controls = null;
  if (myTurn && v.step === "reinforce") {
    controls = h("section", { class: "panel stack" },
      h("h2", {}, `Place ${v.toPlace} new ${v.toPlace === 1 ? "army" : "armies"}`),
      from ? h("div", { class: "row" },
        bigButton(`Put 1 on ${T[from].name}`, () => send({ type: "place", territory: from, count: 1 })),
        v.toPlace > 1 ? bigButton(`Put all ${v.toPlace} on ${T[from].name}`, () => send({ type: "place", territory: from, count: v.toPlace }), { primary: true }) : null)
        : h("p", {}, "Tap one of your territories."));
  } else if (myTurn && v.step === "attack") {
    const canAttack = from && to && v.armies[from] >= 2 && v.owner[to] !== you;
    controls = h("section", { class: "panel stack" },
      h("h2", {}, "Attack"),
      h("p", {}, !from ? "Tap one of your territories with 2 or more armies." : !to ? `Now tap a neighbour of ${T[from].name} to attack.` : `${T[from].name} (${v.armies[from]}) against ${T[to].name} (${v.armies[to]}).`),
      canAttack ? bigButton(`Attack ${T[to].name}`, () => send({ type: "attack", from, to }), { primary: true, block: true }) : null,
      bigButton("Stop attacking", () => { from = null; to = null; send({ type: "endAttack" }); }, { block: true }));
  } else if (myTurn && v.step === "fortify") {
    const max = from ? v.armies[from] - 1 : 0;
    controls = h("section", { class: "panel stack" },
      h("h2", {}, "Move armies (once), or end your turn"),
      h("p", {}, !from ? "Tap one of your territories to move from." : !to ? `Tap a neighbouring territory of yours to move to from ${T[from].name}.` : `Move from ${T[from].name} to ${T[to].name}:`),
      from && to && max >= 1 ? h("div", { class: "row" },
        bigButton("−", () => { moveCount = Math.max(1, moveCount - 1); redraw(); }, { "aria-label": "One fewer", disabled: moveCount <= 1 }),
        h("span", { class: "timer" }, String(Math.min(moveCount, max))),
        bigButton("+", () => { moveCount = Math.min(max, moveCount + 1); redraw(); }, { "aria-label": "One more", disabled: moveCount >= max }),
        bigButton(`Move ${Math.min(moveCount, max)}`, () => send({ type: "fortify", from, to, count: Math.min(moveCount, max) }), { primary: true })) : null,
      bigButton("End my turn", () => send({ type: "endTurn" }), { block: true }));
  }

  const roll = v.lastRoll;
  return h("div", { class: "stack" },
    h("p", {}, `Round ${v.round}${v.maxRounds ? ` of ${v.maxRounds}` : ""}. Blue “${letterOf(0)}” is ${nameOf(0)}, red “${letterOf(1)}” is ${nameOf(1)}, grey “–” is neutral.`),
    map,
    h("details", { class: "panel", open: true },
      h("summary", {}, "Territories as a list (easier to tap)"),
      v.islands.map((isl) => h("div", { class: "stack" },
        h("h2", {}, isl.name),
        v.territories.filter((t) => t.island === isl.id).map((t) => h("button", {
          type: "button",
          class: `btn btn-block${t.id === from ? " btn-primary" : ""}`,
          "aria-pressed": String(t.id === from || t.id === to),
          onclick: () => tap(t.id),
        }, `${t.id === to ? "➜ " : ""}${t.name}: ${nameOf(v.owner[t.id])}, ${v.armies[t.id]} ${v.armies[t.id] === 1 ? "army" : "armies"}`))))),
    roll ? h("section", { class: "panel stack", "aria-label": "Last dice roll" },
      h("p", {}, `Attack on ${T[roll.to].name}:`),
      h("div", { class: "row" }, h("span", {}, "Attacker:"), roll.attacker.map(dice)),
      h("div", { class: "row" }, h("span", {}, "Defender:"), roll.defender.map(dice)),
      h("p", {}, `Attacker lost ${roll.aLoss}, defender lost ${roll.dLoss}. (Highest dice are compared in pairs; ties go to the defender.)`)) : null,
    controls,
    ruleHelp("How to play Island Conquest", [
      "Each turn has three steps: place new armies, attack if you want to, then move armies once.",
      "New armies: 3, or one for every three territories you hold if that's more, plus 2 for each whole island you hold.",
      "To attack, you need at least 2 armies in a territory next to the one you're attacking (dashed lines are sea crossings). One army always stays behind.",
      "The attacker rolls up to 3 dice and the defender up to 2. The highest dice are compared in pairs; the lower one loses an army, and ties go to the defender.",
      "Empty a territory and it's yours: some of your attacking armies move in.",
      "Grey territories are neutral: they defend but never attack.",
      "You win by taking all the other player's territories, or by holding two whole islands at the end of your turn. If there's a round limit, whoever holds the most territories then wins.",
      "This is a simplified game inspired by classic conquest games, not the official rules of any of them.",
    ]));
}
