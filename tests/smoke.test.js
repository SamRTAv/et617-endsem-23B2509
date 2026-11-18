/* Bhojpurify · ET617 · 23B2509 — end-to-end smoke test of the two D5 scenarios in jsdom.
 * Run: node tests/smoke.test.js
 * A mock SpeechRecognition returns a scripted transcript so the speech path is exercised.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
// inline the three scripts so they share one global scope, exactly like the browser
const html = read('index.html').replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>${read(f).replace(/<\/script>/g, '<\\/script>')}</script>`);

function boot(storage, opts) {
  opts = opts || {};
  const dom = new JSDOM(html, {
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      if (storage) Object.entries(storage).forEach(([k, v]) => w.localStorage.setItem(k, v));
      w.scrollTo = () => {};
      w.HTMLElement.prototype.focus = function () {};
      w.__nextTranscript = '';
      if (!opts.noMic) {
        w.webkitSpeechRecognition = class {
          start() { setTimeout(() => {
            const res = [{ transcript: w.__nextTranscript, confidence: 0.9 }];
            this.onresult && this.onresult({ results: [res] });
            this.onend && this.onend();
          }, 0); }
          stop() {}
        };
      }
    }
  });
  return dom.window;
}

let fails = 0;
function check(cond, msg) { if (cond) console.log('  ✓ ' + msg); else { fails++; console.log('  ✗ ' + msg); } }
const tick = () => new Promise(r => setTimeout(r, 5));

function q(w, sel) { return w.document.querySelector(sel); }
function act(w, name, attrs) {
  const sel = `[data-act="${name}"]` + Object.entries(attrs || {}).map(([k, v]) => `[data-${k}="${v}"]`).join('');
  const el = q(w, sel);
  if (!el) throw new Error('missing element ' + sel + ' on screen ' + w.eval('currentScreen'));
  el.click();
}
const N = s => s.normalize('NFC');

async function answer(w, mode) {
  // mode: 'right' | {wrong: value}
  const it = w.eval('curItem()');
  const f = (it.f === 'SPEAK' && w.eval('session.speechDisabled')) ? 'SPELL' : it.f;
  const wrong = mode && mode.wrong;
  if (f === 'MCQ') act(w, 'opt', { v: wrong || it.word });
  else if (f === 'FILL') {
    const p = w.eval('fillParts(curItem())');
    act(w, 'letter', { v: wrong || p.L });
  } else if (f === 'SPELL') {
    const tiles = w.eval('makeTiles(curItem())');
    const parts = wrong ? wrong : w.eval('NLP.graphemes(curItem().word)').map(N);
    for (const part of parts) {
      const t = tiles.find(x => N(x.t) === N(part) && !(w.eval('curItem()._slots') || []).includes(x.i));
      act(w, 'tile', { i: t.i });
    }
    act(w, 'check-spell');
  } else if (f === 'SPEAK') {
    w.__nextTranscript = wrong || it.word;
    act(w, 'mic');
    await tick();
  } else if (f === 'FIND') act(w, 'word', { i: wrong != null ? wrong : it.wrongIdx });
  else if (f === 'WHY') {
    const idx = wrong != null ? it.opts.findIndex(o => o.label === wrong) : it.opts.findIndex(o => o.ok);
    act(w, 'why', { i: idx });
  }
  await tick();
}
const sheetText = w => (q(w, '#sheet') && !q(w, '#sheet').hidden) ? q(w, '#sheet').textContent : '';

async function makeProfile(w, name) {
  q(w, '#nameInput').value = name;
  q(w, '#profileForm').dispatchEvent(new w.Event('submit', { cancelable: true }));
  act(w, 'start');
}

async function runToSummary(w, maxSteps, onItem) {
  for (let s = 0; s < maxSteps; s++) {
    const scr = w.eval('currentScreen');
    if (scr === 'summary') return true;
    if (scr === 'concept') { act(w, 'concept-next'); continue; }
    if (scr === 'practice' || scr === 'mid') {
      const it = w.eval('curItem()');
      const custom = onItem ? onItem(it, w) : null;
      await answer(w, custom || 'right');
      if (q(w, '[data-act="retry"]')) { act(w, 'retry'); await answer(w, 'right'); }
      act(w, 'next');
      continue;
    }
    throw new Error('unexpected screen ' + scr);
  }
  return false;
}

(async () => {
  console.log('Scenario A — learner who responds correctly');
  {
    const w = boot();
    check(q(w, '.id-badge').textContent.includes('23B2509'), 'ID badge shown in header');
    await makeProfile(w, 'Aman');
    check(w.eval('currentScreen') === 'diag', 'starts with diagnostic');
    for (const d of ['शाम', 'सड़क', 'पढ़ना']) act(w, 'diag', { v: d });
    check(w.eval('currentScreen') === 'choose', 'choose-sounds screen after diagnostic');
    check(!w.document.body.textContent.includes('सुझाया गया') || !q(w, '.sound-card .pill.accent'), 'no ⭐ suggestion when all correct');
    act(w, 'card', { id: 'sh' });
    act(w, 'choose-next');
    check(w.eval('session.level.sh') === 2, 'श-block starts at Level 2 (diagnostic correct)');
    check(w.eval('currentScreen') === 'concept', 'concept screen shown');
    const done = await runToSummary(w, 40);
    check(done, 'reaches summary');
    const s = w.eval('session.summary');
    check(s.correct === s.graded, `all first attempts correct (${s.correct}/${s.graded})`);
    const log = w.eval('LOG');
    check(log.some(e => e.ev === 'level_change' && e.to === 3), 'levelled up to Level 3 after 3 correct in a row');
    check(log.some(e => e.ev === 'hard_items'), 'harder words injected');
    check(log.some(e => e.ev === 'midcheck' && e.pass), 'mid-check passed');
    check(w.eval('masteryPct("sh")') === 100, 'श/स mastery 100%');
    check(w.eval('streakDays()') === 1, 'streak = 1 day');
  }

  console.log('\nScenario B — learner with misconception M1 (Ravi)');
  {
    const w = boot();
    await makeProfile(w, 'रवि');
    act(w, 'diag', { v: 'साम' }); act(w, 'diag', { v: 'सड़क' }); act(w, 'diag', { v: 'पढ़ना' });
    check(w.eval('session.rec.sh') === true, 'श/स recommended (⭐) from diagnostic');
    check(w.eval('session.chosen').includes('sh'), 'श/स pre-selected');
    // try to remove the recommended card → warning
    act(w, 'card', { id: 'sh' });
    check(w.document.body.textContent.includes('फिर भी हटाना है'), 'warning shown when removing a recommended card');
    act(w, 'cancel-remove');
    act(w, 'choose-next');
    check(w.eval('session.level.sh') === 1, 'starts at Level 1');
    const seen = {};
    const done = await runToSummary(w, 60, (it, win) => {
      if (it.id === 'S2' && !seen.S2) { seen.S2 = 1; return { wrong: 'स' }; }
      if (it.id === 'S3' && !seen.S3) { seen.S3 = 1; return { wrong: 'साम' }; }
      if (it.id === 'S5' && !seen.S5) { seen.S5 = 1; return { wrong: ['से', 'र'] }; }
      if (it.id === 'S7' && !seen.S7) { seen.S7 = 1; return { wrong: 'M1' }; }
      return null;
    });
    check(done, 'reaches summary');
    const log = w.eval('LOG');
    const ans = log.filter(e => e.ev === 'answer');
    check(ans.some(e => e.item === 'S2' && e.result === 'M1'), 'S2 "स" classified as M1');
    check(ans.some(e => e.item === 'S3' && e.result === 'SPEECH_VAR'), 'S3 spoken "साम" accepted as dialect variant');
    check(ans.some(e => e.item === 'S5' && e.result === 'M1'), 'S5 written "सेर" classified as M1');
    check(log.some(e => e.ev === 'remediation_start' && e.block === 'sh'), 'remediation mini-lesson triggered after 2 M1 errors');
    check(log.some(e => e.ev === 'remediation_items'), 'remediation items inserted');
    check(ans.some(e => e.item === 'S7' && e.result === 'M1'), 'WHY option "श और स एक ही हैं" diagnosed as M1');
    const s = w.eval('session.summary');
    check(s.correct < s.graded, `summary differs from A (${s.correct}/${s.graded})`);
    check(s.wrongWords.length > 0, 'review words listed: ' + s.wrongWords.join(', '));
    act(w, 'summary-done');
    check(w.eval('profile.review').length > 0, 'review words saved for next session');
  }

  console.log('\nC4 — stop and resume');
  {
    const w = boot();
    await makeProfile(w, 'Test');
    act(w, 'diag', { v: 'साम' });
    const store = {};
    for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); store[k] = w.localStorage.getItem(k); }
    const w2 = boot(store);
    check(w2.document.body.textContent.includes('जारी रखें'), 'resume card shown after reopening');
    act(w2, 'resume');
    check(w2.eval('currentScreen') === 'diag' && w2.eval('session.diagIdx') === 1, 'resumes at diagnostic question 2');
  }

  console.log('\nFallback — no speech support');
  {
    const w = boot(null, { noMic: true });
    await makeProfile(w, 'NoMic');
    check(w.eval('session.speechDisabled') === true, 'speech disabled when browser has no recogniser');
    for (const d of ['साम', 'सड़क', 'पढ़ना']) act(w, 'diag', { v: d });
    act(w, 'choose-next'); act(w, 'concept-next');
    await answer(w, 'right'); act(w, 'next');
    await answer(w, 'right'); act(w, 'next');
    check(w.eval('curItem().f') === 'SPEAK' && !!q(w, '[data-act="tile"]'), 'SPEAK task falls back to writing with tiles');
  }

  console.log(`\n${fails ? fails + ' FAILED' : 'all checks passed'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
