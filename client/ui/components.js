// Shared, presentational building blocks. They take data and callbacks and
// know nothing about rooms, sockets or game rules. The redesign can restyle
// or replace them without touching gameplay.

// h("button", { class: "btn", onclick }, "Text"). Children may be strings,
// nodes, arrays, or null/false (skipped). Strings always go in as text, never HTML.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function bigButton(label, onclick, { primary = false, disabled = false, block = false, ...rest } = {}) {
  const cls = ["btn", primary && "btn-primary", block && "btn-block"].filter(Boolean).join(" ");
  return h("button", { type: "button", class: cls, onclick, disabled, ...rest }, label);
}

// "Your turn: <what to do>" or "Waiting for <name>…". Colour is never the only cue.
export function turnBanner({ yourTurn, prompt, waitingFor }) {
  return yourTurn
    ? h("div", { class: "banner banner-yours", role: "status" }, "Your turn: ", prompt || "make your move.")
    : h("div", { class: "banner banner-waiting", role: "status" }, `Waiting for ${waitingFor}…`);
}

export function playerStatus(player, { isYou = false } = {}) {
  if (!player) return h("div", { class: "player muted" }, "Waiting for someone to join…");
  return h(
    "div",
    { class: "player" },
    h("span", { class: `status-dot ${player.connected ? "status-on" : "status-off"}`, "aria-hidden": "true" }),
    `${player.name}${isYou ? " (you)" : ""}: `,
    h("span", {}, player.connected ? "online" : "offline"),
  );
}

const SUIT_SYMBOL = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_NAME = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
const RANK_NAME = { A: "Ace", J: "Jack", Q: "Queen", K: "King" };

// A playing card. Pass onclick to make it a button; selected shows it lifted.
// The suit is written out in words as well as shown, so colour isn't needed.
export function card(c, { onclick, selected = false, faceDown = false } = {}) {
  if (faceDown) return h("div", { class: "card card-back", role: "img", "aria-label": "Face-down card" });
  const colour = c.suit === "H" || c.suit === "D" ? "card-red" : "card-black";
  const label = `${RANK_NAME[c.rank] || c.rank} of ${SUIT_NAME[c.suit]}`;
  const body = [h("span", { "aria-hidden": "true" }, c.rank), h("span", { "aria-hidden": "true" }, SUIT_SYMBOL[c.suit]), h("small", { "aria-hidden": "true" }, SUIT_NAME[c.suit])];
  if (onclick) {
    return h("button", { type: "button", class: `card ${colour}`, onclick, "aria-pressed": String(selected), "aria-label": label }, body);
  }
  return h("div", { class: `card ${colour}`, role: "img", "aria-label": label }, body);
}

export function dice(value) {
  return h("div", { class: "dice", role: "img", "aria-label": `Dice showing ${value}` }, String(value));
}

export function tile(letter, { onclick, selected = false, disabled = false } = {}) {
  return h("button", { type: "button", class: "btn tile", onclick, disabled, "aria-pressed": String(selected) }, letter);
}

export function ruleHelp(title, paragraphs) {
  return h("details", { class: "panel" }, h("summary", {}, title), paragraphs.map((p) => h("p", {}, p)));
}

// Resolves true or false. Use before anything that can't be undone.
export function confirmDialog(message, { confirmLabel = "Yes", cancelLabel = "No, go back" } = {}) {
  return new Promise((resolve) => {
    const dlg = h("dialog", { "aria-label": "Please confirm" });
    const done = (value) => { dlg.close(); dlg.remove(); resolve(value); };
    dlg.append(
      h("p", {}, message),
      h("div", { class: "row" },
        bigButton(cancelLabel, () => done(false)),
        bigButton(confirmLabel, () => done(true), { primary: true })),
    );
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); done(false); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

// Square board with row letters and column numbers. cells[r][c] is a state
// name; `look` maps it to { symbol, text, cls }. onclick(r, c) makes squares
// buttons; canClick(r, c) can switch individual squares off.
export function board(cells, { look, onclick, canClick = () => true, label }) {
  const size = cells.length;
  const rows = "ABCDEFGHIJ";
  const grid = h("div", { class: "board", role: "group", "aria-label": label });
  grid.style.setProperty("--size", size); // CSP forbids style attributes; the CSSOM is fine
  grid.append(h("span", { class: "board-head", "aria-hidden": "true" }));
  for (let c = 0; c < size; c++) grid.append(h("span", { class: "board-head", "aria-hidden": "true" }, String(c + 1)));
  for (let r = 0; r < size; r++) {
    grid.append(h("span", { class: "board-head", "aria-hidden": "true" }, rows[r]));
    for (let c = 0; c < size; c++) {
      const { symbol = "", text, cls = "" } = look(cells[r][c], r, c);
      const name = `${rows[r]}${c + 1}: ${text}`;
      grid.append(onclick && canClick(r, c)
        ? h("button", { type: "button", class: `cell ${cls}`, "aria-label": name, onclick: () => onclick(r, c) }, symbol)
        : h("span", { class: `cell ${cls}`, role: "img", "aria-label": name }, symbol));
    }
  }
  return grid;
}
