// Who's Who screen. Faces are drawn here from each character's features,
// so the redesign can replace the artwork without touching the rules.
const SKIN = ["", "#f6d7c3", "#e0b48f", "#b9825a", "#7a4a2b"];
const HAIR = { black: "#1b1b1b", brown: "#6b3e1f", blonde: "#e8c66a", ginger: "#c8551b", grey: "#b5b5b5", none: "#4a3020" };
const NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const k of kids) if (k) el.append(k);
  return el;
}

export function describe(c) {
  const bits = [];
  bits.push(c.hair === "none" ? "bald" : `${c.long ? "long" : "short"} ${c.hair} hair`);
  if (c.glasses) bits.push("glasses");
  if (c.hat) bits.push("a hat");
  if (c.beard) bits.push("a beard");
  if (c.moustache) bits.push("a moustache");
  if (c.earrings) bits.push("earrings");
  bits.push(c.smiling ? "smiling" : "not smiling");
  return `${c.name}: ${bits.join(", ")}`;
}

export function faceSvg(c) {
  const skin = SKIN[c.skin];
  const hair = HAIR[c.hair];
  return svg("svg", { viewBox: "0 0 100 110", "aria-hidden": "true" },
    svg("rect", { x: 0, y: 0, width: 100, height: 110, rx: 10, fill: "#eef3f7" }),
    c.long && c.hair !== "none" ? svg("rect", { x: 17, y: 24, width: 66, height: 62, rx: 22, fill: hair }) : null,
    svg("path", { d: "M18,110 Q18,86 50,84 Q82,86 82,110 Z", fill: c.colour }),
    svg("rect", { x: 43, y: 74, width: 14, height: 12, fill: skin }),
    svg("circle", { cx: 24, cy: 54, r: 6, fill: skin }),
    svg("circle", { cx: 76, cy: 54, r: 6, fill: skin }),
    c.earrings ? svg("circle", { cx: 24, cy: 63, r: 3.5, fill: "#f1c40f", stroke: "#7d6608", "stroke-width": 1 }) : null,
    c.earrings ? svg("circle", { cx: 76, cy: 63, r: 3.5, fill: "#f1c40f", stroke: "#7d6608", "stroke-width": 1 }) : null,
    svg("ellipse", { cx: 50, cy: 52, rx: 26, ry: 30, fill: skin }),
    c.hair !== "none" ? svg("path", { d: "M23,48 Q22,19 50,19 Q78,19 77,48 Q70,31 50,31 Q30,31 23,48 Z", fill: hair }) : null,
    // Under a hat, thick sideburns keep the hair colour visible.
    c.hair !== "none" && c.hat ? svg("rect", { x: 21, y: 34, width: 9, height: 20, rx: 3, fill: hair }) : null,
    c.hair !== "none" && c.hat ? svg("rect", { x: 70, y: 34, width: 9, height: 20, rx: 3, fill: hair }) : null,
    c.hair === "none" && !c.hat ? svg("ellipse", { cx: 41, cy: 30, rx: 7, ry: 3, fill: "#fff", opacity: 0.45 }) : null,
    c.hat ? svg("rect", { x: 22, y: 10, width: 56, height: 22, rx: 6, fill: "#3b3b6d" }) : null,
    c.hat ? svg("rect", { x: 12, y: 29, width: 76, height: 7, rx: 3, fill: "#3b3b6d" }) : null,
    c.hat ? svg("rect", { x: 22, y: 24, width: 56, height: 5, fill: "#e74c3c" }) : null,
    svg("circle", { cx: 40, cy: 50, r: 3.2, fill: "#222" }),
    svg("circle", { cx: 60, cy: 50, r: 3.2, fill: "#222" }),
    c.glasses ? svg("circle", { cx: 40, cy: 50, r: 8, fill: "none", stroke: "#111", "stroke-width": 2.6 }) : null,
    c.glasses ? svg("circle", { cx: 60, cy: 50, r: 8, fill: "none", stroke: "#111", "stroke-width": 2.6 }) : null,
    c.glasses ? svg("line", { x1: 48, y1: 50, x2: 52, y2: 50, stroke: "#111", "stroke-width": 2.6 }) : null,
    svg("path", { d: "M50,54 L46,63 L52,63", fill: "none", stroke: "#00000055", "stroke-width": 2 }),
    c.beard ? svg("path", { d: "M27,58 Q29,92 50,92 Q71,92 73,58 Q67,80 50,80 Q33,80 27,58 Z", fill: hair }) : null,
    c.moustache ? svg("path", { d: "M38,68 Q50,61 62,68 Q50,66 38,68 Z", fill: hair, stroke: hair, "stroke-width": 2 }) : null,
    c.smiling
      ? svg("path", { d: "M40,71 Q50,82 60,71 Z", fill: "#fff", stroke: "#5a1e1e", "stroke-width": 2 })
      : svg("line", { x1: 42, y1: 73, x2: 58, y2: 73, stroke: "#5a1e1e", "stroke-width": 2.4, "stroke-linecap": "round" }));
}

