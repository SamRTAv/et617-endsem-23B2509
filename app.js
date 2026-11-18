/* Bhojpurify · ET617 · 23B2509
 * App logic: screens, session flow (C4 10-minute sessions with resume), adaptivity, clickstream logging.
 * See DESIGN.md §D4 (screens), §D7.5 (adaptivity), §D4.5 (logging).
 */
/* globals APP_ID, STORE_PREFIX, CARDS, LOCKED_CARD, DIAG, BLOCKS, FB, SPEECH_VARIANTS, LEVEL_NAMES, WEEKDAYS_HI, NLP */
'use strict';

/* ================= Constants ================= */
const SESSION_LIMIT = 600;          // 10 minutes (C4)
const WRAP_AT = 570;                // 9:30 → finish current task, then summary
const RESUME_MAX_AGE = 24 * 3600 * 1000;
const IDLE_HINT_MS = 20000;         // hint pulses after 20 s without input
const BLOCK_ORDER = ['sh', 'rr', 'dh'];
const TIMED_PHASES = ['diag', 'choose', 'concept', 'practice', 'mid'];
const DEMO = /[?&]demo=1\b/.test(location.search);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet');
const $toast = document.getElementById('toast');
const $timer = document.getElementById('timer');

/* ================= Storage (localStorage, wrapped) ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem(STORE_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(STORE_PREFIX + k); else localStorage.setItem(STORE_PREFIX + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
};

let profile = store.get('profile', null);
let session = store.get('session', null);
let LOG = store.get('log', []);
let lang = store.get('lang', 'hi');
let currentScreen = 'welcome';
let prevScreen = 'welcome';
let pulseTimer = null;
let ui = {};                         // transient UI state (not persisted)

function save() {
  if (session) session.updated = Date.now();
  store.set('session', session);
  store.set('profile', profile);
}

/* ================= Clickstream logging (§D4.5) ================= */
function log(ev, data) {
  const e = Object.assign({ t: new Date().toISOString(), sid: session ? session.id : null, ev, screen: currentScreen }, data || {});
  LOG.push(e);
  if (LOG.length > 3000) LOG = LOG.slice(-3000);
  store.set('log', LOG);
}

/* ================= Helpers ================= */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function bi(hi, en, inline) { return `<span class="hi">${hi}</span>` + (en ? `<span class="en${inline ? ' inline' : ''}">${en}</span>` : ''); }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function uid() { return Math.random().toString(36).slice(2, 8); }
function mmss(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
function today(d) { return (d || new Date()).toLocaleDateString('en-CA'); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Wrap the target letter (plus its matras/nukta) in a highlight span. */
function hlWord(word, letter) {
  const w = NLP.N(word);
  if (!letter) return esc(w);
  const L = NLP.N(letter);
  const re = new RegExp(L + (L.length === 1 ? '(?!\\u093C)' : '') + '[\\u0900-\\u0903\\u093A-\\u094F]*', 'g');
  return esc(w).replace(re, m => `<span class="hl">${m}</span>`);
}

function letterFor(item) { return item.blank || item.hl || (BLOCKS[item.block] && BLOCKS[item.block].hl) || ''; }

function fbText(key, ctx) {
  const f = FB[key] || FB.OTHER;
  const rep = s => s
    .replace(/\{name\}/g, esc(profile ? profile.name : ''))
    .replace(/\{w\}/g, `<b>${hlWord(ctx.word || '', ctx.L)}</b>`)
    .replace(/\{L\}/g, esc(ctx.L || ''))
    .replace(/\{bad\}/g, esc(ctx.bad || ''))
    .replace(/\{T\}/g, esc(ctx.T || ''));
  return { tone: f.tone, hi: rep(f.hi), en: rep(f.en) };
}

function mitthu(html) {
  return `<div class="mitthu"><div class="bird" aria-hidden="true">🦜</div><div class="bubble">${html}</div></div>`;
}

function toast(msg, ms) {
  $toast.innerHTML = msg;
  $toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { $toast.hidden = true; }, ms || 2600);
}

function actionbar(html) { return `<div class="actionbar"><div class="actionbar-inner">${html}</div></div>`; }
function btn(act, hi, en, cls, attrs) {
  return `<button type="button" class="btn ${cls || ''}" data-act="${act}" ${attrs || ''}>${bi(hi, en)}</button>`;
}

/* ================= Text-to-speech (🔊) ================= */
let hiVoice = null;
function loadVoices() {
  if (!('speechSynthesis' in window)) { document.body.classList.add('no-tts'); return; }
  const vs = window.speechSynthesis.getVoices() || [];
  hiVoice = vs.find(v => /^hi([-_]|$)/i.test(v.lang)) || null;
  document.body.classList.toggle('no-tts', !hiVoice);
}
function say(text) {
  if (!hiVoice) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(NLP.N(text));
    u.voice = hiVoice; u.lang = hiVoice.lang; u.rate = 0.8;
    window.speechSynthesis.speak(u);
    log('tts', { text: NLP.N(text) });
    return true;
  } catch (e) { return false; }
}

