/* Bhojpurify · ET617 · 23B2509 — capture the D5 scenario screenshots with a real browser (Edge/Chrome).
 * Usage: node tools/screenshots.js [baseUrl] [outDir]
 *   node tools/screenshots.js http://127.0.0.1:5173 screenshots
 *   node tools/screenshots.js https://et617-23b2509.vercel.app screenshots
 * Uses ?demo=1 so the SPEAK step can be fed a transcript (headless browsers have no microphone).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const OUT = path.resolve(process.argv[3] || 'screenshots');
const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];
const exe = BROWSERS.find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  await sleep(350);
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  console.log('  📸 ' + name);
}
const click = (page, sel) => page.$eval(sel, el => el.click());
const act = (page, name, attrs) => click(page, `[data-act="${name}"]` + Object.entries(attrs || {}).map(([k, v]) => `[data-${k}="${v}"]`).join(''));
const screen = page => page.evaluate('currentScreen');

/** Answer the current task. wrong: value to give instead of the right answer. */
async function answer(page, wrong) {
  const it = await page.evaluate('({ ...curItem(), typed: session.speechDisabled })');
  const f = it.f === 'SPEAK' && it.typed ? 'SPELL' : it.f;
  if (f === 'MCQ') await act(page, 'opt', { v: wrong || it.word });
  else if (f === 'FILL') { const L = await page.evaluate('fillParts(curItem()).L'); await act(page, 'letter', { v: wrong || L }); }
  else if (f === 'SPELL') {
    const parts = wrong || await page.evaluate('NLP.graphemes(curItem().word).map(NLP.N)');
    for (const p of parts) {
      const i = await page.evaluate(p => { const it = curItem(); const t = makeTiles(it).find(x => NLP.N(x.t) === p && !(it._slots || []).includes(x.i)); return t.i; }, p.normalize('NFC'));
      await act(page, 'tile', { i });
    }
    await act(page, 'check-spell');
  } else if (f === 'SPEAK') {
    await page.$eval('#demoText', (el, v) => { el.value = v; }, wrong || it.word);
    await act(page, 'demo-say');
  } else if (f === 'FIND') await act(page, 'word', { i: wrong != null ? wrong : it.wrongIdx });
  else if (f === 'WHY') {
    const idx = it.opts.findIndex(o => (wrong ? o.label === wrong : o.ok));
    await act(page, 'why', { i: idx });
  }
  await sleep(120);
}

async function run(page, onItem) {
  for (let s = 0; s < 80; s++) {
    const scr = await screen(page);
    if (scr === 'summary') return;
    if (scr === 'concept') {
      const mode = await page.evaluate('session.conceptMode');
      if (onItem && onItem.concept) await onItem.concept(mode);
      await act(page, 'concept-next'); continue;
    }
    const it = await page.evaluate('curItem()');
    const plan = onItem ? await onItem(it, scr) : null;
    await answer(page, plan && plan.wrong);
    if (plan && plan.shot) await shot(page, plan.shot);
    if (await page.$('[data-act="retry"]')) { await act(page, 'retry'); await answer(page); }
    await act(page, 'next');
  }
  throw new Error('did not reach summary');
}

async function newLearner(page, name) {
  await page.goto(BASE + '/?demo=1', { waitUntil: 'networkidle0' });
  // reset through the app itself (it saves on pagehide, so clearing storage directly would be undone)
  await page.evaluate("profile && ACTIONS['reset-confirm'](); LOG = []; store.set('log', LOG);");
  await sleep(150);
  await page.type('#nameInput', name);
  await click(page, '#profileForm button[type="submit"], .actionbar button[type="submit"]');
  await sleep(200);
}

(async () => {
  if (!exe) throw new Error('No Edge/Chrome found');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--lang=hi-IN'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', e => console.log('  ⚠ page error: ' + e.message));

  console.log('Scenario A — correct learner (Aman)');
  await newLearner(page, 'Aman');
  await shot(page, 'a1-welcome');
  await act(page, 'start');
  await shot(page, 'a2-diagnostic');
  for (const v of ['शाम', 'सड़क', 'पढ़ना']) { await act(page, 'diag', { v }); await sleep(80); }
  await act(page, 'card', { id: 'sh' });
  await shot(page, 'a3-choose');
  await act(page, 'choose-next');
  await shot(page, 'a3b-concept');
  let midShot = false, firstOk = false;
  await run(page, async (it, scr) => {
    if (!firstOk) { firstOk = true; return { shot: 'a4-correct-feedback' }; }
    if (scr === 'mid' && !midShot) { midShot = true; await shot(page, 'a5-midcheck'); }
    return null;
  });
  await shot(page, 'a6-summary');
  await act(page, 'goto-profile');
  await shot(page, 'a7-profile');

  console.log('Scenario B — misconception M1 (Ravi)');
  await newLearner(page, 'रवि');
  await act(page, 'start');
  await act(page, 'diag', { v: 'साम' });
  await shot(page, 'b1-diagnostic');
  await act(page, 'diag', { v: 'सड़क' }); await act(page, 'diag', { v: 'पढ़ना' });
  await shot(page, 'b2-choose-recommended');
  await act(page, 'choose-next');
  const seen = {};
  const runB = async (it) => {
    if (it.id === 'S2' && !seen.S2) { seen.S2 = 1; return { wrong: 'स', shot: 'b3-m1-feedback' }; }
    if (it.id === 'S3' && !seen.S3) { seen.S3 = 1; return { wrong: 'साम', shot: 'b4-speech-variant' }; }
    if (it.id === 'S5' && !seen.S5) { seen.S5 = 1; return { wrong: ['से', 'र'], shot: 'b5a-spell-m1' }; }
    if (it.id === 'S7' && !seen.S7) { seen.S7 = 1; return { wrong: 'M1', shot: 'b6-why-feedback' }; }
    return null;
  };
  runB.concept = async mode => { if (mode === 'remed' && !seen.remed) { seen.remed = 1; await shot(page, 'b5-remediation'); } };
  await run(page, runB);
  await shot(page, 'b7-summary');
  await act(page, 'goto-profile');
  await act(page, 'goto-log');
  await shot(page, 'b8-log');

  await browser.close();
  console.log('Saved to ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
