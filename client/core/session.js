// Remembers which room this device is in, so refresh or sleep resumes it.
// Storage can be unavailable (private mode, blocked site data), in which
// case the app still works but a refresh needs the invite link again.
const KEY = "nanna.session";

export function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    return s && typeof s.roomId === "string" && typeof s.token === "string" ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* storage unavailable */ }
}

export function clearSession() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function loadName() {
  try { return localStorage.getItem("nanna.name") || ""; } catch { return ""; }
}

export function saveName(name) {
  try { localStorage.setItem("nanna.name", name); } catch { /* storage unavailable */ }
}
