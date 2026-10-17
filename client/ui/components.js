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
  const body = [h("span", { class: "card-rank", "aria-hidden": "true" }, c.rank), h("span", { class: "card-suit", "aria-hidden": "true" }, SUIT_SYMBOL[c.suit]), h("small", { "aria-hidden": "true" }, SUIT_NAME[c.suit])];
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
  const desktop = h("div", { class: "board-desktop" }, grid);
  const overview = grid.cloneNode(true);
  overview.classList.add("board-overview");
  for (const button of overview.querySelectorAll("button")) {
    const square = h("span", { class: button.className, role: "img", "aria-label": button.getAttribute("aria-label") }, button.textContent);
    button.replaceWith(square);
  }
  const mobile = h("div", { class: "board-mobile" }, overview);
  if (onclick) {
    const prefix = `board-${label.replace(/[^a-z0-9]/gi, "-")}`;
    const row = h("select", { id: `${prefix}-row` }, Array.from({ length: size }, (_, r) => h("option", { value: r }, rows[r])));
    const col = h("select", { id: `${prefix}-column` });
    const choose = bigButton("Choose square", () => onclick(Number(row.value), Number(col.value)), { primary: true, block: true });
    const update = () => {
      const previous = col.value;
      col.replaceChildren(...Array.from({ length: size }, (_, c) => {
        const cell = look(cells[Number(row.value)][c], Number(row.value), c);
        return h("option", { value: c, disabled: !canClick(Number(row.value), c) }, `${c + 1}: ${cell.text}`);
      }));
      const available = [...col.options].find(o => !o.disabled && o.value === previous) || [...col.options].find(o => !o.disabled);
      if (available) col.value = available.value;
      choose.disabled = !available;
    };
    row.addEventListener("change", update);
    update();
    mobile.append(h("div", { class: "board-controls stack", role: "group", "aria-label": `Choose a square on ${label}` },
      h("p", {}, "Choose a row and column, then press Choose square."),
      h("div", { class: "row" },
        h("div", {}, h("label", { for: row.id }, "Row"), row),
        h("div", {}, h("label", { for: col.id }, "Column"), col)), choose));
  }
  return h("div", { class: "board-wrap" }, desktop, mobile);
}

export function gameIcon(id) {
  const paths = {
    gofish: 'M4 16Q14 3 25 16Q14 29 4 16ZM25 16L31 10V22ZM11 14h.01',
    clash: 'M6 5h13v21H6ZM14 10h13v21H14M10 12l3-4 3 4Z',
    cheat: 'M5 7h22v20H5ZM10 14h.01M22 14h.01M10 21q6-5 12 0',
    gin: 'M5 8h13v21H5ZM14 4h13v21M10 14l3 5-3 5-3-5Z',
    canasta: 'M3 10h10v18H3ZM12 7h10v21H12ZM21 4h9v24H21',
    wheel: 'M16 3v6M16 23v6M3 16h6M23 16h6M7 7l4 4M21 21l4 4M7 25l4-4M21 11l4-4M12 12h8v8h-8Z',
    grid: 'M4 4h24v24H4ZM4 12h24M4 20h24M12 4v24M20 4v24',
    whoswho: 'M9 13a7 7 0 1 1 14 0a7 7 0 1 1-14 0M4 30q1-10 12-10t12 10M12 12h.01M20 12h.01M13 17q3 2 6 0',
    fleet: 'M3 22l5 6h16l5-6ZM10 21V9h11v12M16 9V3M5 31q4-3 8 0t8 0t8 0',
    islands: 'M3 24q0-10 10-7l3-10 5 9q10-1 9 8ZM16 7V2l9 3-9 3',
    memory: 'M4 6h24v23H4ZM8 23l6-8 5 5 3-4 4 7M10 11h.01',
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 32 34", fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", paths[id] || paths.gin);
  svg.append(path);
  return h("span", { class: "game-icon", "aria-hidden": "true" }, svg);
}

export function brand() {
  const mark = gameIcon("canasta");
  mark.className = "game-icon brand-mark";
  return h("header", { class: "brand" }, mark, h("span", {}, "Nanna Games"), h("span", { class: "brand-note" }, "A little time together"));
}
