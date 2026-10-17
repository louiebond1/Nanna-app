// Look & Remember screen. Pictures are drawn from the card's item list.
import { countryCard } from './country-card.js';
const NS = "http://www.w3.org/2000/svg";
const COLOURS = { red: "#d62828", blue: "#1d4ed8", yellow: "#f4c430", green: "#2e8b57", purple: "#7b3fa0", orange: "#f08c00", pink: "#e75480", brown: "#8b5a2b", white: "#ffffff", black: "#222222" };
const OUT = "#1a1a1a";

function el(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) if (k) e.append(typeof k === "string" ? document.createTextNode(k) : k);
  return e;
}
const line = { stroke: OUT, "stroke-width": 0.8 };

const DRAW = {
  apple: (x, y, c) => [el("circle", { cx: x, cy: y, r: 4, fill: c, ...line }), el("line", { x1: x, y1: y - 4, x2: x + 1, y2: y - 6.5, stroke: "#5b3a1a", "stroke-width": 1 }), el("ellipse", { cx: x + 2.5, cy: y - 5.5, rx: 1.8, ry: 0.9, fill: "#2e8b57" })],
  ball: (x, y, c) => [el("circle", { cx: x, cy: y, r: 4.5, fill: c, ...line }), el("path", { d: `M${x - 4.5},${y} Q${x},${y - 3} ${x + 4.5},${y}`, fill: "none", stroke: "#fff", "stroke-width": 1 })],
  balloon: (x, y, c) => [el("line", { x1: x, y1: y + 4.5, x2: x + 1, y2: y + 12, stroke: OUT, "stroke-width": 0.5 }), el("ellipse", { cx: x, cy: y, rx: 3.6, ry: 4.6, fill: c, ...line })],
  bird: (x, y, c) => [el("ellipse", { cx: x, cy: y, rx: 4, ry: 2.6, fill: c, ...line }), el("circle", { cx: x + 3.5, cy: y - 2, r: 1.8, fill: c, ...line }), el("path", { d: `M${x + 5.2},${y - 2.2} l2,0.6 l-2,0.6 z`, fill: "#f08c00" }), el("circle", { cx: x + 3.9, cy: y - 2.4, r: 0.4, fill: OUT })],
  boat: (x, y, c) => [el("path", { d: `M${x - 7},${y} L${x + 7},${y} L${x + 5},${y + 4} L${x - 5},${y + 4} Z`, fill: c, ...line }), el("line", { x1: x, y1: y, x2: x, y2: y - 10, stroke: OUT, "stroke-width": 0.8 }), el("path", { d: `M${x + 0.5},${y - 9.5} L${x + 6},${y - 1} L${x + 0.5},${y - 1} Z`, fill: "#fff", ...line })],
  car: (x, y, c) => [el("rect", { x: x - 7, y: y - 2, width: 14, height: 5, rx: 1.5, fill: c, ...line }), el("path", { d: `M${x - 4},${y - 2} L${x - 2.5},${y - 5.5} L${x + 3},${y - 5.5} L${x + 4.5},${y - 2} Z`, fill: c, ...line }), el("circle", { cx: x - 4, cy: y + 3.2, r: 1.8, fill: OUT }), el("circle", { cx: x + 4, cy: y + 3.2, r: 1.8, fill: OUT })],
  cat: (x, y, c) => [el("ellipse", { cx: x, cy: y + 2, rx: 4.5, ry: 3, fill: c, ...line }), el("circle", { cx: x - 4, cy: y - 1.5, r: 2.6, fill: c, ...line }), el("path", { d: `M${x - 6},${y - 3} l0.5,-2.6 l1.6,1.6 z M${x - 3.6},${y - 3.6} l1.2,-2.2 l0.9,2.2 z`, fill: c, ...line }), el("path", { d: `M${x + 4.5},${y + 2} q3,-1 2,-5`, fill: "none", stroke: c === "#ffffff" ? OUT : c, "stroke-width": 1.2 })],
  clock: (x, y, c, t) => [el("circle", { cx: x, cy: y, r: 7, fill: c, stroke: OUT, "stroke-width": 1.2 }), el("text", { x, y: y + 1.5, "text-anchor": "middle", "font-size": 4, "font-weight": 700, fill: OUT, "font-family": "sans-serif" }, t)],
  cup: (x, y, c) => [el("path", { d: `M${x - 3.5},${y - 3} L${x + 3.5},${y - 3} L${x + 2.6},${y + 3} L${x - 2.6},${y + 3} Z`, fill: c, ...line }), el("path", { d: `M${x + 3.2},${y - 1.5} q2.5,0 1.8,2.5 q-0.5,1 -2.2,0.6`, fill: "none", stroke: OUT, "stroke-width": 0.8 })],
  fish: (x, y, c) => [el("ellipse", { cx: x, cy: y, rx: 4.5, ry: 2.4, fill: c, ...line }), el("path", { d: `M${x - 4.2},${y} l-3,-2.4 l0,4.8 z`, fill: c, ...line }), el("circle", { cx: x + 2.4, cy: y - 0.5, r: 0.5, fill: OUT })],
  flower: (x, y, c) => [el("line", { x1: x, y1: y + 2, x2: x, y2: y + 9, stroke: "#2e8b57", "stroke-width": 1 }), ...[0, 72, 144, 216, 288].map((a) => el("circle", { cx: x + 2.3 * Math.cos((a * Math.PI) / 180), cy: y + 2.3 * Math.sin((a * Math.PI) / 180), r: 1.8, fill: c, ...line })), el("circle", { cx: x, cy: y, r: 1.2, fill: "#f4c430" })],
  house: (x, y, c, t) => [el("rect", { x: x - 8, y: y - 4, width: 16, height: 13, fill: c, ...line }), el("path", { d: `M${x - 10},${y - 4} L${x},${y - 12} L${x + 10},${y - 4} Z`, fill: "#5b3a1a", ...line }), el("rect", { x: x - 2.5, y: y + 1, width: 5, height: 8, fill: "#fff", ...line }), el("text", { x, y: y + 5.5, "text-anchor": "middle", "font-size": 3.4, "font-weight": 700, fill: OUT, "font-family": "sans-serif" }, t)],
  sign: (x, y, c, t) => [el("line", { x1: x, y1: y, x2: x, y2: y + 10, stroke: "#5b3a1a", "stroke-width": 1.4 }), el("rect", { x: x - 9, y: y - 5, width: 18, height: 7, rx: 1, fill: c, stroke: OUT, "stroke-width": 1 }), el("text", { x, y: y - 0.2, "text-anchor": "middle", "font-size": 3.6, "font-weight": 800, fill: OUT, "font-family": "sans-serif" }, t)],
  star: (x, y, c) => [el("path", { d: Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 1.6 : 3.8; const a = (Math.PI / 5) * i - Math.PI / 2; return `${i ? "L" : "M"}${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`; }).join(" ") + " Z", fill: c, stroke: "#00000055", "stroke-width": 0.4 })],
  tree: (x, y, c) => [el("rect", { x: x - 1.5, y: y + 4, width: 3, height: 10, fill: "#8b5a2b", ...line }), el("circle", { cx: x, cy: y, r: 8, fill: c, ...line })],
  umbrella: (x, y, c) => [el("path", { d: `M${x - 7},${y} Q${x},${y - 9} ${x + 7},${y} Z`, fill: c, ...line }), el("path", { d: `M${x},${y} L${x},${y + 7} q0,1.5 -1.5,1.5`, fill: "none", stroke: OUT, "stroke-width": 0.9 })],
};

