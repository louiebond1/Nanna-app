// Word Grid screen: tap neighbouring squares to spell a word, or type it.
let path = [];
let gridKey = "";
let hint = "";

const N = 4;
const touching = (a, b) => a !== b && Math.abs(Math.floor(a / N) - Math.floor(b / N)) <= 1 && Math.abs((a % N) - (b % N)) <= 1;
const show = (cell) => (cell === "qu" ? "Qu" : cell.toUpperCase());

export function render(match, { send, components: { h, bigButton, ruleHelp, confirmDialog } }) {
  const v = match.view;
  if (gridKey !== v.cells.join("")) { gridKey = v.cells.join(""); path = []; hint = ""; }
  const current = path.map((i) => v.cells[i]).join("");
  const redraw = () => send.redraw();

  if (v.youFinished) {
    return h("div", { class: "stack" },
      h("p", {}, v.opponentFinished ? "Working out the results…" : "You've finished. Waiting for the other player to finish too."),
      h("p", {}, `You found ${v.yourWords.length} words.`));
  }

  const tap = (i) => {
    hint = "";
    if (path[path.length - 1] === i) path.pop();                 // tap the last square again to undo it
    else if (path.includes(i)) hint = "You've already used that square in this word.";
    else if (path.length && !touching(path[path.length - 1], i)) hint = "That square isn't next to the last one. Squares must touch, diagonals included.";
    else path.push(i);
    redraw();
  };
  const submit = async (word) => {
    if (!word) return;
    const res = await send({ type: "word", word });
    if (res?.ok) { path = []; hint = ""; const input = document.getElementById("grid-type"); if (input) input.value = ""; redraw(); }
  };

  const grid = h("div", { class: "lettergrid", role: "group", "aria-label": "Letter grid" },
    v.cells.map((cell, i) => {
      const step = path.indexOf(i);
      const r = Math.floor(i / N) + 1;
      const c = (i % N) + 1;
      return h("button", {
        type: "button", class: "btn tile", "aria-pressed": String(step !== -1),
        "aria-label": `${show(cell)}, row ${r}, column ${c}${step !== -1 ? `, letter ${step + 1} of your word` : ""}`,
        onclick: () => tap(i),
      }, step !== -1 ? h("span", { class: "step", "aria-hidden": "true" }, String(step + 1)) : null, show(cell));
    }));
  grid.style.setProperty("--size", N);

  return h("div", { class: "stack" },
    grid,
    h("div", { class: "word-entry", "aria-live": "polite", "aria-label": "Word so far" }, current.toUpperCase() || "…"),
    hint ? h("p", { class: "alert", role: "status", "data-local-error": true, ondismiss: () => { hint = ""; redraw(); } }, hint) : null,
    h("div", { class: "row" },
      bigButton("Enter word", () => submit(current), { primary: true, disabled: !current }),
      bigButton("Delete letter", () => { path.pop(); hint = ""; redraw(); }, { disabled: !path.length }),
      bigButton("Clear", () => { path = []; hint = ""; redraw(); }, { disabled: !path.length })),
    h("form", { class: "stack", onsubmit: (e) => { e.preventDefault(); submit(document.getElementById("grid-type").value); } },
      h("label", { for: "grid-type" }, "Or type a word:"),
      h("div", { class: "row" },
        h("input", { id: "grid-type", type: "text", autocomplete: "off", autocapitalize: "none", spellcheck: "false", maxlength: 16 }),
        h("button", { type: "submit", class: "btn" }, "Enter"))),
    h("section", { class: "panel stack" },
      h("h2", {}, `Your words: ${v.yourWords.length}`),
      v.yourWords.length ? h("ul", { class: "word-list" }, v.yourWords.map((w) => h("li", {}, w.toUpperCase()))) : h("p", {}, "None yet."),
      h("p", {}, `The other player has found ${v.opponentWordCount} word${v.opponentWordCount === 1 ? "" : "s"}.`)),
    bigButton("I've finished", async () => {
      if (await confirmDialog("Finish now? You can't add more words afterwards.", { confirmLabel: "Yes, I've finished" })) send({ type: "finish" });
    }, { block: true }),
    ruleHelp("How to play Word Grid", [
      "Find words by joining squares that touch, across, up and down or diagonally. Each square can only be used once in a word.",
      "Words need at least 3 letters. “Qu” is one square. Names and abbreviations don't count; plurals are fine.",
      "There's no time limit. Press “I've finished” when you're done.",
      "Scoring: 3 or 4 letters = 1 point, 5 = 2, 6 = 3, 7 = 5, 8 or more = 11.",
      v.shared === "cancel"
        ? "Words you both find score nothing (the standard rule), so look for unusual ones!"
        : "Words you both find score for both of you.",
    ]));
}

export function renderResults(match, { players, you, components: { h } }) {
  const v = match.view;
  const opp = players[1 - you]?.name || "Other player";
  const both = new Set(v.bothFound);
  const list = (ws) => (ws.length
    ? h("ul", { class: "word-list" }, ws.map((w) => h("li", {}, w.toUpperCase() + (both.has(w) ? " (both found)" : ""))))
    : h("p", {}, "None"));
  return h("section", { class: "panel stack" },
    h("h2", {}, `Your words (${v.scores[you]} points)`), list(v.yourWords),
    h("h2", {}, `${opp}'s words (${v.scores[1 - you]} points)`), list(v.opponentWords),
    v.shared === "cancel" && v.bothFound.length ? h("p", {}, "Words you both found score nothing.") : null,
    h("h2", {}, "Some everyday words nobody found"), list(v.missed));
}
