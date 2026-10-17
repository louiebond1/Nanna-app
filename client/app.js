// Screen flow: home -> lobby -> playing -> results. Only reads the room
// state from the server and calls the connection; no game rules live here.
import { createConnection } from "./core/connection.js";
import { loadName, saveName } from "./core/session.js";
import * as components from "./ui/components.js";
import { screenFor } from "./games/registry.js";

const { h, bigButton, turnBanner, playerStatus, confirmDialog } = components;
const app = document.getElementById("app");
const connectionBar = document.getElementById("connection");

let state = null;     // latest room state from the server
let message = null;   // plain-English error or tip for the last thing tried
let busy = false;

const conn = createConnection({
  onState(next) {
    if (state?.match?.version !== next.match?.version || state?.status !== next.status) message = null;
    state = next;
    draw();
  },
  onStatus(status) {
    connectionBar.hidden = status === "connected";
    connectionBar.textContent = status === "connected" ? "" : "Connection lost. Reconnecting… your game is saved.";
    if (status === "connected" && !conn.hasSession()) draw();
  },
  onGone(text) {
    state = null;
    message = text;
    draw();
  },
});

const inviteId = () => new URLSearchParams(location.hash.slice(1)).get("join");

// Runs a server call, showing its error (if any) in plain English.
async function attempt(fn) {
  if (busy) return { error: null };
  busy = true;
  try {
    const res = await fn();
    message = res && res.error ? res.error : null;
    if (res && res.ok && inviteId()) history.replaceState(null, "", location.pathname);
    return res;
  } finally {
    busy = false;
    draw();
  }
}

function alertBox() {
  return message ? h("div", { class: "alert", role: "alert" }, message) : null;
}

function nameField(id) {
  return h("div", {},
    h("label", { for: id }, "Your name"),
    h("input", { id, type: "text", maxlength: 20, autocomplete: "nickname", value: loadName() }));
}

const readName = (id) => {
  const name = document.getElementById(id).value.trim();
  saveName(name);
  return name;
};

function homeScreen() {
  const invite = inviteId();
  if (invite) {
    return h("div", { class: "stack" },
      h("h1", {}, "You've been invited to play"),
      alertBox(),
      nameField("join-name"),
      bigButton("Join the game", () => attempt(() => conn.joinRoom(invite, readName("join-name"))), { primary: true, block: true }));
  }
  return h("div", { class: "stack" },
    h("h1", {}, "Nanna Games"),
    alertBox(),
    nameField("name"),
    h("section", { class: "panel stack" },
      h("h2", {}, "Start a new room"),
      h("p", { class: "muted" }, "You'll get a link and a code to send to the other player."),
      bigButton("Start a room", () => attempt(() => conn.createRoom(readName("name"))), { primary: true, block: true })),
    h("section", { class: "panel stack" },
      h("h2", {}, "Join a room"),
      h("div", {}, h("label", { for: "code" }, "Room code"),
        h("input", { id: "code", type: "text", maxlength: 10, autocomplete: "off", autocapitalize: "characters", inputmode: "text" })),
      bigButton("Join", () => attempt(() => conn.joinRoom(document.getElementById("code").value, readName("name"))), { block: true })));
}

function playersPanel() {
  return h("section", { class: "panel stack", "aria-label": "Players" },
    state.players.map((p, i) => playerStatus(p, { isYou: i === state.you })));
}

function leaveButton() {
  return bigButton("Leave room", async () => {
    const playing = state.status === "playing";
    const ok = await confirmDialog(playing
      ? "Leave the room? The current game will end for both of you."
      : "Leave the room? You'll need a new invite to come back.", { confirmLabel: "Yes, leave" });
    if (ok) attempt(() => conn.leave()).then(() => { state = null; draw(); });
  });
}

