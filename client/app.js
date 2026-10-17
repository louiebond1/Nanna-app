// Screen flow: home -> lobby -> playing -> results. Only reads the room
// state from the server and calls the connection; no game rules live here.
import { createConnection } from "./core/connection.js";
import { loadName, saveName, saveSession } from "./core/session.js";
import * as components from "./ui/components.js";
import { screenFor } from "./games/registry.js";
import { workspace, view, fitWorkspace } from "./ui/workspace.js";
import { gameWorkspace } from "./ui/game-workspace.js";

const { h, bigButton, turnBanner, playerStatus, confirmDialog, gameIcon, brand } = components;
const app = document.getElementById("app");
const connectionBar = document.getElementById("connection");

let state = null;     // latest room state from the server
let message = null;   // plain-English error or tip for the last thing tried
let busy = false;
let lobbyMode = "choose";

// Demo links (scripts/demo.js) carry a session after "#session=". Adopt it,
// then remove it from the address bar so it isn't shared by accident.
const demo = new URLSearchParams(location.hash.slice(1)).get("session");
if (demo && /^[0-9a-f]{32}\.[0-9a-f]{64}$/.test(demo)) {
  const [roomId, token] = demo.split(".");
  saveSession({ roomId, token });
  history.replaceState(null, "", location.pathname);
}

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
  return h("div", { class: "home-name" },
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
  return h("div", { class: "stack home-screen" },
    h("div", { class: "home-intro" }, h("h1", {}, "Let's play."), h("p", { class: "muted" }, "Play together, at your own pace.")),
    alertBox(),
    nameField("name"),
    h("div", { class: "home-options" },
    h("section", { class: "panel stack" },
      h("h2", {}, "Start a new room"),
      bigButton("Start a room", () => attempt(() => conn.createRoom(readName("name"))), { primary: true, block: true })),
    h("section", { class: "panel stack" },
      h("h2", {}, "Join a room"),
      h("div", {}, h("label", { for: "code" }, "Room code"),
        h("input", { id: "code", type: "text", maxlength: 10, autocomplete: "off", autocapitalize: "characters", inputmode: "text" })),
      bigButton("Join", () => attempt(() => conn.joinRoom(document.getElementById("code").value, readName("name"))), { block: true }))));
}

function playersPanel() {
  return h("section", { class: "panel stack players-panel", "aria-label": "Players" },
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
  return h("section", { class: "panel stack invite-panel" },
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
  if (chosen && lobbyMode === "ready") {
    return workspace({ key: `lobby-${chosen.id}`, title: chosen.title,
      error: alertBox(),
      groups: [view("play", "Game settings", settingsBlock(chosen),
        state.notice ? h("p", {}, state.notice) : null,
        h("p", {}, ready[state.you] ? "You're ready." : "Press Ready when you're happy with the settings."),
        h("p", {}, other ? ready[1 - state.you] ? `${other.name} is ready.` : `${other.name} isn't ready yet.` : "Waiting for the other player to join.")),
        view("details", "About this game", h("p", {}, chosen.blurb)),
        view("menu", "Players & invite", playersPanel(), other ? null : inviteBlock(), leaveButton())],
      actions: [bigButton(ready[state.you] ? "I'm not ready" : "I'm ready", () => attempt(() => conn.setReady(!ready[state.you])), { primary: !ready[state.you] }),
        bigButton("Choose a game", () => { lobbyMode = "choose"; draw(); })] });
  }
  return h("div", { class: "stack" },
    h("h1", {}, "Your room"),
    state.notice ? h("p", {}, state.notice) : null,
    alertBox(),
    playersPanel(),
    other ? null : inviteBlock(),
    h("section", { class: "panel stack" },
      h("h2", {}, "Choose a game"),
      state.games.length
        ? h("div", { class: "game-picker" }, state.games.map((g) =>
            h("button", { type: "button", class: "btn game-choice", "aria-pressed": String(g.id === state.lobby.gameId),
              onclick: () => { lobbyMode = "ready"; attempt(() => conn.chooseGame(g.id, g.defaultSettings)); } },
              gameIcon(g.id),
              h("span", { class: "game-choice-title" }, g.id === state.lobby.gameId ? `✓ ${g.title} (chosen)` : g.title),
              g.blurb ? h("span", { class: "game-choice-blurb" }, g.blurb) : null)))
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
  return h("section", { class: "panel events-panel", "aria-label": "What just happened" },
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
  return gameWorkspace(screen.render(match, { send, you: state.you, players: state.players, components }), match, {
    banner: turnBanner({ yourTurn: match.yourTurn, prompt: match.view.prompt, waitingFor: other ? other.name : "the other player" }),
    error: alertBox(), menu: [eventsBlock(match), playersPanel(), leaveButton()],
  });
}

function resultsScreen() {
  const match = state.match;
  const { outcome } = match;
  const other = state.players[1 - state.you];
  const youVoted = state.rematch[state.you];
  return workspace({ key: `results-${match.gameId}`, title: `${match.title}: game over`,
    banner: h("div", { class: "banner banner-yours", role: "status" },
      outcome.winner === null ? "It's a draw." : outcome.winner === state.you ? "You won!" : `${state.players[outcome.winner]?.name || "The other player"} won.`),
    groups: [view("play", "Result", h("p", {}, outcome.summary), state.notice ? h("p", {}, state.notice) : null,
      h("section", { class: "panel stack" },
      h("h2", {}, "Scores"),
      state.players.map((p, i) => h("p", {}, `${p ? p.name : `Player ${i + 1}`}: ${outcome.scores[i]}${outcome.unit ? ` ${outcome.unit}` : ""}`)))),
      view("details", "Game details", screenFor(match.gameId).renderResults?.(match, { you: state.you, players: state.players, components })),
      view("menu", "Menu", eventsBlock(match), playersPanel(), leaveButton())],
    error: alertBox(), actions: [
    other
      ? bigButton(youVoted ? `Waiting for ${other.name} to agree to a rematch…` : "Play again", () => attempt(() => conn.rematch()), { primary: !youVoted, disabled: youVoted, block: true })
      : h("p", {}, "The other player has left."),
    bigButton("Choose a different game", () => { lobbyMode = "choose"; attempt(() => conn.chooseGame(match.gameId, match.settings)); }, { block: true })] });
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
  const fitted = view.classList?.contains("workspace");
  const selecting = !!state && state.status === "lobby" && !fitted;
  document.body.classList.toggle("selection-mode", selecting);
  document.body.classList.toggle("workspace-mode", fitted);
  document.body.classList.toggle("home-mode", !state);
  app.replaceChildren(...(fitted ? [view] : [brand(), view]));
  fitWorkspace();

  for (const [id, value] of typed) {
    const input = document.getElementById(id);
    if (input) input.value = value;
  }
  const again = (focusedId && document.getElementById(focusedId))
    || (focusedLabel && [...app.querySelectorAll("button")].find((b) => b.textContent === focusedLabel));
  if (again) again.focus();
}

// Opening a new invite link in the same tab only changes the #join= part.
window.addEventListener("hashchange", () => { if (!state) draw(); });
app.addEventListener("dismiss-game-error", () => { message = null; draw(); });

draw();
