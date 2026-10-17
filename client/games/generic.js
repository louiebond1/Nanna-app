// Fallback screen: one big button per legal action, using the server's labels.
// Real games get their own screen; this keeps any game playable meanwhile.
export function render(match, { send, components: { h, bigButton } }) {
  return h(
    "div",
    { class: "stack" },
    match.legalActions.length
      ? h("div", { class: "stack" }, match.legalActions.map((a) => bigButton(a.label, () => send(a), { block: true })))
      : null,
  );
}
