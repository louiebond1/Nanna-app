import { createRequire } from "module";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Playwright: set PW_ROOT to its install folder, e.g. PW_ROOT=$(npm root -g)/playwright
const require = createRequire(process.env.PW_ROOT + "/");
const { chromium } = require("playwright");
const SHOTS = path.join(ROOT, "docs", "screenshots");
const URL = process.env.QA_URL || "http://localhost:3123";
const log = [];
const browser = await chromium.launch();
const nanna = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1 });
const sam = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const a = await nanna.newPage(); let b = await sam.newPage();
for (const [n, p] of [["A", a], ["B", b]]) {
  p.on("console", (m) => m.type() === "error" && log.push(`${n} console error: ${m.text()}`));
  p.on("pageerror", (e) => log.push(`${n} page error: ${e.message}`));
}
const shot = (p, name) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (s) => { log.push("OK: " + s); };

await a.goto(URL);
await a.fill("#name", "Nanna");
await a.click("text=Start a room");
await a.waitForSelector(".code");
const code = await a.textContent(".code");
await shot(a, "01-lobby-waiting-for-player");
step(`room created, code ${code}`);

const roomId = await a.evaluate(() => JSON.parse(localStorage.getItem("nanna.session")).roomId);
await b.goto(`${URL}/#join=${roomId}`);
await b.waitForSelector("text=You've been invited");
await b.fill("#join-name", "Sam");
await b.click("text=Join the game");
await b.waitForSelector("text=Choose a game");
step("Sam joined via invite link (phone viewport)");
await a.waitForSelector("text=Sam (you)", { state: "detached" });
await a.waitForSelector("text=online >> nth=1");

await a.click("text=High Card (test)");
await a.click("text=I'm ready");
await b.waitForSelector("text=Nanna is ready.");
await shot(b, "02-lobby-choose-and-ready");
await b.click("text=I'm ready");
await a.waitForSelector("text=Your turn");
await b.waitForSelector("text=Waiting for Nanna");
await shot(a, "03-your-turn");
await shot(b, "04-waiting");
step("game started on both devices; turn banners correct");

// reload Sam's phone mid-game (refresh / sleep)
await a.click(".btn-block >> nth=0");
await b.waitForSelector("text=Your turn");
await b.reload();
await b.waitForSelector("text=Your turn", { timeout: 5000 });
step("Sam refreshed mid-game and resumed on his turn");

// Server restart mid-game: both should show reconnecting, then resume the same turn.
const { execSync } = await import("child_process");
execSync(`kill $(cat ${process.env.QA_DATA}/pid)`);
await b.waitForSelector("text=Connection lost", { timeout: 15000 });
await shot(b, "05-reconnecting");
execSync(`${process.env.QA_RUN} ${process.env.QA_DATA} ${process.env.QA_LOG} scripts/dev-test-game.js`, { env: { ...process.env, QA_PORT: "3123" } });
await b.waitForSelector("#connection", { state: "hidden", timeout: 20000 });
await b.waitForSelector("text=Your turn", { timeout: 5000 });
await a.waitForSelector("text=Waiting for Sam", { timeout: 5000 });
step("server restarted mid-game: phone showed reconnecting banner, both resumed the same turn");
// Opponent offline indicator: close Sam's page, tablet should show offline.
await b.close();
await a.waitForSelector("text=offline", { timeout: 5000 });
await shot(a, "06-opponent-offline");
step("closing Sam's page shows him offline on Nanna's tablet");
b = await sam.newPage();
b.on("pageerror", (e) => log.push(`B page error: ${e.message}`));
await b.goto(URL);
await b.waitForSelector("text=Your turn", { timeout: 5000 });
step("Sam reopened the app with no link and went straight back into his turn");

// Play out
for (let i = 0; i < 5; i++) {
  const p = i % 2 === 0 ? b : a;
  await p.waitForSelector("text=Your turn");
  await p.click(".btn-block >> nth=0");
  await p.waitForTimeout(150);
}
await a.waitForSelector("text=game over");
await b.waitForSelector("text=game over");
await shot(a, "07-results");
step("played to the end; results on both");

await a.click("text=Play again");
await b.waitForSelector("text=Nanna wants a rematch.");
await b.click("text=Play again");
await a.waitForSelector("text=Your turn, text=Waiting for Sam".split(", ")[0]).catch(() => {});
await a.waitForSelector(".banner");
const banner = await a.textContent(".banner");
step(`rematch started: Nanna sees "${banner.trim()}"`);

// Leave with confirm
await b.click("text=Leave room");
await b.waitForSelector("dialog");
await shot(b, "08-confirm-leave");
await b.click("text=Yes, leave");
await b.waitForSelector("text=Start a room");
await a.waitForSelector("text=Sam left the room.");
step("leave asks for confirmation; other player sees plain notice");

// Bad code
await b.fill("#code", "ZZZZZZ");
await b.click("button:text-is('Join')");
await b.waitForSelector("text=couldn't find that room");
await shot(b, "09-invalid-code");
step("unknown code gives a plain-English message");

// horizontal overflow check
for (const [n, p] of [["tablet", a], ["phone", b]]) {
  const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  log.push(`${over ? "FAIL" : "OK"}: ${n} has no horizontal scroll`);
}
console.log(log.join("\n"));
await browser.close();

process.exitCode = log.some((l) => l.startsWith("FAIL")) ? 1 : 0;