export function scene(card, title) {
  if (card.country) return countryCard(card.country);
  const night = card.sky === "night";
  const svg = el("svg", { viewBox: "0 0 100 100", class: "scene", role: "img", "aria-label": `Picture: ${title}` },
    el("rect", { x: 0, y: 0, width: 100, height: 100, fill: night ? "#1b2a4a" : "#cfe8ff" }),
    el("rect", { x: 0, y: 62, width: 100, height: 38, fill: night ? "#2b3d2b" : "#a8d8a0" }),
    night ? el("circle", { cx: 88, cy: 88, r: 0 }) : el("circle", { cx: 92, cy: 8, r: 5, fill: "#ffd84d" }));
  for (const it of card.items) for (const part of DRAW[it.kind](it.x, it.y, COLOURS[it.colour], it.text)) svg.append(part);
  return svg;
}

let timer = null;
let timerKey = "";
let sent = false;

function stopTimer() { if (timer) clearInterval(timer); timer = null; }

export function render(match, { send, players, you, components: { h, bigButton, dice, ruleHelp } }) {
  const v = match.view;
  const activeName = v.active === you ? "You" : players[v.active]?.name || "The other player";
  const mine = v.active === you;
  const key = `${match.version}`;
  if (timerKey !== key) { stopTimer(); timerKey = key; sent = false; }

  const header = h("p", {}, `Picture ${v.round + 1} of ${v.rounds}. Points: you ${v.points[you]}, ${players[1 - you]?.name || "them"} ${v.points[1 - you]}.`);
  const help = ruleHelp("How to play Look & Remember", [
    "Take turns exploring country cards. Look at the landmark, flag, labels, traveller and birds.",
    v.studySeconds ? `You have ${v.studySeconds} seconds; press “I'm ready” sooner if you like.` : "There's no time limit: press “I'm ready” when you've had a good look.",
    "Then the picture is hidden, the dice is rolled, and you're asked one of six questions about it. Choose the answer you remember.",
    "Each right answer scores a point. If a question seems unclear, either of you can flag it to be checked.",
  ]);

  if (v.phase === "study") {
    let countdown = null;
    if (mine && v.studySeconds) {
      countdown = h("p", { class: "timer", id: "study-timer", "aria-live": "off" }, `${v.studySeconds} seconds left`);
      if (!timer) {
        const deadline = Date.now() + v.studySeconds * 1000;
        timer = setInterval(() => {
          const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
          const t = document.getElementById("study-timer");
          if (t) t.textContent = `${left} second${left === 1 ? "" : "s"} left`;
          if (left === 0 && !sent) { sent = true; stopTimer(); send({ type: "doneStudying" }); }
        }, 250);
      }
    }
    return h("div", { class: "stack" }, header,
      h("h2", {}, mine ? `Study the picture: “${v.title}”` : `${activeName} is studying “${v.title}”`),
      countdown,
      scene(v.card, v.title),
      mine ? bigButton("I'm ready for my question", () => { sent = true; stopTimer(); send({ type: "doneStudying" }); }, { primary: true, block: true }) : null,
      help);
  }

  if (v.phase === "question") {
    return h("div", { class: "stack" }, header,
      h("div", { class: "scene-hidden" }, "The picture is hidden. Answer from memory!"),
      h("div", { class: "row" }, dice(v.die), h("p", {}, `The dice chose question ${v.die}:`)),
      h("h2", {}, v.question.text),
      mine
        ? h("div", { class: "stack" }, v.question.options.map((o) => bigButton(o, () => send({ type: "answer", option: o }), { block: true })))
        : h("p", {}, `${activeName} is choosing an answer…`),
      help);
  }

  // reveal
  const right = v.chosen === v.answer;
  return h("div", { class: "stack" }, header,
    h("h2", {}, v.question.text),
    h("p", { class: "banner banner-waiting" }, `${activeName === "You" ? "You" : activeName} said “${v.chosen}”: ${right ? "right!" : `the answer was “${v.answer}”.`}`),
    scene(v.card, v.title),
    h("div", { class: "row" },
      bigButton(match.legalActions.find((a) => a.type === "next")?.label || "Next", () => send({ type: "next" }), { primary: true }),
      v.flagged ? h("p", {}, "This question has been flagged for checking.") : bigButton("Flag this question as unclear", () => send({ type: "flag" }))),
    help);
}

export function renderResults(match, { players, you, components: { h } }) {
  const v = match.view;
  return h("section", { class: "panel stack" },
    h("h2", {}, "How each turn went"),
    h("ul", {}, v.history.map((t) => h("li", {}, `${t.seat === you ? "You" : players[t.seat]?.name}: ${t.correct ? "right" : "not quite"} (“${t.chosen}”)`))));
}
