// Plays each listed game through the real UI with two browser contexts.
import { createRequire } from "module";
import path from "path";
import os from "os";
import fs from "fs";
import { installWorkspaceNavigation } from './workspace-navigation.mjs';
import { fileURLToPath } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Playwright: set PW_ROOT to its install folder, e.g. PW_ROOT=$(npm root -g)/playwright
const require = createRequire(process.env.PW_ROOT + "/");
const { chromium } = require("playwright");
const SHOTS = path.join(ROOT, "docs", "screenshots", "redesign", "playthrough");
fs.mkdirSync(SHOTS, { recursive: true });
const URL = process.env.QA_URL;
const games = process.argv.slice(2);
const log = [];
const browser = await chromium.launch(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {});

async function pair() {
  const ca = await browser.newContext({ viewport: { width: 820, height: 1180 }, reducedMotion: 'reduce' });
  const cb = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const a = await ca.newPage(), b = await cb.newPage();
  installWorkspaceNavigation(a);
  for (const [n, p] of [["tablet", a], ["phone", b]]) {
    p.on("pageerror", (e) => log.push(`FAIL ${n} page error: ${e.message}`));
    p.on("console", (m) => m.type() === "error" && log.push(`FAIL ${n} console: ${m.text()}`));
  }
  await a.goto(URL); await a.fill("#name", "Nanna"); await a.click("text=Start a room");
  await a.waitForSelector(".code");
  const roomId = await a.evaluate(() => JSON.parse(localStorage.getItem("nanna.session")).roomId);
  await b.goto(`${URL}/#join=${roomId}`); await b.fill("#join-name", "Sam"); await b.click("text=Join the game");
  await b.waitForSelector("text=Choose a game");
  return { a, b, close: () => Promise.all([ca.close(), cb.close()]) };
}

async function start(a, b, title) {
  await a.click(`button:has-text("${title}")`);
  if (title === "Island Conquest") { await a.selectOption("#setting-maxRounds", "10"); await a.waitForTimeout(150); }
  if (title === "Canasta") { await a.selectOption("#setting-target", "1"); await a.waitForTimeout(150); }
  if (title === "Look & Remember") {
    await a.selectOption("#setting-studySeconds", "10");
    await a.waitForTimeout(150);
    await a.selectOption("#setting-cardsEach", "3");
    await a.waitForTimeout(150);
  }
  await a.click("text=I'm ready");
  await b.waitForSelector("text=I'm ready");
  await b.click("text=I'm ready");
  await a.waitForSelector(".banner");
}

const whoseTurn = async (a, b) => {
  for (let i = 0; i < 100; i++) {
    if (await a.locator("text=game over").count()) return null;
    for (const p of [a, b]) if (await p.locator(".banner-yours").count()) return p;
    await a.waitForTimeout(50);
  }
  throw new Error("nobody's turn");
};