/* ================= Profile ================= */
function newProfile(name, cls) {
  return { name, cls, created: Date.now(), sessions: 0, completed: 0, totalSec: 0, days: [],
    mastery: { sh: [], rr: [], dh: [] }, confidence: 50, diag: null, review: [] };
}
function streakDays() {
  if (!profile) return 0;
  const days = new Set(profile.days || []);
  const d = new Date();
  if (!days.has(today(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function markToday() {
  const t = today();
  if (!profile.days.includes(t)) { profile.days.push(t); profile.days = profile.days.slice(-90); }
}
function masteryPct(b) {
  const arr = (profile && profile.mastery[b]) || [];
  if (!arr.length) return null;
  return Math.round(arr.reduce((a, c) => a + c, 0) / arr.length * 100);
}

/* ================= Session ================= */
function resumable() {
  return !!(session && session.phase !== 'summary' && Date.now() - (session.updated || 0) < RESUME_MAX_AGE);
}
function describeResume() {
  if (!session) return '';
  switch (session.phase) {
    case 'diag': return `जाँच के सवाल ${session.diagIdx + 1} पर`;
    case 'choose': return 'आवाज़ें चुनने पर';
    case 'concept': return `${BLOCKS[session.blocks[session.bi]].title} समझने पर`;
    case 'practice': return `${BLOCKS[session.blocks[session.bi]].title} के सवाल ${session.qi + 1} पर`;
    case 'mid': return 'छोटी जाँच पर';
    default: return '';
  }
}

function startSession() {
  closeSheet();
  profile.sessions = (profile.sessions || 0) + 1;
  session = {
    id: 's' + profile.sessions + '_' + Date.now().toString(36),
    started: Date.now(), updated: Date.now(), elapsed: 0,
    phase: 'diag', diagIdx: 0, diag: {}, rec: {}, chosen: [], confirmRemove: null, skippedDiag: false,
    blocks: [], bi: 0, queue: [], qi: 0, attempt: 1, hint: 0,
    level: {}, streak: {}, errs: {}, remedCount: {}, hardUsed: {}, hintsRecent: [],
    speechDisabled: !SR, speechTries: 0, results: [],
    mid: { done: false, idx: 0, ok: 0, items: [] }, inMidRemed: false,
    pendingRemed: null, conceptMode: 'full', endReason: null, summary: null
  };
  log('session_start', { returning: !!profile.diag, speechSupported: !!SR });
  if (profile.diag) {
    // Returning learner: skip diagnostic, recommend from diagnostic + mastery so far.
    session.skippedDiag = true;
    session.rec = recommendFromProfile();
    session.chosen = CARDS.filter(c => session.rec[c.id]).map(c => c.id);
    session.phase = 'choose';
    save(); go('choose');
  } else {
    save(); go('diag');
  }
}

/* ================= Routing ================= */
function go(screen) {
  if (screen !== currentScreen) prevScreen = currentScreen;
  currentScreen = screen;
  closeSheet();
  clearTimeout(pulseTimer);
  ui = {};
  window.scrollTo(0, 0);
  render();
  log('screen_view', { to: screen });
}

function render() {
  $app.classList.remove('locked');
  const fn = SCREENS[currentScreen] || SCREENS.welcome;
  fn();
  renderTimer();
}

function renderTimer() {
  if (session && TIMED_PHASES.includes(session.phase)) {
    const left = SESSION_LIMIT - session.elapsed;
    $timer.textContent = '⏱ ' + mmss(left);
    $timer.classList.toggle('low', left <= 120);
    $timer.classList.toggle('idle', currentScreen !== session.phase);
    $timer.title = 'बचा समय / time left';
  } else {
    $timer.textContent = '⏱ 10:00';
    $timer.classList.remove('low');
    $timer.classList.add('idle');
    $timer.title = '10 मिनट का सत्र / 10-minute session';
  }
}

/* ================= Screens ================= */
const SCREENS = {};

/* ---------- S1 Welcome ---------- */
SCREENS.welcome = function () {
  if (!profile) {
    $app.innerHTML = `
      <div class="stack">
        ${mitthu(bi('<b>नमस्ते! 🙏 मैं मिट्ठू हूँ।</b><br>मैं तुम्हें <b>श / स</b> और <b>ड़</b> वाले शब्द लिखना सिखाऊँगा — रोज़ बस 10 मिनट।',
          'Hello! I am Mitthu. I will help you write words with श/स and ड़ — just 10 minutes a day.'))}
        <div class="card brand center">
          <div style="font-size:1.15rem;font-weight:700">"बोलो अपने अंदाज़ में, लिखो किताब के अंदाज़ में।"</div>
          <span class="en">"Speak your own way, write the book's way."</span>
        </div>
        <form class="card" id="profileForm" autocomplete="off">
          <h2>${bi('तुम्हारा नाम क्या है?', 'What is your name?')}</h2>
          <label class="field">${bi('नाम', 'Name', true)}
            <input type="text" id="nameInput" maxlength="20" required placeholder="जैसे: रवि" aria-label="नाम / Name">
          </label>
          <label class="field">${bi('कक्षा', 'Class', true)}
            <select id="clsInput" aria-label="कक्षा / Class">
              ${[3, 4, 5, 6, 7, 8].map(c => `<option value="${c}" ${c === 6 ? 'selected' : ''}>कक्षा ${c}</option>`).join('')}
            </select>
          </label>
          <p class="muted" style="font-size:.85rem">${bi('तुम्हारी जानकारी सिर्फ़ इसी फ़ोन में रहती है।', 'Your details stay only on this phone.')}</p>
        </form>
      </div>
      ${actionbar(`<button type="submit" form="profileForm" class="btn primary">${bi('शुरू करो ▶', 'Start')}</button>`)}`;
    document.getElementById('profileForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('nameInput').value.trim();
      if (!name) return;
      profile = newProfile(name.slice(0, 20), +document.getElementById('clsInput').value);
      save();
      log('profile_create', { cls: profile.cls });
      render();
    });
    return;
  }

  const sd = streakDays();
  const canResume = resumable();
  $app.innerHTML = `
    <div class="stack">
      ${mitthu(bi(`<b>नमस्ते, ${esc(profile.name)}! 🦜</b><br>चलो, आज के 10 मिनट शुरू करें।`, `Hello, ${esc(profile.name)}! Let's start today's 10 minutes.`))}
      <div class="row">
        <span class="pill accent">🔥 ${sd} ${bi('दिन लगातार', 'day streak', true)}</span>
        <span class="pill">📚 ${profile.completed || 0} ${bi('सत्र पूरे', 'sessions done', true)}</span>
      </div>
      ${canResume ? `
      <div class="card brand">
        <h3>${bi('▶ जारी रखें?', 'Continue?')}</h3>
        <p>${bi(`पिछली बार तुम <b>${describeResume()}</b> थे। ⏱ ${mmss(SESSION_LIMIT - session.elapsed)} बचे हैं।`,
          `Last time you stopped here. ${mmss(SESSION_LIMIT - session.elapsed)} left.`)}</p>
        <div class="row" style="margin-top:10px">
          ${btn('resume', 'जारी रखो ▶', 'Continue', 'primary')}
          ${btn('fresh', 'नई शुरुआत', 'Start over', 'ghost')}
        </div>
      </div>` : ''}
      <div class="card">
        <h3>${bi('आज का प्लान · ⏱ 10 मिनट', "Today's plan · 10 minutes")}</h3>
        <ul class="points">
          <li>🧐 ${bi('<b>पहला:</b> 3 छोटे सवाल (जाँच)', 'First: 3 quick questions (check)')}</li>
          <li>🎯 ${bi('<b>दूसरा:</b> कौन-सी आवाज़ सीखनी है, चुनो', 'Second: choose which sounds to learn')}</li>
          <li>📘 ${bi('<b>तीसरा:</b> मिट्ठू से समझो', 'Third: learn with Mitthu')}</li>
          <li>✍️🎤 ${bi('<b>चौथा:</b> अभ्यास — चुनो, भरो, बोलो, लिखो', 'Fourth: practice — choose, fill, speak, write')}</li>
          <li>🏁 ${bi('<b>पाँचवाँ:</b> आज का सार', "Fifth: today's summary")}</li>
        </ul>
        <p class="muted" style="font-size:.85rem">${bi('बीच में फ़ोन देना पड़े तो कोई बात नहीं — हम वहीं से शुरू करेंगे। 👍', 'If you have to give the phone back, no problem — we will continue from the same place.')}</p>
      </div>
    </div>
    ${canResume ? '' : actionbar(btn('start', 'आज का अभ्यास शुरू करो ▶', "Start today's practice", 'primary'))}`;
};

/* ---------- S2 Diagnostic ---------- */
SCREENS.diag = function () {
  const it = DIAG[session.diagIdx];
  if (!ui.diagOpts) ui.diagOpts = shuffle(it.opts);
  $app.innerHTML = `
    <div class="stack">
      <div class="taskhead"><span class="pill brand">🧐 ${bi('जाँच', 'Check', true)}</span><span>${bi(`सवाल ${session.diagIdx + 1} / ${DIAG.length}`, `Question ${session.diagIdx + 1} of ${DIAG.length}`, true)}</span></div>
      <div class="progress"><span style="width:${(session.diagIdx / DIAG.length) * 100}%"></span></div>
      ${session.diagIdx === 0 ? mitthu(bi('पहले 3 छोटे सवाल। कोई नंबर नहीं, बस देखना है कि क्या सीखना है। 😊', 'First 3 small questions. No marks — just to see what to learn.')) : ''}
      <div class="card center">
        <div class="emoji-clue">${it.clue}</div>
        <p style="font-size:1.3rem;font-weight:600">${bi(esc(it.q), it.en)}</p>
        <p class="muted">${bi('सही लिखा शब्द चुनो', 'Choose the correctly written word')}</p>
      </div>
      <div class="options ${ui.diagOpts.length === 3 ? 'three' : 'two'}">
        ${ui.diagOpts.map(o => `<button type="button" class="opt" data-act="diag" data-v="${esc(o)}">${esc(o)}</button>`).join('')}
      </div>
    </div>`;
};

function answerDiag(v) {
  const it = DIAG[session.diagIdx];
  const label = NLP.classify(it.word, v);
  session.diag[it.block] = { ok: label === 'CORRECT', pick: v, label };
  log('diag_answer', { item: it.id, block: it.block, input: v, result: label });
  session.diagIdx++;
  ui.diagOpts = null;
  if (session.diagIdx < DIAG.length) { save(); render(); return; }
  profile.diag = session.diag;
  session.rec = recommendFromDiag(session.diag);
  session.chosen = CARDS.filter(c => session.rec[c.id]).map(c => c.id);
  session.phase = 'choose';
  log('diag_done', { rec: session.rec });
  save(); go('choose');
}

function recommendFromDiag(d) {
  const sh = d.sh || { ok: true }, rr = d.rr || { ok: true }, dh = d.dh || { ok: true };
  return {
    sh: !sh.ok,
    rd: !rr.ok && rr.label !== 'M2_R',
    rr: !rr.ok && rr.label === 'M2_R',
    dh: !dh.ok
  };
}
function recommendFromProfile() {
  const rec = recommendFromDiag(profile.diag || {});
  const m = { sh: masteryPct('sh'), rr: masteryPct('rr'), dh: masteryPct('dh') };
  if (m.sh !== null) rec.sh = m.sh < 80;
  if (m.rr !== null) { if (m.rr >= 80) { rec.rd = false; rec.rr = false; } else if (!rec.rd && !rec.rr) rec.rd = true; }
  if (m.dh !== null) rec.dh = m.dh < 80;
  return rec;
}

/* ---------- S3 Choose sounds ---------- */
function blocksFromChosen(chosen) {
  return BLOCK_ORDER.filter(b => CARDS.some(c => c.block === b && chosen.includes(c.id)));
}
function estimateMin(nBlocks) { return nBlocks === 0 ? 0 : nBlocks === 1 ? 6 : nBlocks === 2 ? 9 : 10; }

SCREENS.choose = function () {
  const rec = session.rec || {};
  const anyRec = Object.values(rec).some(Boolean);
  const nB = blocksFromChosen(session.chosen).length;
  const intro = session.skippedDiag
    ? bi('पिछली जाँच और तुम्हारी प्रगति के हिसाब से <b>⭐ सुझाया गया</b> कार्ड चुने हैं। तुम बदल भी सकते हो।', 'Based on your last check and progress, ⭐ cards are suggested. You can change them.')
    : anyRec
      ? bi('जाँच के हिसाब से <b>⭐ सुझाया गया</b> कार्ड तुम्हारे लिए चुने हैं। जिसमें तुम्हें भी मुश्किल लगे, उसे भी चुन लो!', 'From your check, ⭐ cards are suggested for you. Pick any others you find hard too!')
      : bi('वाह! जाँच में सब सही! 🎉 फिर भी जिसका अभ्यास करना हो, चुन लो।', 'Wow, all correct in the check! Still, pick anything you want to practise.');
  $app.innerHTML = `
    <div class="stack">
      <h1>${bi('क्या सीखना है? 🎯', 'What do you want to learn?')}</h1>
      ${mitthu(intro)}
      ${CARDS.map(c => {
        const on = session.chosen.includes(c.id);
        return `
        <div class="sound-card ${on ? 'on' : ''}" role="button" tabindex="0" data-act="card" data-id="${c.id}" aria-pressed="${on}">
          <div class="row">
            <div class="check">${on ? '✓' : ''}</div>
            <div class="spacer">
              <div class="title">${c.title} ${rec[c.id] ? `<span class="pill accent">⭐ ${bi('सुझाया गया', 'Suggested', true)}</span>` : ''} ${c.bonus ? `<span class="pill">${bi('बोनस', 'Bonus', true)}</span>` : ''}</div>
              <div>${bi(c.hi, c.en)}</div>
            </div>
            <button type="button" class="btn small ghost tts" data-act="card-preview" data-id="${c.id}" aria-label="सुनो / Listen">🔊</button>
          </div>
          ${session.confirmRemove === c.id ? `
            <div class="warnbox">
              ${bi('तुम्हारे जवाब में यहाँ ग़लती थी — फिर भी हटाना है?', 'Your answer had a mistake here — remove it anyway?')}
              <div class="row" style="margin-top:8px">
                ${btn('confirm-remove', 'हाँ, हटाओ', 'Yes, remove', 'small', `data-id="${c.id}"`)}
                ${btn('cancel-remove', 'रहने दो', 'Keep it', 'small primary')}
              </div>
            </div>` : ''}
        </div>`;
      }).join('')}
      <div class="sound-card locked" aria-disabled="true">
        <div class="row"><div class="check">🔒</div><div class="spacer"><div class="title">${LOCKED_CARD.title}</div><div>${bi(LOCKED_CARD.hi, LOCKED_CARD.en)}</div></div></div>
      </div>
      <p class="center muted">${nB ? bi(`⏱ लगभग ${estimateMin(nB)} मिनट (${nB} ${nB === 1 ? 'हिस्सा' : 'हिस्से'})`, `About ${estimateMin(nB)} minutes (${nB} part${nB > 1 ? 's' : ''})`) : bi('कम से कम एक कार्ड चुनो।', 'Choose at least one card.')}</p>
      ${session.skippedDiag ? `<p class="center">${btn('retake-diag', 'जाँच फिर से करो', 'Retake the check', 'small ghost')}</p>` : ''}
    </div>
    ${actionbar(btn('choose-next', 'आगे ➜', 'Next', 'primary', nB ? '' : 'disabled'))}`;
};

function toggleCard(id) {
  const on = session.chosen.includes(id);
  if (on && session.rec[id] && session.confirmRemove !== id) {
    session.confirmRemove = id;
    log('topic_remove_warn', { card: id });
    render();
    return;
  }
  session.confirmRemove = null;
  session.chosen = on ? session.chosen.filter(x => x !== id) : session.chosen.concat(id);
  log('topic_toggle', { card: id, on: !on, recommended: !!session.rec[id] });
  save(); render();
}

/* ---------- Building a block's task queue (C4-aware) ---------- */
function cloneItem(it, b, extra) {
  const c = JSON.parse(JSON.stringify(it));
  c.block = b; c.uid = (it.id || 'X') + '_' + uid();
  return Object.assign(c, extra || {});
}
function blankFor(item) {
  if (item.blank) return item.blank;
  const order = { sh: ['श', 'स'], rr: ['ड़', 'ड'], dh: ['ढ़', 'ढ'] }[item.block] || [];
  return order.find(l => NLP.findLetter(item.word, l) >= 0) || order[0];
}
function makeFillItem(word, b, extra) {
  const it = Object.assign({ id: 'F_' + NLP.normalise(word), f: 'FILL', word, clue: '✍️',
    q: 'खाली जगह भरो', en: 'Fill in the missing letter' }, extra || {});
  return cloneItem(it, b);
}

function buildBlock() {
  const b = session.blocks[session.bi];
  const nB = session.blocks.length;
  const core = BLOCKS[b].items;
  // C4: fewer tasks per block when more blocks are chosen (all fit in 10 minutes)
  const pick = nB === 1 ? [0, 1, 2, 3, 4, 5, 6] : nB === 2 ? [0, 1, 2, 4, 6] : [0, 1, 4, 6];
  const q = pick.map(i => cloneItem(core[i], b));
  // Spaced review across sessions: up to 2 words missed last time, as FILL items, at the start
  const review = (profile.review || []).filter(r => r.block === b).slice(0, 2)
    .map(r => makeFillItem(r.word, b, { review: true, clue: '🔁', q: 'पिछली बार का शब्द — खाली जगह भरो', en: 'A word from last time — fill the blank' }));
  session.queue = review.concat(q);
  session.qi = 0;
  session.streak[b] = 0;
  session.errs[b] = {};
  session.remedCount[b] = session.remedCount[b] || 0;
  session.hardUsed[b] = session.hardUsed[b] || [];
  session.hintsRecent = [];
  session.phase = 'concept';
  session.conceptMode = 'full';
  log('block_start', { block: b, level: session.level[b], items: session.queue.map(i => i.id) });
}

function startPractice() {
  const blocks = blocksFromChosen(session.chosen);
  if (!blocks.length) return;
  session.blocks = blocks;
  const d = profile.diag || {};
  blocks.forEach(b => { session.level[b] = (d[b] && d[b].ok) ? 2 : 1; });
  session.bi = 0;
  log('topics_final', { chosen: session.chosen, recommended: session.rec, blocks });
  buildBlock();
  save(); go('concept');
}

/* ---------- S4 Concept (and remediation mini-lesson) ---------- */
SCREENS.concept = function () {
  const b = session.blocks[session.bi];
  const B = BLOCKS[b];
  const remed = session.conceptMode === 'remed';
  const lines = remed ? B.remedLines : B.concept;
  const head = remed
    ? (() => { const t = fbText('REMED', { T: B.title }); return bi(t.hi, t.en); })()
    : bi(`<b>चलो, ${B.title} समझते हैं!</b>`, `Let's understand ${B.titleEn}!`);
  $app.innerHTML = `
    <div class="stack">
      <div class="taskhead"><span class="pill brand">📘 ${bi(remed ? 'फिर से देखें' : 'समझो', remed ? 'Look again' : 'Learn', true)}</span><span class="pill">${B.title}</span>${session.blocks.length > 1 ? `<span>${bi(`हिस्सा ${session.bi + 1} / ${session.blocks.length}`, `Part ${session.bi + 1} of ${session.blocks.length}`, true)}</span>` : ''}</div>
      ${mitthu(`${head}<ul class="points">${lines.map(l => `<li>${bi(l.hi, l.en)}</li>`).join('')}</ul>`)}
      <div class="card">
        <h3>✂️ ${bi('अक्षर तोड़ो', 'Break the word')}</h3>
        <p class="muted">${bi('किसी शब्द पर टैप करो — सुनो और टुकड़े देखो।', 'Tap a word — listen and see its pieces.')}</p>
        <div class="chips">${B.pairs.map(w => `<button type="button" class="chip" data-act="chip" data-w="${esc(w)}">${hlWord(w, B.letters.find(l => NLP.findLetter(w, l) >= 0))}</button>`).join('')}</div>
        <div id="breakdown" class="breakdown" aria-live="polite">${ui.breakdown || ''}</div>
      </div>
    </div>
    ${actionbar(btn('concept-next', remed ? 'ठीक है, फिर से कोशिश ➜' : 'समझ गया, अभ्यास करें ➜', remed ? "OK, let's try again" : "Got it, let's practise", 'primary'))}`;
};

function breakdownHtml(word, b) {
  const letters = BLOCKS[b].letters;
  return NLP.graphemes(word).map(g => {
    const target = letters.some(l => NLP.findLetter(g, l) >= 0);
    return `<span class="${target ? 'target' : ''}">${esc(g)}</span>`;
  }).join('');
}

function conceptNext() {
  const b = session.blocks[session.bi];
  if (session.elapsed >= WRAP_AT) return finish('timeup');
  if (session.conceptMode === 'remed') {
    const items = BLOCKS[b].remed.map(it => cloneItem(it, b, { remedial: true }));
    session.queue.splice(session.qi, 0, ...items);
    log('remediation_items', { block: b, items: items.map(i => i.id) });
  }
  session.conceptMode = 'full';
  session.phase = 'practice';
  save(); go('practice');
}

/* === PRACTICE, FEEDBACK, ADAPTIVITY, SUMMARY, PROFILE, LOG: below === */