let guessing = false;

export function render(match, { send, players, you, components: { h, bigButton, ruleHelp, confirmDialog } }) {
  const v = match.view;
  const oppName = players[1 - you]?.name || "the other player";
  const me = v.characters.find((c) => c.id === v.yourPerson);
  if (!match.yourTurn) guessing = false;
  const down = new Set(v.yourDown);
  const qText = Object.fromEntries(v.questions.map((q) => [q.id, q.text]));
  const askedByMe = v.asked.filter((a) => a.seat === you);
  const askedIds = new Set(askedByMe.map((a) => a.questionId));
  const wrong = new Set(v.wrongGuesses[you]);

  const tapFace = async (c) => {
    if (guessing) {
      if (await confirmDialog(`Is it ${c.name}? If you're wrong, ${match.settings.wrongGuess === "lose" ? "you lose the game" : "you lose your turn"}.`, { confirmLabel: `Yes, guess ${c.name}` })) {
        guessing = false;
        send({ type: "guess", characterId: c.id });
      }
      return;
    }
    send({ type: "flip", characterId: c.id });
  };

  return h("div", { class: "stack" },
    h("section", { class: "panel row" },
      h("div", { class: "face-big" }, faceSvg(me)),
      h("div", {}, h("p", {}, "Your secret person is:"), h("h2", {}, me.name), h("p", { class: "muted" }, `${oppName} is trying to work out who this is.`))),
    match.yourTurn ? h("section", { class: "panel stack" },
      h("h2", {}, guessing ? "Tap the person you think it is" : "Ask a question"),
      guessing
        ? bigButton("Cancel guessing", () => { guessing = false; send.redraw(); })
        : h("div", { class: "stack" },
            v.questions.filter((q) => !askedIds.has(q.id)).map((q) => bigButton(q.text, () => send({ type: "ask", questionId: q.id }), { block: true })),
            bigButton("I know who it is: make a guess", () => { guessing = true; send.redraw(); }, { primary: true, block: true })))
      : null,
    askedByMe.length ? h("section", { class: "panel stack" },
      h("h2", {}, "Your answers so far"),
      h("ul", { class: "qa-list" }, askedByMe.map((a) => h("li", { class: "stack" },
        h("p", {}, `${qText[a.questionId]} `, h("strong", {}, a.answer ? "Yes" : "No")),
        bigButton(`Flip down everyone who doesn't match`, () => send({ type: "flipNonMatching", questionId: a.questionId })))))) : null,
    h("section", { class: "stack" },
      h("h2", {}, guessing ? "Who is it?" : "Your board: tap a face to flip it down (or back up)"),
      h("div", { class: "faces" }, v.characters.map((c) =>
        h("button", {
          type: "button",
          class: `face${down.has(c.id) ? " down" : ""}${guessing ? " guessing" : ""}`,
          "aria-label": `${describe(c)}${down.has(c.id) ? " (flipped down)" : ""}${wrong.has(c.id) ? " (wrong guess)" : ""}`,
          "aria-pressed": String(down.has(c.id)),
          disabled: guessing && (down.has(c.id) || wrong.has(c.id)),
          onclick: () => tapFace(c),
        }, faceSvg(c), h("span", { class: "face-name" }, c.name))))),
    h("p", {}, `${oppName} has flipped down ${v.theirDownCount} of 24.`),
    ruleHelp("How to play Who's Who", [
      "You each have a secret person. Take turns asking one yes-or-no question about the other player's person. The app answers truthfully for them.",
      "Flip down faces that can't be the answer. Your board is private. “Flip down everyone who doesn't match” does it for you.",
      "On your turn, instead of asking, you can guess. Get it right and you win.",
      match.settings.wrongGuess === "lose" ? "A wrong guess loses the game, so be sure!" : "A wrong guess just ends your turn.",
    ]));
}

export function renderResults(match, { players, you, components: { h } }) {
  const v = match.view;
  const theirs = v.characters.find((c) => c.id === v.theirPerson);
  const mine = v.characters.find((c) => c.id === v.yourPerson);
  return h("section", { class: "panel row" },
    h("div", { class: "face-big" }, faceSvg(theirs), h("p", {}, `${players[1 - you]?.name || "Their"} person: ${theirs.name}`)),
    h("div", { class: "face-big" }, faceSvg(mine), h("p", {}, `Your person: ${mine.name}`)));
}