function inviteBlock() {
  const link = `${location.origin}/#join=${state.roomId}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      message = "Link copied. Send it to the other player.";
    } catch {
      message = `Copy this link: ${link}`;
    }
    draw();
  };
  return h("section", { class: "panel stack" },
    h("h2", {}, "Invite the other player"),
    h("p", {}, "Send them the link, or tell them this code:"),
    h("div", { class: "code", "aria-label": `Room code ${state.code.split("").join(" ")}` }, state.code),
    navigator.share
      ? bigButton("Share the invite link", () => navigator.share({ title: "Nanna Games", url: link }).catch(() => {}), { block: true })
      : bigButton("Copy the invite link", copy, { block: true }));
}

function settingsBlock(game) {
  const options = game.settingsOptions || {};
  const keys = Object.keys(options);
  if (!keys.length) return null;
  return h("div", { class: "stack" }, keys.map((key) => {
    const opt = options[key];
    const id = `setting-${key}`;
    const current = state.lobby.settings?.[key];
    return h("div", {},
      h("label", { for: id }, opt.label),
      h("select", { id, onchange: (e) => {
        const value = opt.choices.find((c) => String(c.value) === e.target.value).value;
        attempt(() => conn.chooseGame(game.id, { ...state.lobby.settings, [key]: value }));
      } }, opt.choices.map((c) => h("option", { value: c.value, selected: c.value === current }, c.label))));
  }));
}

function lobbyScreen() {
  const other = state.players[1 - state.you];
  const chosen = state.games.find((g) => g.id === state.lobby.gameId);
  const ready = state.lobby.ready;
  return h("div", { class: "stack" },
    h("h1", {}, "Your room"),
    state.notice ? h("p", {}, state.notice) : null,
    alertBox(),
    playersPanel(),
    other ? null : inviteBlock(),
    h("section", { class: "panel stack" },
      h("h2", {}, "Choose a game"),
      state.games.length
        ? h("div", { class: "stack" }, state.games.map((g) =>
            bigButton(g.id === state.lobby.gameId ? `✓ ${g.title} (chosen)` : g.title,
              () => attempt(() => conn.chooseGame(g.id, g.defaultSettings)),
              { block: true, "aria-pressed": String(g.id === state.lobby.gameId) })))
        : h("p", {}, "No games are ready yet. They're being built and tested.")),
    chosen ? h("section", { class: "panel stack" },
      h("h2", {}, chosen.title),
      chosen.blurb ? h("p", {}, chosen.blurb) : null,
      settingsBlock(chosen),
      h("p", {}, ready[state.you] ? "You're ready." : "Press Ready when you're happy with the game and settings."),
      other ? h("p", {}, ready[1 - state.you] ? `${other.name} is ready.` : `${other.name} isn't ready yet.`) : h("p", { class: "muted" }, "The game starts when both players are here and ready."),
      bigButton(ready[state.you] ? "I'm not ready" : "I'm ready", () => attempt(() => conn.setReady(!ready[state.you])), { primary: !ready[state.you], block: true }))
      : null,
    leaveButton());
}

function eventsBlock(match) {
  if (!match.events.length) return null;
  return h("section", { class: "panel", "aria-label": "What just happened" },
    h("h2", {}, "Last move"),
    h("ul", { class: "events" }, match.events.map((e) => h("li", {}, e.text))));
}

function gameScreen() {
  const match = state.match;
  const other = state.players[1 - state.you];
  const send = (move) => attempt(() => conn.sendMove(move));
  send.redraw = draw; // screens call this after a local-only change (e.g. selecting a card)
  // send() resolves with the server's answer ({ ok } or { error }).
  const screen = screenFor(match.gameId);
  return h("div", { class: "stack" },
    h("h1", {}, match.title),
    turnBanner({ yourTurn: match.yourTurn, prompt: match.view.prompt, waitingFor: other ? other.name : "the other player" }),
    alertBox(),
    eventsBlock(match),
    screen.render(match, { send, you: state.you, players: state.players, components }),
    playersPanel(),
    leaveButton());
}

function resultsScreen() {
  const match = state.match;
  const { outcome } = match;
  const other = state.players[1 - state.you];
  const youVoted = state.rematch[state.you];
  return h("div", { class: "stack" },
    h("h1", {}, `${match.title}: game over`),
    h("div", { class: "banner banner-yours", role: "status" },
      outcome.winner === null ? "It's a draw." : outcome.winner === state.you ? "You won!" : `${state.players[outcome.winner]?.name || "The other player"} won.`),
    h("p", {}, outcome.summary),
    eventsBlock(match),
    screenFor(match.gameId).renderResults?.(match, { you: state.you, players: state.players, components }) ?? null,
    h("section", { class: "panel stack" },
      h("h2", {}, "Scores"),
      state.players.map((p, i) => h("p", {}, `${p ? p.name : `Player ${i + 1}`}: ${outcome.scores[i]}${outcome.unit ? ` ${outcome.unit}` : ""}`))),
    alertBox(),
    state.notice ? h("p", {}, state.notice) : null,
    other
      ? bigButton(youVoted ? `Waiting for ${other.name} to agree to a rematch…` : "Play again", () => attempt(() => conn.rematch()), { primary: !youVoted, disabled: youVoted, block: true })
      : h("p", {}, "The other player has left."),
    bigButton("Choose a different game", () => attempt(() => conn.chooseGame(match.gameId, match.settings)), { block: true }),
    leaveButton());
}

function draw() {
  // Keep keyboard focus on the same control across redraws where possible.
  const focusedId = document.activeElement?.id;
  const focusedLabel = document.activeElement?.tagName === "BUTTON" ? document.activeElement.textContent : null;
  const typed = [...app.querySelectorAll("input[id]")].map((i) => [i.id, i.value]);

  let view;
  if (!state) view = conn.hasSession() ? h("p", {}, "Rejoining your room…") : homeScreen();
  else if (state.status === "lobby") view = lobbyScreen();
  else if (state.status === "playing") view = gameScreen();
  else view = resultsScreen();
  app.replaceChildren(view);

  for (const [id, value] of typed) {
    const input = document.getElementById(id);
    if (input) input.value = value;
  }
  const again = (focusedId && document.getElementById(focusedId))
    || (focusedLabel && [...app.querySelectorAll("button")].find((b) => b.textContent === focusedLabel));
  if (again) again.focus();
}

draw();
