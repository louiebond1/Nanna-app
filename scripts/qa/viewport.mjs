import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { installWorkspaceNavigation } from './workspace-navigation.mjs';
const require = createRequire(process.env.PW_ROOT + '/');
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots = path.join(root, 'docs/screenshots/no-scroll');
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {});
const sizes = process.env.QA_SIZES ? JSON.parse(process.env.QA_SIZES) : [[390, 667], [390, 844], [820, 1180], [1024, 768]];
const failures = [];
let scans = 0;
for (const [width, height] of sizes) for (const scheme of ['light', 'dark']) {
  const ca = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  const cb = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  const a = await ca.newPage(), b = await cb.newPage();
  installWorkspaceNavigation(a);
  const check = async label => {
    await a.waitForTimeout(50);
    const errors = await a.evaluate(() => {
      const errors = [];
      if (document.documentElement.scrollWidth > innerWidth + 1) errors.push('sideways scrolling');
      if (document.documentElement.scrollHeight > innerHeight + 1) errors.push('page scrolling');
      for (const p of document.querySelectorAll('.workspace-content .workspace-page:not([hidden])')) {
        if (p.scrollHeight > p.clientHeight + 1) errors.push(`content overflow ${p.scrollHeight}/${p.clientHeight}`);
      }
      for (const e of document.querySelectorAll('button,input,select,summary')) {
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        if (!r.width || !r.height || s.visibility === 'hidden' || s.display === 'none') continue;
        if (r.width < 55.5 || r.height < 55.5) errors.push(`small control: ${e.textContent.slice(0, 35)}`);
        if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.left < -1) errors.push(`offscreen control: ${e.textContent.slice(0, 35)}`);
      }
      return errors;
    });
    scans++;
    if (errors.length) {
      failures.push(`${scheme} ${width}x${height} ${label}: ${[...new Set(errors)].join('; ')}`);
      console.log(failures.at(-1));
      await a.screenshot({ path: path.join(shots, `FAIL-${scheme}-${width}x${height}-${label.replace(/[^a-z0-9]+/gi, '-')}.png`) });
    }
  };
  await a.goto(process.env.QA_URL);
  await check('home');
  await a.fill('#name', 'Nanna');
  await a.getByRole('button', { name: 'Start a room', exact: true }).click();
  await a.waitForSelector('.code');
  const id = await a.evaluate(() => JSON.parse(localStorage.getItem('nanna.session')).roomId);
  await b.goto(`${process.env.QA_URL}/#join=${id}`);
  await b.fill('#join-name', 'Sam');
  await b.getByRole('button', { name: 'Join the game', exact: true }).click();
  await b.waitForSelector('text=Choose a game');
  const titles = await a.locator('.game-choice-title').allTextContents();
  for (const title of titles) {
    const clean = title.replace(/^✓ /, '').replace(/ \(chosen\)$/, '');
    await a.getByRole('button', { name: new RegExp(clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
    await a.waitForSelector('.workspace'); await check(`${clean}-settings`);
    await a.getByRole('button', { name: "I'm ready", exact: true }).click();
    await b.getByRole('button', { name: "I'm ready", exact: true }).click();
    await a.waitForSelector('.banner');
    await a.waitForTimeout(100);
    const options = await a.locator('.workspace-view option').evaluateAll(os => os.map(o => o.value));
    for (const option of options) {
      await a.selectOption('.workspace-view', option);
      const previous = a.locator('[data-fit-previous]');
      while (await previous.isEnabled()) await previous.click();
      let n = 0;
      do {
        await check(`${clean}-${option}-${n++}`);
        if (option === 'play' && n === 1) await a.screenshot({ path: path.join(shots, `${scheme}-${width}x${height}-${clean.replace(/[^a-z0-9]+/gi, '-')}.png`) });
        if (await a.locator('[data-fit-next]').isDisabled()) break;
        await a.locator('[data-fit-next]').click();
      } while (n < 100);
    }
    await a.selectOption('.workspace-view', 'menu');
    await a.getByRole('button', { name: 'Leave room', exact: true }).click();
    await a.getByRole('button', { name: 'Yes, leave', exact: true }).click();
    await a.waitForSelector('#name');
    await a.getByRole('button', { name: 'Start a room', exact: true }).click();
    await a.waitForSelector('.code');
    const nextId = await a.evaluate(() => JSON.parse(localStorage.getItem('nanna.session')).roomId);
    if (await b.locator('.workspace-view').count()) await b.selectOption('.workspace-view', 'menu');
    await b.getByRole('button', { name: 'Leave room', exact: true }).click();
    await b.getByRole('button', { name: 'Yes, leave', exact: true }).click();
    await b.waitForSelector('#name');
    await b.goto(`${process.env.QA_URL}/#join=${nextId}`);
    await b.getByRole('button', { name: 'Join the game', exact: true }).click();
    await b.waitForSelector('text=Choose a game');
  }
  await ca.close(); await cb.close();
  console.log(`checked ${scheme} ${width}x${height}`);
}
await browser.close();
console.log(failures.join('\n'));
console.log(`${scans} viewport checks; ${failures.length} failures`);
process.exitCode = failures.length ? 1 : 0;
