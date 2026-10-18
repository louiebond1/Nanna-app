// Who's Who screen. Faces are drawn here from each character's features,
// so the redesign can replace the artwork without touching the rules.
import { portrait } from './portrait.js';

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

export const faceSvg = portrait;

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
    h("p", {}, `${oppName} has flipped down ${v.theirDownCount} of ${v.characters.length}.`),
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