const strategies = {
  async gofish({ a, b, id }) {
    let shotTaken = false;
    for (let i = 0; i < 400; i++) {
      const p = await whoseTurn(a, b);
      if (!p) break;
      if (!shotTaken && p === a) { await p.screenshot({ path: `${SHOTS}/${id}-your-turn.png`, fullPage: true }); shotTaken = true; }
      await p.locator("button.card").first().click();
      await p.locator("button:has-text('Ask ')").click();
      await p.waitForTimeout(30);
    }
  },
  async clash({ a, b, id }) {
    let shot = false, invalid = false;
    for (let i = 0; i < 600; i++) {
      const p = await whoseTurn(a, b);
      if (!p) break;
      if (!shot && p === a) { await p.screenshot({ path: `${SHOTS}/${id}-your-turn.png`, fullPage: true }); shot = true; }
      if (!invalid && await p.locator("button.ccard.not-playable").count()) {
        await p.locator("button.ccard.not-playable").first().click();
        await p.waitForSelector("text=doesn't match");
        await p.screenshot({ path: `${SHOTS}/${id}-invalid-move.png`, fullPage: true });
        log.push("OK clash: tapping an unplayable card explains why");
        invalid = true;
        continue;
      }
      const playable = p.locator("button.ccard.playable");
      if (await playable.count()) {
        await playable.first().click();
        if (await p.locator("text=Choose the new colour").count()) await p.click("button:has-text('Blue')");
      } else {
        await p.locator("button.btn-block:has-text('Draw a card'), button.btn-block:has-text('Keep the card'), button.btn-block:has-text('pass')").first().click();
      }
      await p.waitForTimeout(20);
    }
  },
  async cheat({ a, b, id }) {
    let shot = false, n = 0;
    for (let i = 0; i < 3000; i++) {
      const p = await whoseTurn(a, b);
      if (!p) break;
      if (await p.locator("text=Call “Cheat!”").count()) {
        if (!shot && p === a) { await p.screenshot({ path: `${SHOTS}/${id}-respond.png`, fullPage: true }); shot = true; }
        await p.click(n++ % 4 === 0 ? "text=Call “Cheat!”" : "button:has-text('Believe')");
      } else {
        // honest if possible: tap cards of the required rank, else the first card
        const need = (await p.textContent("text=/must be called/")).match(/called (\w+)\./)[1];
        const names = { Aces: "A", Twos: "2", Threes: "3", Fours: "4", Fives: "5", Sixes: "6", Sevens: "7", Eights: "8", Nines: "9", Tens: "10", Jacks: "J", Queens: "Q", Kings: "K" };
        const word = { A: "Ace", J: "Jack", Q: "Queen", K: "King" }[names[need]] || null;
        const honest = p.locator(`button.card[aria-label^="${word || ["", "", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"][Number(names[need])]} of"]`);
        const count = Math.min(await honest.count(), 4);
        if (count) for (let k = 0; k < count; k++) await honest.nth(k).click();
        else await p.locator("button.card").first().click();
        await p.click("button:has-text('Put down')");
      }
      await p.waitForTimeout(15);
    }
  },
  async gin({ a, b, id }) {
    let shot = false, knocked = false;
    for (let i = 0; i < 3000; i++) {
      if (await a.locator("text=game over").count()) break;
      const next = a.locator("button:has-text('Next hand')");
      if (await next.count()) {
        if (!knocked) { await a.screenshot({ path: `${SHOTS}/${id}-hand-over.png`, fullPage: true }); knocked = true; }
        await next.click(); await a.waitForTimeout(50); continue;
      }
      const p = await whoseTurn(a, b);
      if (!p) break;
      if (await p.locator("button:has-text('Take the top card from the stock')").count()) {
        await p.click("button:has-text('Take the top card from the stock')");
      } else {
        if (!shot && p === a) { await p.screenshot({ path: `${SHOTS}/${id}-your-turn.png`, fullPage: true }); shot = true; }
        // pick the highest-value deadwood card: last card in the deadwood row, else last card
        const cards = p.locator("button.card");
        await cards.nth((await cards.count()) - 1).click();
        const knock = p.locator("button:has-text('and knock'), button:has-text('go Gin')");
        if (await knock.count()) { await knock.click(); await p.click("text=Yes, knock"); }
        else await p.locator("button.btn-primary:has-text('Discard the')").click();
      }
      await p.waitForTimeout(15);
    }
  },
  async wheel({ a, b, id }) {
    // Nanna taps letters to try the seven-letter word's anagram... we don't know it, so try typed guesses.
    await a.waitForSelector(".wheel");
    // invalid: too short
    await a.click(".tile-centre");
    await a.click("text=Enter word");
    await a.waitForSelector("text=at least 4 letters");
    await a.screenshot({ path: `${SHOTS}/${id}-invalid-move.png`, fullPage: true });
    log.push("OK wheel: a too-short word gets a plain-English message");
    await a.click("text=Clear");
    // Find real answers from the letters with a tiny dictionary scan in the test process.
    const letters = (await a.locator(".wheel .tile").allTextContents()).map((t) => t.toLowerCase());
    const centre = (await a.locator(".tile-centre").textContent()).toLowerCase();
    const fs = await import("fs");
    const dict = fs.readFileSync(path.join(ROOT, "server", "words", "data", "common.txt"), "utf8").split("\n");
    const can = (w) => { const pool = letters.slice(); for (const ch of w) { const i = pool.indexOf(ch); if (i < 0) return false; pool.splice(i, 1); } return true; };
    const answers = dict.filter((w) => w.length >= 4 && w.length <= 7 && w.includes(centre) && can(w));
    for (const [p, list] of [[a, answers.slice(0, 4)], [b, answers.slice(2, 5)]]) {
      for (const w of list) { await p.fill("#wheel-type", w); await p.click("form button:has-text('Enter')"); await p.waitForSelector(`li:text-is("${w.toUpperCase()}")`); }
    }
    // tap-to-spell the first answer is already found; check repeat error via typing
    await a.fill("#wheel-type", answers[0]); await a.click("form button:has-text('Enter')");
    await a.waitForSelector("text=already got");
    await a.screenshot({ path: `${SHOTS}/${id}-your-turn.png`, fullPage: true });
    log.push(`OK wheel: both players entered real words (${answers.length} everyday answers on this wheel); repeat word refused`);
    for (const p of [a, b]) { await p.click("text=I've finished"); await p.click("text=Yes, I've finished"); }
  },
  async grid({ a, b, id }) {
    await a.waitForSelector(".lettergrid");
    // invalid tap: two squares that don't touch (top-left then bottom-right)
    const tiles = a.locator(".lettergrid .tile");
    await tiles.nth(0).click(); await tiles.nth(15).click();
    await a.waitForSelector("text=isn't next to the last one");
    await a.screenshot({ path: `${SHOTS}/${id}-invalid-move.png`, fullPage: true });
    log.push("OK grid: tapping a square that doesn't touch explains the rule");
    await a.click("text=Clear");
    // find real words with the server's own solver, then spell the first by tapping
    const cells = (await tiles.allTextContents()).map((t) => t.replace(/^\d+/, "").toLowerCase());
    const { createRequire } = await import("module");
    const req = createRequire(ROOT + "/");
    const g = req("./server/games/grid");
    const words = req("./server/words");
    const found = [...g.solve(cells)].filter((w) => words.isCommon(w));
    const first = found[0];
    const path = g.trace(cells, first);
    for (const i of path) await tiles.nth(i).click();
    await a.click("text=Enter word");
    await a.waitForSelector(`li:text-is("${first.toUpperCase()}")`);
    for (const [p, list] of [[a, found.slice(1, 4)], [b, found.slice(0, 3)]]) {
      for (const w of list) { await p.fill("#grid-type", w); await p.click("form button:has-text('Enter')"); await p.waitForSelector(`li:text-is("${w.toUpperCase()}")`); }
    }
    await a.screenshot({ path: `${SHOTS}/${id}-your-turn.png`, fullPage: true });
    log.push(`OK grid: spelled ${first.toUpperCase()} by tapping squares; both players typed real words`);
    for (const p of [a, b]) { await p.click("text=I've finished"); await p.click("text=Yes, I've finished"); }
  },
  async whoswho({ a, b, id }) {
    let shot = false;
    for (let i = 0; i < 80; i++) {
      const p = await whoseTurn(a, b);
      if (!p) break;
      const flipBtns = p.locator("button:has-text(\"Flip down everyone who doesn't match\")");
      for (let k = 0; k < await flipBtns.count(); k++) { await flipBtns.nth(k).click(); await p.waitForTimeout(30); }
      const up = p.locator("button.face:not(.down)");
      const askable = p.locator(".panel button.btn-block:has-text('?')");
      if ((await up.count()) === 1 || !(await askable.count())) {
        await p.locator('button[aria-label="I know who it is: make a guess"]').click();
        await p.locator("button.face:not(.down)").first().click();
        await p.locator("dialog button.btn-primary").click();
      } else {
        await askable.first().click();
      }
      await p.waitForTimeout(60);
      if (!shot && p === a) { await a.screenshot({ path: `${SHOTS}/${id}-your-turn.png`, fullPage: true }); shot = true; }
    }
  },
  async memory({ a, b, id }) {
    let studyShot = false, qShot = false, flagged = false, timerChecked = false;
    for (let i = 0; i < 200; i++) {
      if (await a.locator("text=game over").count()) break;
      const next = a.locator("button:has-text('Next picture'), button:has-text('See the results')");
      if (await next.count()) {
        if (!flagged) { await a.click("text=Flag this question as unclear"); await a.waitForSelector("text=flagged for checking"); flagged = true; log.push("OK memory: flagging a question works"); }
        await next.first().click(); await a.waitForTimeout(80); continue;
      }
      const p = await whoseTurn(a, b);
      if (!p) { await a.waitForTimeout(100); continue; }
      if (await p.locator("text=I'm ready for my question").count()) {
        if (!studyShot) { await p.screenshot({ path: `${SHOTS}/${id}-study.png`, fullPage: true }); studyShot = true; }
        if (!timerChecked) {
          // let the 10-second timer run out by itself once
          await p.waitForSelector("text=The picture is hidden", { timeout: 15000 });
          timerChecked = true; log.push("OK memory: study timer ran out and moved to the question on its own");
        } else await p.click("text=I'm ready for my question");
      } else {
        if (!qShot) { await p.screenshot({ path: `${SHOTS}/${id}-question.png`, fullPage: true }); qShot = true; }
        await p.locator(".stack > button.btn-block").first().click();
      }
      await p.waitForTimeout(60);
    }
  },
  async canasta({ a, b, id }) {
    let shot = false, invalid = false;
    for (let i = 0; i < 2000; i++) {
      if (await a.locator("text=game over").count()) break;
      const p = await whoseTurn(a, b);
      if (!p) break;
      if (await p.locator("button:has-text('Draw two cards from the stock')").count()) {
        const quickTake = p.locator("button:has-text('Take the pile,')");
        if (await quickTake.count()) await quickTake.first().click();
        else await p.click("button:has-text('Draw two cards from the stock')");
      } else {
        if (!shot && p === a) { await p.screenshot({ path: `${SHOTS}/${id}-your-turn.png`, fullPage: true }); shot = true; }
        if (!invalid) {
          // select two cards of different ranks and try to meld them: plain-English refusal
          const cs = p.locator("button.card");
          await cs.nth(0).click(); await cs.nth((await cs.count()) - 1).click();
          const meldBtn = p.locator("button:has-text('Meld the selected cards')");
          if (await meldBtn.count()) {
            await meldBtn.click();
            await p.waitForSelector(".alert[role=alert]");
            await p.screenshot({ path: `${SHOTS}/${id}-invalid-move.png`, fullPage: true });
            log.push(`OK canasta: invalid meld refused with: ${(await p.textContent(".alert[role=alert]")).trim()}`);
            invalid = true;
          }
          await cs.nth(0).click(); await cs.nth((await cs.count()) - 1).click();
        }
        const sugg = p.locator("button:has-text('Meld your'), button:has-text('Add your'), button:has-text('Add a ')");
        if (await sugg.count()) { await sugg.first().click(); await p.waitForTimeout(40); continue; }
        await p.locator("button.card").last().click();
        await p.locator("button:has-text('Discard the selected card')").click();
        if (await p.locator("dialog").count()) await p.click("text=Yes, go out");
      }
      await p.waitForTimeout(25);
    }
  },
  async islands({ a, b, id }) {
    let shot = false, invalid = false;
    const me = { [0]: null };
    for (let i = 0; i < 1500; i++) {
      if (await a.locator("text=game over").count()) break;
      const p = await whoseTurn(a, b);
      if (!p) break;
      const letter = p === a ? "N" : "S"; // initials of Nanna and Sam, same on both screens
      const mobileMap = p.viewportSize().width <= 768;
      const mine = p.locator(mobileMap ? `button.territory-choice[data-owner-letter="${letter}"]` : `button.terr:has(.owner:text-is("${letter}"))`);
      if (await p.locator("h2:has-text('Place ')").count()) {
        await mine.first().click();
        const all = p.locator("button:has-text('Put all')");
        if (await all.count()) await all.click(); else await p.locator("button:has-text('Put 1 on')").click();
      } else if (await p.locator("h2:text-is('Attack')").count()) {
        if (!invalid) {
          // the territory just reinforced stays selected; the panel says what to tap next
          await p.waitForSelector("text=/Now tap a neighbour of|Tap one of your territories/");
          log.push("OK islands: the attack step tells you what to tap next");
          invalid = true;
        }
        // one quick attack attempt per turn
        let attacked = false;
        const ready = p.locator("section.panel button.btn-primary:has-text('Attack ')");
        if (await ready.count()) { await ready.first().click(); attacked = true; }
        else if (await p.locator("text=Now tap a neighbour of").count()) {
          const enemies = p.locator(mobileMap ? `button.territory-choice:not(.terr-owner-${p === a ? "0" : "1"})` : "button.terr:not(.terr-" + (p === a ? "0" : "1") + ")");
          for (let e = 0; e < await enemies.count() && !attacked; e++) {
            await enemies.nth(e).click();
            if (await ready.count()) { await ready.first().click(); attacked = true; }
          }
        }
        await p.waitForTimeout(80);
        const stop = p.locator("button:has-text('Stop attacking')");
        if (await stop.count()) await stop.click();
        if (!shot && p === a && attacked) { await p.waitForTimeout(100); await a.screenshot({ path: `${SHOTS}/${id}-your-turn.png`, fullPage: true }); shot = true; }
      } else if (await p.locator("button:has-text('End my turn')").count()) {
        await p.click("button:has-text('End my turn')");
      }
      await p.waitForTimeout(20);
    }
  },
  async fleet({ a, b, id }) {
    // invalid placement first
    await a.click("button:has-text('Liner')");
    await a.locator("button.cell").nth(6).click(); // row A, column 7: a 4-long ship doesn't fit across
    await a.waitForSelector("text=doesn't fit");
    await a.screenshot({ path: `${SHOTS}/${id}-invalid-move.png`, fullPage: true });
    await a.waitForSelector("button:has-text('✓ Liner')");
    log.push("OK fleet: off-board placement shows a plain-English error and keeps the same ship chosen");
    for (const p of [a, b]) { await p.click("text=Place my ships for me"); await p.waitForTimeout(100); await p.click("text=My ships are ready"); }
    let shot = false;
    for (let i = 0; i < 300; i++) {
      const p = await whoseTurn(a, b);
      if (!p) break;
      if (!shot && p === a) { await p.screenshot({ path: `${SHOTS}/${id}-your-turn.png`, fullPage: true }); shot = true; }
      if (p.viewportSize().width <= 768) {
        const controls = p.locator(".fleet-coordinate-actions").first();
        const row = controls.locator("select").first();
        const col = controls.locator("select").nth(1);
        for (const value of await row.locator("option").evaluateAll(os => os.map(o => o.value))) {
          await row.selectOption(value);
          const available = col.locator("option:not([disabled])");
          if (await available.count()) {
            await col.selectOption(await available.first().getAttribute("value"));
            await controls.getByRole("button", { name: "Choose square", exact: true }).click();
            break;
          }
        }
      } else await p.locator("button.cell").first().click();
      await p.waitForTimeout(20);
    }
  },
};

