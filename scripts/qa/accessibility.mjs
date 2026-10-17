import { createRequire } from "module";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Playwright: set PW_ROOT to its install folder, e.g. PW_ROOT=$(npm root -g)/playwright
const require = createRequire(process.env.PW_ROOT + "/");
const { chromium } = require("playwright");
const AXE = path.join(ROOT, "node_modules", "axe-core", "axe.min.js");
const URL = process.env.QA_URL;
const GAMES = ["Go Fish", "Fleet Finder", "Colour Clash", "Cheat", "Gin Rummy", "Letter Wheel", "Word Grid", "Who's Who", "Look & Remember", "Canasta", "Island Conquest"];
const browser = await chromium.launch();
const out = [];
async function scan(page, label) {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"] })).violations
    .map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0]?.target?.join(" ") })));
  out.push({ label, r });
}
for (const scheme of ["light", "dark"]) {
  const ca = await browser.newContext({ viewport: { width: 820, height: 1180 }, colorScheme: scheme, bypassCSP: true });
  const cb = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, bypassCSP: true });
  const a = await ca.newPage(), b = await cb.newPage();
  await a.goto(URL); await scan(a, `${scheme} home`);
  await a.fill("#name", "Nanna"); await a.click("text=Start a room"); await a.waitForSelector(".code");
  await scan(a, `${scheme} lobby`);
  const roomId = await a.evaluate(() => JSON.parse(localStorage.getItem("nanna.session")).roomId);
  await b.goto(`${URL}/#join=${roomId}`); await b.fill("#join-name", "Sam"); await b.click("text=Join the game");
  await b.waitForSelector("text=Choose a game", { timeout: 5000 }).catch(async (e) => { console.log(scheme, "first join failed; B says:", (await b.textContent("main")).slice(0, 200)); throw e; });
  for (const title of GAMES) try {
    await a.click(`button:has-text("${title}")`);
    await a.click("text=I'm ready"); await b.waitForSelector("text=I'm ready"); await b.click("text=I'm ready");
    await a.waitForSelector(".banner"); await b.waitForSelector(".banner"); await a.waitForTimeout(200);
    await scan(a, `${scheme} ${title} (tablet)`); await scan(b, `${scheme} ${title} (phone)`);
    await a.click("text=Leave room"); await a.click("text=Yes, leave");
    await a.waitForSelector("text=Start a room");
    await a.click("text=Start a room"); await a.waitForSelector(".code");
    const id2 = await a.evaluate(() => JSON.parse(localStorage.getItem("nanna.session")).roomId);
    await b.click("text=Leave room"); await b.click("text=Yes, leave"); await b.waitForSelector("text=Start a room");
    await b.goto(`${URL}/#join=${id2}`); await b.click("text=Join the game");
    try { await b.waitForSelector("text=Choose a game", { timeout: 5000 }); }
    catch (e) { throw e; }
  } catch (e) {
    console.log("FAILED at", title, "\nA:", (await a.textContent("main")).slice(0, 200), "\nB:", (await b.textContent("main")).slice(0, 200));
    throw e;
  }
  await ca.close(); await cb.close();
}
await browser.close();
const agg = {};
for (const { label, r } of out) for (const v of r) (agg[`${v.impact} ${v.id}: ${v.help}`] ||= []).push(`${label} [${v.sample}]`);
for (const [k, where] of Object.entries(agg)) console.log(k, "\n   ", where.slice(0, 4).join("\n    "), where.length > 4 ? `\n    …and ${where.length - 4} more` : "");
console.log(`scanned ${out.length} screens`);

process.exitCode = Object.keys(agg).length ? 1 : 0;
