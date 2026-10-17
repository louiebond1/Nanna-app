// Letter Wheel screen: tap letters (or type) to make words.
let typed = [];        // indexes into the wheel letters, in order tapped
let order = null;      // client-only shuffle of the outer letters
let orderFor = "";

export function render(match, { send, components: { h, bigButton, tile, ruleHelp, confirmDialog } }) {
  const v = match.view;
  const key = v.outer.join("");
  if (orderFor !== key) { order = v.outer.map((_, i) => i); orderFor = key; typed = []; }
  const letters = [v.centre, ...v.outer]; // index 0 is the middle letter
  const current = typed.map((i) => letters[i]).join("");
  const redraw = () => send.redraw();

  const submit = async (word) => {
    if (!word) return;
    const res = await send({ type: "word", word });
    if (res?.ok) { typed = []; const input = document.getElementById("wheel-type"); if (input) input.value = ""; redraw(); }
  };

  if (v.youFinished) {
    return h("div", { class: "stack" },
      h("p", {}, v.opponentFinished ? "Working out the results…" : "You've finished. Waiting for the other player to finish too."),
      h("p", {}, `You found ${v.yourWords.length} words for ${v.yourScore} points.`));
  }

  const letterTile = (i) => tile(letters[i].toUpperCase(), {
    onclick: () => { typed.push(i); redraw(); },
    disabled: typed.includes(i),
  });
  const outerTiles = order.map((o) => letterTile(o + 1));
  const centreTile = tile(v.centre.toUpperCase(), { onclick: () => { typed.push(0); redraw(); }, disabled: typed.includes(0) });
  centreTile.classList.add("tile-centre");
  centreTile.setAttribute("aria-label", `${v.centre.toUpperCase()}, the middle letter: every word must use it`);

  return h("div", { class: "stack" },
    h("p", {}, `Make words of 4 to 7 letters. Every word must use the middle letter, ${v.centre.toUpperCase()}. Each letter can be used once per word.`),
    h("div", { class: "wheel", role: "group", "aria-label": "Letter wheel" },
      h("div", { class: "row" }, outerTiles.slice(0, 2)),
      h("div", { class: "row" }, outerTiles[2], centreTile, outerTiles[3]),
      h("div", { class: "row" }, outerTiles.slice(4))),
    h("div", { class: "word-entry", "aria-live": "polite", "aria-label": "Word so far" }, current.toUpperCase() || "…"),
    h("div", { class: "row" },
      bigButton("Enter word", () => submit(current), { primary: true, disabled: current.length === 0 }),
      bigButton("Delete letter", () => { typed.pop(); redraw(); }, { disabled: !typed.length }),
      bigButton("Clear", () => { typed = []; redraw(); }, { disabled: !typed.length }),
      bigButton("Shuffle letters", () => {
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        redraw();
      })),
    h("form", { class: "stack", onsubmit: (e) => { e.preventDefault(); submit(document.getElementById("wheel-type").value); } },
      h("label", { for: "wheel-type" }, "Or type a word:"),
      h("div", { class: "row" },
        h("input", { id: "wheel-type", type: "text", autocomplete: "off", autocapitalize: "none", spellcheck: "false", maxlength: 7 }),
        h("button", { type: "submit", class: "btn" }, "Enter"))),
    h("section", { class: "panel stack" },
      h("h2", {}, `Your words: ${v.yourWords.length} (${v.yourScore} points)`),
      v.yourWords.length ? h("ul", { class: "word-list" }, v.yourWords.map((w) => h("li", {}, w.toUpperCase()))) : h("p", {}, "None yet."),
      h("p", {}, `The other player has found ${v.opponentWordCount} word${v.opponentWordCount === 1 ? "" : "s"}.`)),
    bigButton("I've finished", async () => {
      if (await confirmDialog("Finish now? You can't add more words afterwards.", { confirmLabel: "Yes, I've finished" })) send({ type: "finish" });
    }, { block: true }),
    ruleHelp("How to play Letter Wheel", [
      "Make as many words as you can from the seven letters. There's no time limit.",
      "Every word must include the middle letter and have at least 4 letters. Each letter can only be used once in a word.",
      "Names, abbreviations and hyphenated words don't count. Plurals are fine.",
      "Scoring: 4 letters = 1 point, 5 letters = 2, 6 letters = 3. A word using all seven letters scores 10.",
      "You can't see each other's words until you've both pressed “I've finished”.",
    ]));
}

export function renderResults(match, { players, you, components: { h } }) {
  const v = match.view;
  const opp = players[1 - you]?.name || "Other player";
  const list = (ws) => (ws.length ? h("ul", { class: "word-list" }, ws.map((w) => h("li", {}, w.toUpperCase()))) : h("p", {}, "None"));
  return h("section", { class: "panel stack" },
    h("p", {}, `The seven-letter word was ${v.longest.toUpperCase()}.`),
    h("h2", {}, `Your words (${v.yourScore} points)`), list(v.yourWords),
    h("h2", {}, `${opp}'s words (${v.opponentScore} points)`), list(v.opponentWords),
    h("h2", {}, "Everyday words nobody found"), list(v.missed));
}