for (const id of games) {
  console.log(`Starting ${id}`);
  const { a, b, close } = await pair();
  const title = { gofish: "Go Fish", fleet: "Fleet Finder", clash: "Colour Clash", cheat: "Cheat", gin: "Gin Rummy", wheel: "Letter Wheel", grid: "Word Grid", whoswho: "Who's Who", memory: "Look & Remember", canasta: "Canasta", islands: "Island Conquest" }[id] || id;
  try {
    await start(a, b, title);
    await strategies[id]({ a, b, id });
    await a.waitForSelector("text=game over", { timeout: 10000 });
    await b.waitForSelector("text=game over", { timeout: 10000 });
    await a.screenshot({ path: `${SHOTS}/${id}-results.png`, fullPage: true });
    await a.click("text=Play again"); await b.click("text=Play again");
    await a.waitForSelector(".banner", { timeout: 5000 });
    await a.waitForSelector("text=game over", { state: "detached" });
    for (const [n, p] of [["tablet", a], ["phone", b]]) {
      if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) log.push(`FAIL ${id}: ${n} scrolls sideways`);
    }
    log.push(`OK ${id}: played to the end through the UI on tablet + phone, results shown, rematch started`);
  } catch (e) {
    log.push(`FAIL ${id}: ${e.message}`);
    await a.screenshot({ path: path.join(os.tmpdir(), `qa-fail-${id}-a.png`), fullPage: true });
    await b.screenshot({ path: path.join(os.tmpdir(), `qa-fail-${id}-b.png`), fullPage: true });
  }
  await close();
}
console.log(log.join("\n"));
await browser.close();
process.exitCode = log.some((l) => l.startsWith("FAIL")) ? 1 : 0;
