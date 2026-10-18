import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { installWorkspaceNavigation } from './workspace-navigation.mjs';
const require = createRequire(process.env.PW_ROOT + '/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE_PATH });
const out = process.env.QA_SHOTS || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots/countries-and-characters');
fs.mkdirSync(out, {recursive:true});
try {
 for (const size of [[390,667],[820,1180]]) for(const title of ["Who's Who", 'Look & Remember']) {
  const a = await browser.newContext({viewport:{width:size[0],height:size[1]},reducedMotion:'reduce'});
  const b = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const p=await a.newPage(), q=await b.newPage();installWorkspaceNavigation(p);installWorkspaceNavigation(q);
  for(const page of [p,q])page.on('pageerror',e=>{throw e});
  await p.goto(process.env.QA_URL);await p.fill('#name','Nanna');await p.getByRole('button',{name:'Start a room',exact:true}).click();await p.waitForSelector('.code');
  const id=await p.evaluate(()=>JSON.parse(localStorage.getItem('nanna.session')).roomId);
  await q.goto(`${process.env.QA_URL}/#join=${id}`);await q.fill('#join-name','Louie');await q.getByRole('button',{name:'Join the game',exact:true}).click();await q.waitForSelector('text=Choose a game');
  await p.getByRole('button',{name:new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).first().click();
  await p.getByRole('button',{name:"I'm ready",exact:true}).click();await q.getByRole('button',{name:"I'm ready",exact:true}).click();await p.waitForSelector('.workspace');await p.waitForTimeout(250);
  const file=title==="Who's Who"?'characters':'countries';
  if(file==='characters') {
   const count=await p.locator('.face:visible').count();if(count!==30)throw new Error(`Only ${count}/30 faces visible`);
   await p.locator('.face').first().click();if(!await p.locator('.face').first().evaluate(e=>e.classList.contains('down')))throw new Error('Face did not flip');
   await p.locator('.face').first().click();
  }
  await p.waitForTimeout(150);
  const layout=await p.evaluate(()=>({page:document.documentElement.scrollHeight>innerHeight+1,content:[...document.querySelectorAll('.workspace-content .workspace-page:not([hidden])')].some(e=>e.scrollHeight>e.clientHeight+1)}));
  await p.screenshot({path:`${out}/${file}-${size[0]}.png`});
  if(layout.page||layout.content)throw new Error(JSON.stringify({...layout, sizes:await p.locator('.character-board').evaluateAll(es=>es.map(e=>({height:e.clientHeight,scroll:e.scrollHeight,page:e.closest('.workspace-page').clientHeight,setting:getComputedStyle(e).getPropertyValue('--page-height'),rows:getComputedStyle(e).gridTemplateRows})))}));
  console.log(`PASS ${file}: ${size.join('x')} fitted screen${file==='characters'?', all 30 faces visible, flip/undo':''}`);
  if(file==='countries') {
   await p.waitForFunction(()=>{const i=document.querySelector('.painted-art-button img');return i?.complete&&i.naturalWidth>0});
   if(await p.locator('.painted-captions p').count()!==4)throw new Error('Missing study captions');
   await p.locator('.painted-art-button').click();await p.waitForSelector('.country-picture-dialog[open]');
   await p.getByRole('button',{name:'Back to the card',exact:true}).click();
   const active=await p.getByRole('button',{name:"I'm ready for my question",exact:true}).count()?p:q;
   await active.getByRole('button',{name:"I'm ready for my question",exact:true}).click();
   await p.waitForSelector('.game-memory[data-memory-phase="question"]');if(await p.locator('.country-card').count())throw new Error('Country card leaks into question');
   await p.screenshot({path:`${out}/question-${size[0]}.png`});
   await active.locator('.memory-options button').first().click();await p.waitForSelector('.memory-reveal');
   await p.screenshot({path:`${out}/answer-${size[0]}.png`});console.log('PASS country card hidden for question, answer revealed');
  }
  await a.close();await b.close();
 }
} finally {await browser.close();}
