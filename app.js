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
            <div class="warnbox" data-act="noop">
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

/* ================= Practice (S5) + Mid-check (S7) ================= */
function curItem() {
  if (!session) return null;
  return session.phase === 'mid' ? session.mid.items[session.mid.idx] : session.queue[session.qi];
}
function has(card) { return session.chosen.includes(card); }
/** Card choice decides which ड़-distractor (ड or र) appears (§D3.1). */
function distractorAllowed(label) {
  if (label === 'M2_D') return has('rd') || !has('rr');
  if (label === 'M2_R') return has('rr') || !has('rd');
  return true;
}
function mcqOptions(item) {
  if (!item._opts) {
    let opts = item.opts.filter(o => o === item.word || distractorAllowed(NLP.classify(item.word, o)));
    if (opts.length < 2) opts = item.opts.slice();
    item._opts = shuffle(opts);
  }
  return item._opts;
}
function fillParts(item) {
  const L = blankFor(item);
  const w = NLP.N(item.word), Ln = NLP.N(L);
  const i = NLP.findLetter(w, Ln);
  const before = w.slice(0, i), after = w.slice(i + Ln.length);
  const marks = (after.match(/^[ऀ-ःऺ-ॏ]*/) || [''])[0];
  return { L: Ln, before, after, marks, rest: after.slice(marks.length) };
}
function fillLetters(item, parts) {
  if (!item._letters) {
    const letters = BLOCKS[item.block].letters.map(l => NLP.N(l));
    let ls = letters.filter(l => l === parts.L || distractorAllowed(NLP.classify(item.word, parts.before + l + parts.after)));
    if (!ls.includes(parts.L)) ls.unshift(parts.L);
    if (ls.length < 2) ls = letters;
    item._letters = ls; // fixed order every time (consistency, §D4.3)
  }
  return item._letters;
}
function makeTiles(item) {
  if (item._tiles) return item._tiles;
  const g = NLP.graphemes(item.word).map(NLP.N);
  const extra = [];
  g.forEach(p => {
    if (p.includes('श')) extra.push(p.replace('श', 'स'));
    if (p.includes(NLP.RH)) {
      if (distractorAllowed('M2_D')) extra.push(p.replace(NLP.RH, 'ड'));
      if (distractorAllowed('M2_R')) extra.push(p.replace(NLP.RH, 'र'));
    }
    if (p.includes(NLP.RHH)) extra.push(p.replace(NLP.RHH, 'ढ'));
  });
  const uniq = extra.filter((x, i) => !g.includes(x) && extra.indexOf(x) === i);
  item._tiles = shuffle(g.concat(uniq)).map((t, i) => ({ i, t }));
  item._slots = [];
  return item._tiles;
}
function isRemoved(item, v) { return (item._removed || []).includes(v); }

function taskHeader(item, isMid) {
  const b = item.block;
  const total = isMid ? session.mid.items.length : session.queue.length;
  const idx = isMid ? session.mid.idx : session.qi;
  const conf = profile.confidence;
  return `
    <div class="taskhead">
      ${isMid ? `<span class="pill accent">🧐 ${bi('छोटी जाँच · बिना इशारे', 'Mid-check · no hints', true)}</span>`
              : `<span class="pill brand">${BLOCKS[b].title}</span><span class="pill" title="Level">${LEVEL_NAMES[session.level[b] || 1]}</span>`}
      ${item.review ? `<span class="pill">🔁 ${bi('दोहराना', 'Review', true)}</span>` : ''}
      ${item.remedial ? `<span class="pill">🩹 ${bi('अभ्यास', 'Extra practice', true)}</span>` : ''}
      <span class="spacer"></span>
      <span>${bi(`सवाल ${idx + 1} / ${total}`, `Q ${idx + 1} of ${total}`, true)}</span>
    </div>
    <div class="progress"><span style="width:${(idx / total) * 100}%"></span></div>
    <div class="meter-row" style="margin-top:6px;font-size:.82rem">
      <span>💪 ${bi('आत्मविश्वास', 'Confidence', true)}</span><b>${conf}</b>
      <div class="progress accent"><span style="width:${conf}%"></span></div>
    </div>`;
}

function hintBox(item) {
  if (!session.hint) return '';
  const h = item.hint || BLOCKS[item.block].hint;
  let extra = '';
  if (session.hint >= 2 && item.f === 'FIND') {
    const words = item.sentence.split(' ');
    extra = item.wrongIdx < words.length / 2 ? bi('ग़लत शब्द वाक्य के <b>पहले आधे</b> हिस्से में है।', 'The wrong word is in the first half.') : bi('ग़लत शब्द वाक्य के <b>दूसरे आधे</b> हिस्से में है।', 'The wrong word is in the second half.');
  }
  return `<div class="hintbox">💡 ${bi(h.hi, h.en)}${extra ? '<br>' + extra : ''}</div>`;
}

function renderTask() {
  const item = curItem();
  if (!item) return endOfQueue();
  const isMid = session.phase === 'mid';
  if (!ui.started) { ui.started = Date.now(); session.itemStart = Date.now(); }
  let body = '', bar = '';
  const hintBtn = isMid ? '' : `<button type="button" class="btn ghost" id="hintBtn" data-act="hint" ${session.hint >= 2 ? 'disabled' : ''}>${bi(`💡 इशारा ${session.hint ? `(${session.hint}/2)` : ''}`, 'Hint')}</button>`;
  const prompt = `<div class="card center">
      ${item.clue ? `<div class="emoji-clue">${item.clue}</div>` : ''}
      <p style="font-size:1.2rem;font-weight:600">${bi(item.q, item.en)}</p>
      ${item.listen ? `<button type="button" class="btn small tts" data-act="listen" data-w="${esc(item.word)}">🔊 ${bi('सुनो', 'Listen', true)}</button>` : ''}
    </div>`;

  const fmt = (item.f === 'SPEAK' && session.speechDisabled) ? 'SPEAK_TYPED' : item.f;

  if (fmt === 'MCQ') {
    const opts = mcqOptions(item);
    body = `${prompt}
      <p class="muted center">${bi('सही लिखा शब्द चुनो', 'Choose the correctly written word')}</p>
      <div class="options ${opts.length === 3 ? 'three' : 'two'}">
        ${opts.map(o => `<button type="button" class="opt ${isRemoved(item, o) ? 'removed' : ''}" data-act="opt" data-v="${esc(o)}">${esc(o)}</button>`).join('')}
      </div>`;
    bar = hintBtn;
  } else if (fmt === 'FILL') {
    const p = fillParts(item);
    const letters = fillLetters(item, p);
    body = `${prompt}
      <div class="pattern" aria-label="${esc(p.before)} खाली ${esc(p.after)}">${esc(p.before)}<span class="blank">◌${esc(p.marks)}</span>${esc(p.rest)}</div>
      <p class="muted center">${bi('खाली जगह में कौन-सा अक्षर आएगा?', 'Which letter goes in the blank?')}</p>
      <div class="options ${letters.length === 3 ? 'three' : 'two'}">
        ${letters.map(l => `<button type="button" class="opt ${isRemoved(item, l) ? 'removed' : ''}" data-act="letter" data-v="${esc(l)}">${esc(l)}</button>`).join('')}
      </div>`;
    bar = hintBtn;
  } else if (fmt === 'SPELL' || fmt === 'SPEAK_TYPED') {
    const tiles = makeTiles(item);
    const n = NLP.graphemes(item.word).length;
    const slots = item._slots || [];
    const typedNote = fmt === 'SPEAK_TYPED'
      ? `<div class="hintbox">✍️ ${bi('माइक के बिना: शब्द को टुकड़े जोड़कर लिखो।', 'Without the mic: build the word from pieces.')}</div>` : '';
    const sp = fmt === 'SPEAK_TYPED'
      ? `<div class="card center"><div class="emoji-clue">${item.clue || ''}</div><p style="font-size:1.2rem;font-weight:600">${bi(esc(item.cluetext || ''), item.en)}</p>
         <button type="button" class="btn small tts" data-act="listen" data-w="${esc(item.word)}">🔊 ${bi('सुनो', 'Listen', true)}</button></div>`
      : prompt;
    body = `${typedNote}${sp}
      <div class="slots">${Array.from({ length: n }, (_, k) => {
        const tIdx = slots[k];
        const t = tIdx != null ? tiles.find(x => x.i === tIdx) : null;
        return `<button type="button" class="slot ${t ? 'filled' : ''}" data-act="slot" data-i="${k}" aria-label="खाना ${k + 1}">${t ? esc(t.t) : ''}</button>`;
      }).join('')}</div>
      <div class="tiles">${tiles.map(t => `<button type="button" class="tile ${slots.includes(t.i) ? 'used' : ''} ${isRemoved(item, t.i) ? 'removed' : ''}" data-act="tile" data-i="${t.i}">${esc(t.t)}</button>`).join('')}</div>
      <p class="muted center" style="font-size:.85rem">${bi('टुकड़े पर टैप करो। ग़लत लगे तो ऊपर वाले खाने पर टैप करके हटाओ।', 'Tap pieces. Tap a box above to remove a piece.')}</p>`;
    bar = `${hintBtn}<button type="button" class="btn primary" data-act="check-spell" ${slots.length === n ? '' : 'disabled'}>${bi('जाँचो ✓', 'Check')}</button>`;
  } else if (fmt === 'SPEAK') {
    body = `
      <div class="card center">
        <div class="emoji-clue">${item.clue || ''}</div>
        <p style="font-size:1.1rem;font-weight:600">${bi(item.q, item.en)}</p>
        <div class="big-word">${hlWord(item.word, letterFor(item))}</div>
        <button type="button" class="btn small tts" data-act="listen" data-w="${esc(item.word)}">🔊 ${bi('पहले सुनो', 'Listen first', true)}</button>
      </div>
      <button type="button" class="mic" id="micBtn" data-act="mic" aria-label="बोलो / Speak">🎤<small>${ui.listening ? 'सुन रहा हूँ…' : 'बोलो'}</small></button>
      <p class="center muted">${bi('बटन दबाओ और शब्द बोलो। अपने अंदाज़ में बोलना ठीक है! 😊', 'Press and say the word. Your own accent is fine!')}</p>
      <div id="speechStatus" aria-live="polite">${ui.speechMsg || ''}</div>
      ${DEMO ? `<div class="demo">🧪 <b>Demo (evaluator):</b> simulate what the recogniser heard
          <div class="row" style="margin-top:6px"><input type="text" id="demoText" placeholder="साम" style="margin:0"><button type="button" class="btn small" data-act="demo-say">Send</button></div></div>` : ''}`;
    bar = '';
  } else if (fmt === 'FIND') {
    const words = item.sentence.split(' ');
    body = `
      <div class="card center">
        <p style="font-size:1.2rem;font-weight:600">${bi(item.q, item.en)}</p>
        <div class="sentence">${words.map((w, i) => `<button type="button" class="word-btn" data-act="word" data-i="${i}">${esc(w)}</button>`).join('')}</div>
      </div>`;
    bar = hintBtn;
  } else if (fmt === 'WHY') {
    if (!item._order) item._order = shuffle(item.opts.map((_, i) => i));
    body = `
      <div class="card">
        <p style="font-size:1.2rem;font-weight:700">🤔 ${bi(item.q, item.en)}</p>
      </div>
      <div class="options">
        ${item._order.map(i => `<button type="button" class="opt text ${isRemoved(item, i) ? 'removed' : ''}" data-act="why" data-i="${i}">${bi(item.opts[i].hi, item.opts[i].en)}</button>`).join('')}
      </div>`;
    bar = hintBtn;
  }

  $app.innerHTML = `<div class="stack">${taskHeader(item, isMid)}${body}${isMid ? '' : hintBox(item)}</div>${bar ? actionbar(bar) : ''}`;

  clearTimeout(pulseTimer);
  if (!isMid && session.hint < 2) {
    pulseTimer = setTimeout(() => {
      const hb = document.getElementById('hintBtn');
      if (hb) { hb.classList.add('pulse'); log('idle_20s', { item: item.id }); }
    }, IDLE_HINT_MS);
  }
  if (item.listen && !ui.autoSaid) { ui.autoSaid = true; setTimeout(() => say(item.word), 300); }
}
SCREENS.practice = renderTask;
SCREENS.mid = renderTask;

/* ================= Answer handling + feedback ================= */
const MISCONCEPTION_GROUP = { M1: 'M1', OVER: 'OVER', M2_D: 'M2', M2_R: 'M2', M2_DH: 'M2', POS: 'M2', OVER_D: 'M2' };
function misconceptionOf(item, label) {
  if (label === 'FIND_MISS') return MISCONCEPTION_GROUP[BLOCKS[item.block].main];
  return MISCONCEPTION_GROUP[label] || null;
}
function isCorrectLabel(label) { return label === 'CORRECT' || label === 'SPEECH_STD' || label === 'SPEECH_VAR'; }

function handleAnswer(item, label, ctx) {
  clearTimeout(pulseTimer);
  const correct = isCorrectLabel(label);
  const isMid = session.phase === 'mid';
  const first = session.attempt === 1;
  const hinted = session.hint > 0;
  const latency = Date.now() - (session.itemStart || Date.now());

  if (first) recordFirst(item, correct, label, hinted, isMid);
  else if (correct) profile.confidence = clamp(profile.confidence + 4, 0, 100);

  log('answer', { block: item.block, item: item.id, format: item.f, input: ctx.input, result: label, correct,
    attempt: session.attempt, latencyMs: latency, hints: session.hint, level: session.level[item.block] || null,
    confidence: profile.confidence, mid: isMid, review: !!item.review, remedial: !!item.remedial });

  // Mark the chosen element
  if (ctx.el) ctx.el.classList.add(correct ? 'right' : 'wrong');

  const L = letterFor(item);
  let fb;
  if (item.f === 'WHY') {
    if (correct) fb = { tone: 'ok', hi: item.okFb.hi, en: item.okFb.en };
    else fb = fbText({ HOME: 'HOME', RANDOM: 'RANDOM', M1: 'WHY_M1', M2_D: 'WHY_M2', M2_DH: 'WHY_M2' }[label] || 'OTHER', { word: item.word, L });
  } else if (correct) {
    const key = label.startsWith('SPEECH') ? label : item.f === 'FIND' ? 'FIND_OK' : (first ? 'CORRECT' : 'CORRECT_RETRY');
    fb = fbText(key, { word: item.word, L, bad: ctx.bad || ctx.input });
  } else {
    fb = fbText(label, { word: item.word, L, bad: ctx.bad || ctx.input });
  }

  const canRetry = !correct && first && !isMid;
  let extra = '';
  if (!correct && !canRetry) {
    const s = fbText('SHOW', { word: item.word, L });
    extra = `<div class="hintbox" style="margin-top:10px">${bi(s.hi, s.en)}</div>`;
    if (!isMid) requeue(item);
    addReview(item);
  }
  if (correct && item.review) removeReview(item.word);

  save();
  openSheet(fb.tone, bi(fb.hi, fb.en) + extra, canRetry
    ? [['retry', 'फिर से करो ↺', 'Try again', 'primary']]
    : [['next', 'आगे ➜', 'Next', 'primary']]);
}

function recordFirst(item, correct, label, hinted, isMid) {
  const b = item.block;
  profile.mastery[b] = (profile.mastery[b] || []).concat(correct ? 1 : 0).slice(-5);
  session.results.push({ id: item.id, block: b, word: item.word, f: item.f, correct, label, hinted, mid: isMid });
  profile.confidence = clamp(profile.confidence + (correct ? (hinted ? 4 : 8) : -3), 0, 100);
  markToday();
  if (isMid) { if (correct) session.mid.ok++; return; }
  adapt(item, correct, label, hinted);
}

/* ================= Adaptivity rules (§D7.5) ================= */
function adapt(item, correct, label, hinted) {
  const b = item.block;
  // Interaction: ≥2 hints in the last 3 items → hold level + insert a FILL scaffold before the next SPELL
  session.hintsRecent = session.hintsRecent.concat(hinted ? 1 : 0).slice(-3);
  const heavyHints = session.hintsRecent.reduce((a, c) => a + c, 0) >= 2;
  if (heavyHints) insertScaffold(b);

  if (correct && !hinted) {
    session.streak[b] = (session.streak[b] || 0) + 1;
    if (session.streak[b] >= 3) {
      session.streak[b] = 0;
      if (!heavyHints) levelUp(b);
      else log('level_hold', { block: b, reason: 'hints' });
    }
  } else {
    session.streak[b] = 0;
    if (!correct) {
      // Performance: 2 errors of the same misconception in this block → remediation mini-lesson
      const m = misconceptionOf(item, label);
      if (m) {
        session.errs[b][m] = (session.errs[b][m] || 0) + 1;
        if (session.errs[b][m] >= 2 && (session.remedCount[b] || 0) < 2) {
          session.pendingRemed = b;
          session.errs[b] = {};
          log('remediation_trigger', { block: b, misconception: m });
        }
      }
    }
  }
}

function levelUp(b) {
  const old = session.level[b] || 1;
  if (old >= 3) { injectHard(b, 1); return; }
  session.level[b] = old + 1;
  log('level_change', { block: b, from: old, to: old + 1 });
  if (session.level[b] === 3) {
    injectHard(b, 2);
    toast(bi('🚀 स्तर 3! अब थोड़े कठिन शब्द।', 'Level 3! Now some harder words.'));
  } else {
    toast(bi(`👍 ${LEVEL_NAMES[session.level[b]]}!`, `Level ${session.level[b]}!`));
  }
}
function levelDown(b) {
  const old = session.level[b] || 1;
  session.level[b] = Math.max(1, old - 1);
  if (session.level[b] !== old) log('level_change', { block: b, from: old, to: session.level[b] });
}
function injectHard(b, count) {
  const pool = BLOCKS[b].hard.filter(h => !session.hardUsed[b].includes(h.id));
  if (!pool.length) return;
  let added = 0;
  // replace the next upcoming SPELL with a hard SPELL
  const hardSpell = pool.find(h => h.f === 'SPELL');
  const j = session.queue.findIndex((q, k) => k > session.qi && q.f === 'SPELL' && !q.hard);
  if (hardSpell && j > -1 && added < count) {
    session.queue[j] = cloneItem(hardSpell, b, { hard: true });
    session.hardUsed[b].push(hardSpell.id); added++;
  }
  // insert a hard FILL right after the current task
  const hardFill = pool.find(h => h.f === 'FILL' && !session.hardUsed[b].includes(h.id));
  if (hardFill && added < count) {
    session.queue.splice(session.qi + 1, 0, cloneItem(hardFill, b, { hard: true }));
    session.hardUsed[b].push(hardFill.id); added++;
  }
  log('hard_items', { block: b, added });
}
function insertScaffold(b) {
  const j = session.queue.findIndex((q, k) => k > session.qi && q.f === 'SPELL' && !q.scaffolded);
  if (j < 0) return;
  const target = session.queue[j];
  target.scaffolded = true;
  session.queue.splice(j, 0, makeFillItem(target.word, b, { scaffold: true, clue: target.clue,
    q: target.q.replace(/\s*—\s*टुकड़े जोड़कर लिखो/, ''), en: target.en }));
  session.hintsRecent = [];
  log('scaffold_insert', { block: b, before: target.id });
}
function requeue(item) {
  if (item.requeued) return;
  const copy = cloneItem(item, item.block, { requeued: true });
  ['_opts', '_letters', '_tiles', '_slots', '_removed', '_order'].forEach(k => delete copy[k]);
  const pos = Math.min(session.queue.length, session.qi + 3);
  session.queue.splice(pos, 0, copy);
  log('requeue', { item: item.id, at: pos });
}
function addReview(item) {
  profile.review = (profile.review || []).filter(r => r.word !== item.word).concat({ word: item.word, block: item.block }).slice(-6);
}
function removeReview(word) { profile.review = (profile.review || []).filter(r => r.word !== word); }

/* ================= Flow ================= */
function nextTask() {
  closeSheet();
  session.attempt = 1; session.hint = 0; session.speechTries = 0;
  if (session.phase === 'mid') {
    session.mid.idx++;
    if (session.mid.idx >= session.mid.items.length) return finishMid();
    save(); return go('mid');
  }
  session.qi++;
  if (session.elapsed >= WRAP_AT) return finish('timeup');
  if (session.pendingRemed) {
    const b = session.pendingRemed;
    session.pendingRemed = null;
    session.remedCount[b] = (session.remedCount[b] || 0) + 1;
    levelDown(b);
    session.phase = 'concept'; session.conceptMode = 'remed';
    log('remediation_start', { block: b });
    save(); return go('concept');
  }
  save();
  if (session.qi >= session.queue.length) return endOfQueue();
  go('practice');
}
function retryTask() {
  closeSheet();
  const item = curItem();
  session.attempt = 2; session.hint = 0;
  if (item) item._slots = [];
  save(); go(session.phase);
}
function endOfQueue() {
  if (session.inMidRemed) { session.inMidRemed = false; return advanceBlock(); }
  if (session.bi === 0 && !session.mid.done) return startMid();
  advanceBlock();
}
function startMid() {
  const b = session.blocks[0];
  session.mid = { done: false, idx: 0, ok: 0, items: BLOCKS[b].mid.map(it => cloneItem(it, b, { midcheck: true })) };
  session.phase = 'mid';
  log('midcheck_start', { block: b });
  save(); go('mid');
  toast(bi('🧐 छोटी जाँच — बस 2 सवाल, बिना इशारे!', 'Mid-check: just 2 questions, no hints!'));
}
function finishMid() {
  const b = session.blocks[0];
  session.mid.done = true;
  const pass = session.mid.ok === session.mid.items.length;
  log('midcheck', { block: b, ok: session.mid.ok, total: session.mid.items.length, pass });
  if (session.elapsed >= WRAP_AT) return finish('timeup');
  if (!pass) {
    session.queue = BLOCKS[b].remed.map(it => cloneItem(it, b, { remedial: true }));
    session.qi = 0; session.inMidRemed = true; session.phase = 'practice';
    save(); go('practice');
    toast(bi('चलो, 2 और अभ्यास करते हैं। 💪', "Let's do 2 more practice items."));
    return;
  }
  toast(bi('✅ छोटी जाँच पास! शाबाश!', 'Mid-check passed!'));
  advanceBlock();
}
function advanceBlock() {
  session.bi++;
  if (session.bi < session.blocks.length && session.elapsed < WRAP_AT) { buildBlock(); save(); return go('concept'); }
  finish(session.bi < session.blocks.length ? 'timeup' : 'complete');
}
function finish(reason) {
  if (!session || session.phase === 'summary') return;
  // unfinished words go to the review list for next time (C4: resume across sessions)
  if (reason === 'timeup') {
    session.queue.slice(session.qi).slice(0, 2).forEach(it => { if (it.word && it.f !== 'WHY') addReview(it); });
  }
  const graded = session.results.filter(r => !r.mid);
  const correct = graded.filter(r => r.correct).length;
  session.summary = {
    reason, elapsed: session.elapsed, graded: graded.length, correct,
    mid: session.mid.done ? { ok: session.mid.ok, total: session.mid.items.length } : null,
    wrongWords: [...new Set(session.results.filter(r => !r.correct).map(r => r.word))],
    blocks: session.blocks.slice()
  };
  // words missed on the first attempt are reviewed at the start of the next session (spacing)
  session.results.filter(r => !r.correct && r.f !== 'WHY').forEach(r => addReview(r));
  session.phase = 'summary';
  profile.totalSec = (profile.totalSec || 0) + session.elapsed;
  profile.completed = (profile.completed || 0) + 1;
  log('session_end', { reason, elapsed: session.elapsed, graded: graded.length, correct, levels: session.level });
  save(); go('summary');
}

/* ================= Speech recognition (§D6.1) ================= */
function speechVariants(item) {
  return [...new Set([].concat(item.variants || [], SPEECH_VARIANTS[NLP.N(item.word)] || SPEECH_VARIANTS[item.word] || []))];
}
function setSpeechMsg(html) { ui.speechMsg = html; const el = document.getElementById('speechStatus'); if (el) el.innerHTML = html; }
function setMic(on) {
  ui.listening = on;
  const m = document.getElementById('micBtn');
  if (m) { m.classList.toggle('listening', on); m.querySelector('small').textContent = on ? 'सुन रहा हूँ…' : 'बोलो'; }
}
function startListening() {
  const item = curItem();
  if (!item || ui.listening) return;
  if (!SR) return speechFallback('unsupported');
  let rec;
  try { rec = new SR(); } catch (e) { return speechFallback('init_error'); }
  rec.lang = 'hi-IN';
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  let handled = false;
  rec.onresult = e => {
    handled = true;
    const alts = Array.from(e.results[0]).map(a => ({ text: a.transcript, conf: Math.round((a.confidence || 0) * 100) / 100 }));
    onSpeech(item, alts);
  };
  rec.onerror = e => {
    handled = true; setMic(false);
    log('speech_error', { item: item.id, error: e.error });
    if (['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'].includes(e.error)) speechFallback(e.error);
    else speechRetry(item, 'SPEECH_UNCLEAR', '');
  };
  rec.onend = () => { setMic(false); if (!handled) { handled = true; speechRetry(item, 'SPEECH_UNCLEAR', ''); } };
  try { rec.start(); setMic(true); log('speech_start', { item: item.id }); setSpeechMsg(''); }
  catch (e) { speechFallback('start_error'); }
}
function onSpeech(item, alts) {
  setMic(false);
  const j = NLP.judgeSpeech(item.word, speechVariants(item), alts);
  log('speech_result', { item: item.id, alts, result: j.result, heard: j.heard });
  if (j.result === 'SPEECH_STD' || j.result === 'SPEECH_VAR') {
    handleAnswer(item, j.result, { input: j.heard, bad: j.heard });
  } else {
    speechRetry(item, j.result, j.heard);
  }
}
function speechRetry(item, key, heard) {
  session.speechTries = (session.speechTries || 0) + 1;
  const t = fbText(key, { word: item.word, bad: heard });
  let html = `<div class="hintbox">${bi(t.hi, t.en)}${heard ? `<br><span class="muted" style="font-size:.85rem">सुना: "${esc(heard)}"</span>` : ''}</div>`;
  if (session.speechTries >= 2) {
    html += `<div class="row" style="margin-top:10px">
      ${btn('speech-type', '✍️ लिखकर करो', 'Write instead', 'primary')}
      ${btn('speech-skip', '⏭ छोड़ो', 'Skip', 'ghost')}</div>`;
  }
  setSpeechMsg(html);
}
function speechFallback(reason) {
  session.speechDisabled = true;
  log('speech_fallback', { reason });
  save();
  toast(bi(FB.SPEECH_FAIL.hi, FB.SPEECH_FAIL.en), 3200);
  ui.speechMsg = '';
  render();
}

/* ================= Hints ================= */
function giveHint() {
  const item = curItem();
  if (!item || session.hint >= 2 || session.phase === 'mid') return;
  session.hint++;
  log('hint', { item: item.id, level: session.hint });
  if (session.hint === 2) {
    // remove one wrong option
    item._removed = item._removed || [];
    if (item.f === 'MCQ') {
      const w = mcqOptions(item).find(o => o !== item.word && !item._removed.includes(o));
      if (w) item._removed.push(w);
    } else if (item.f === 'FILL') {
      const p = fillParts(item);
      const w = fillLetters(item, p).find(l => l !== p.L && !item._removed.includes(l));
      if (w) item._removed.push(w);
    } else if (item.f === 'SPELL' || item.f === 'SPEAK') {
      const g = NLP.graphemes(item.word).map(NLP.N);
      const w = makeTiles(item).find(t => !g.includes(t.t) && !item._removed.includes(t.i) && !(item._slots || []).includes(t.i));
      if (w) item._removed.push(w.i);
    } else if (item.f === 'WHY') {
      const w = item.opts.findIndex((o, i) => !o.ok && !item._removed.includes(i));
      if (w > -1) item._removed.push(w);
    }
  }
  save(); render();
}

/* ================= Feedback sheet ================= */
function openSheet(tone, html, buttons) {
  $app.classList.add('locked');
  $sheet.className = 'sheet ' + (tone || '');
  $sheet.innerHTML = `<div class="sheet-inner" role="dialog" aria-live="assertive">
      <div class="fb-text">${html}</div>
      <div class="fb-actions">${buttons.map(([act, hi, en, cls]) => btn(act, hi, en, cls)).join('')}</div>
    </div>`;
  $sheet.hidden = false;
  const first = $sheet.querySelector('button');
  if (first) first.focus({ preventScroll: true });
}
function closeSheet() { $sheet.hidden = true; $sheet.innerHTML = ''; $app.classList.remove('locked'); }

/* ================= S8 Summary ================= */
function masteryRow(b) {
  const pct = masteryPct(b);
  const learned = pct !== null && pct >= 80 && (profile.mastery[b] || []).length >= 3;
  return `<div class="meter-row" style="margin-top:10px">
      <span><b>${BLOCKS[b].title}</b> ${learned ? `<span class="pill ok">${bi('सीख लिया ✓', 'Learned', true)}</span>` : ''}</span>
      <b>${pct === null ? '—' : pct + '%'}</b>
      <div class="progress ${learned ? 'ok' : ''}"><span style="width:${pct || 0}%"></span></div>
    </div>`;
}
SCREENS.summary = function () {
  const s = session && session.summary;
  if (!s) return go('welcome');
  const pct = s.graded ? Math.round(s.correct / s.graded * 100) : 0;
  const msg = s.reason === 'timeup'
    ? bi('⏰ 10 मिनट पूरे! बहुत अच्छा किया। बाकी शब्द कल दोहराएँगे।', '10 minutes are up! Well done. We will repeat the rest tomorrow.')
    : bi(`🎉 आज का पूरा अभ्यास हो गया, ${esc(profile.name)}!`, `Today's practice is complete, ${esc(profile.name)}!`);
  $app.innerHTML = `
    <div class="stack">
      <h1>${bi('आज का सार 🏁', "Today's summary")}</h1>
      ${mitthu(msg)}
      <div class="stat-grid">
        <div class="stat"><div class="num">${s.correct}/${s.graded}</div><div class="lbl">${bi('पहली बार में सही', 'Right first time')}</div></div>
        <div class="stat"><div class="num">${mmss(s.elapsed)}</div><div class="lbl">${bi('समय लगा', 'Time used')}</div></div>
        <div class="stat"><div class="num">🔥 ${streakDays()}</div><div class="lbl">${bi('दिन लगातार', 'Day streak')}</div></div>
        <div class="stat"><div class="num">💪 ${profile.confidence}</div><div class="lbl">${bi('आत्मविश्वास', 'Confidence')}</div></div>
      </div>
      <div class="card">
        <h3>${bi('आवाज़ें — कितना सीखा', 'Sounds — how much learned')}</h3>
        ${s.blocks.map(masteryRow).join('')}
        ${s.mid ? `<p class="muted" style="margin-top:10px">${bi(`🧐 छोटी जाँच: ${s.mid.ok}/${s.mid.total}`, `Mid-check: ${s.mid.ok}/${s.mid.total}`)}</p>` : ''}
      </div>
      ${s.wrongWords.length ? `<div class="card soft">
        <h3>${bi('🔁 कल फिर अभ्यास करेंगे:', 'We will practise these again tomorrow:')}</h3>
        <div class="chips">${s.wrongWords.map(w => `<span class="chip">${esc(w)}</span>`).join('')}</div>
      </div>` : `<div class="card soft center">${bi('⭐ आज कोई ग़लती दोहरानी नहीं है!', 'No mistakes to repeat today!')}</div>`}
      <p class="center muted">${bi(`स्कोर ${pct}% · ग़लती से ही सीखते हैं! 🌱`, `Score ${pct}% · We learn from mistakes!`)}</p>
    </div>
    ${actionbar(btn('goto-profile', 'मेरी प्रगति 👤', 'My progress', 'ghost') + btn('summary-done', 'कल फिर मिलेंगे 👋', 'See you tomorrow', 'primary'))}`;
};

/* ================= S9 Profile ================= */
SCREENS.profile = function () {
  if (!profile) return go('welcome');
  const sd = streakDays();
  const days = new Set(profile.days || []);
  const dots = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - k));
    const on = days.has(today(d));
    return `<div class="dot ${on ? 'on' : ''}"><i>${on ? '🔥' : ''}</i>${WEEKDAYS_HI[d.getDay()]}</div>`;
  }).join('');
  const canResume = resumable();
  $app.innerHTML = `
    <div class="stack">
      <button type="button" class="back" data-act="back">← ${bi('वापस', 'Back', true)}</button>
      <h1>${bi('मेरी प्रगति 👤', 'My progress')}</h1>
      <div class="card brand">
        <div class="row"><div style="font-size:2.4rem">🧒</div>
          <div><div style="font-size:1.3rem;font-weight:800">${esc(profile.name)}</div><div>${bi(`कक्षा ${profile.cls}`, `Class ${profile.cls}`)}</div></div></div>
      </div>
      <div class="card">
        <h3>🔥 ${bi(`${sd} दिन लगातार`, `${sd}-day streak`)}</h3>
        <div class="dots">${dots}</div>
      </div>
      <div class="card">
        <h3>📚 ${bi('जो आवाज़ें सीख रहा हूँ', 'Sounds I am learning')}</h3>
        ${BLOCK_ORDER.map(b => masteryPct(b) === null
          ? `<div class="meter-row" style="margin-top:10px"><span><b>${BLOCKS[b].title}</b></span><span class="muted">${bi('अभी शुरू नहीं', 'Not started', true)}</span></div>`
          : masteryRow(b)).join('')}
        <p class="muted" style="font-size:.82rem;margin-top:8px">${bi('पिछले 5 जवाबों में से कितने सही। 80% पर "सीख लिया ✓"।', 'Share of the last 5 answers that were right. "Learned" at 80%.')}</p>
      </div>
      <div class="card">
        <div class="meter-row"><span>💪 <b>${bi('आत्मविश्वास', 'Confidence', true)}</b></span><b>${profile.confidence}</b>
          <div class="progress accent"><span style="width:${profile.confidence}%"></span></div></div>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="num">${Math.round((profile.totalSec || 0) / 60)}</div><div class="lbl">${bi('कुल मिनट', 'Total minutes')}</div></div>
        <div class="stat"><div class="num">${profile.completed || 0}</div><div class="lbl">${bi('सत्र पूरे', 'Sessions done')}</div></div>
      </div>
      ${(profile.review || []).length ? `<div class="card soft"><h3>🔁 ${bi('दोहराने वाले शब्द', 'Words to review')}</h3><div class="chips">${profile.review.map(r => `<span class="chip">${esc(r.word)}</span>`).join('')}</div></div>` : ''}
      <div class="row wrap">
        ${btn('goto-log', '📊 लॉग (शिक्षक के लिए)', 'Log (for teacher)', 'small ghost')}
        ${btn('reset', '🔄 नई शुरुआत', 'Reset all', 'small ghost')}
      </div>
      ${ui.confirmReset ? `<div class="warnbox">${bi('पक्का? इस फ़ोन से सारी प्रगति मिट जाएगी।', 'Sure? All progress on this phone will be erased.')}
        <div class="row" style="margin-top:8px">${btn('reset-confirm', 'हाँ, सब मिटाओ', 'Yes, erase', 'small')}${btn('reset-cancel', 'रहने दो', 'Cancel', 'small primary')}</div></div>` : ''}
    </div>
    ${actionbar(canResume ? btn('resume', 'जारी रखो ▶', 'Continue', 'primary') : btn('start', 'आज का अभ्यास शुरू करो ▶', "Start today's practice", 'primary'))}`;
};

/* ================= S10 Log viewer ================= */
SCREENS.log = function () {
  const rows = LOG.slice(-300).reverse();
  const answers = LOG.filter(e => e.ev === 'answer');
  const counts = {};
  answers.forEach(e => { counts[e.result] = (counts[e.result] || 0) + 1; });
  const detail = e => {
    const skip = new Set(['t', 'sid', 'ev', 'screen']);
    return esc(Object.keys(e).filter(k => !skip.has(k)).map(k => `${k}=${typeof e[k] === 'object' ? JSON.stringify(e[k]) : e[k]}`).join(' · '));
  };
  $app.innerHTML = `
    <div class="stack">
      <button type="button" class="back" data-act="back">← ${bi('वापस', 'Back', true)}</button>
      <h1>📊 Clickstream log</h1>
      <p class="muted">${LOG.length} events stored on this device (key <code>${STORE_PREFIX}log</code>). For the teacher / evaluator (DESIGN.md §D4.5, §D8.2).</p>
      <div class="card soft"><b>Answer results:</b> ${Object.keys(counts).length ? Object.entries(counts).map(([k, v]) => `<span class="pill">${esc(k)}: ${v}</span>`).join(' ') : '—'}</div>
      <div class="row wrap">
        ${btn('log-export', '⬇️ Export JSON', '', 'small primary')}
        ${btn('log-clear', '🗑️ Clear', '', 'small ghost')}
      </div>
      ${ui.confirmClear ? `<div class="warnbox">Clear all log events? ${btn('log-clear-confirm', 'Yes, clear', '', 'small')}</div>` : ''}
      <div class="logwrap"><table class="logtable">
        <thead><tr><th>time</th><th>event</th><th>details</th></tr></thead>
        <tbody>${rows.map(e => `<tr><td>${esc(new Date(e.t).toLocaleTimeString('en-GB'))}</td><td><b>${esc(e.ev)}</b><br><span class="muted">${esc(e.screen || '')}</span></td><td>${detail(e)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;
};

function exportLog() {
  const data = JSON.stringify({ app: 'Bhojpurify', id: APP_ID, exported: new Date().toISOString(), profile: profile ? { cls: profile.cls, sessions: profile.sessions, completed: profile.completed, mastery: profile.mastery, confidence: profile.confidence, days: profile.days } : null, events: LOG }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bhojpurify-log-${APP_ID}-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  log('log_export', { events: LOG.length });
}

/* ================= Actions (event delegation) ================= */
const ACTIONS = {
  noop: () => {},
  start: () => startSession(),
  resume: () => { if (resumable()) go(session.phase); else startSession(); },
  fresh: () => { log('session_abandon', { phase: session && session.phase }); session = null; save(); startSession(); },
  diag: el => answerDiag(el.dataset.v),
  card: el => toggleCard(el.dataset.id),
  'card-preview': el => { const c = CARDS.find(x => x.id === el.dataset.id); say(c.ex[0]); setTimeout(() => say(c.ex[1]), 1300); log('card_preview', { card: c.id }); },
  'confirm-remove': el => { session.confirmRemove = null; session.chosen = session.chosen.filter(x => x !== el.dataset.id); log('topic_toggle', { card: el.dataset.id, on: false, recommended: true, confirmed: true }); save(); render(); },
  'cancel-remove': () => { session.confirmRemove = null; render(); },
  'retake-diag': () => { session.phase = 'diag'; session.diagIdx = 0; session.skippedDiag = false; log('diag_retake'); save(); go('diag'); },
  'choose-next': () => startPractice(),
  chip: el => { const b = session.blocks[session.bi]; say(el.dataset.w); ui.breakdown = breakdownHtml(el.dataset.w, b); document.getElementById('breakdown').innerHTML = ui.breakdown; log('concept_word', { word: el.dataset.w }); },
  'concept-next': () => conceptNext(),
  listen: el => { if (!say(el.dataset.w)) toast(bi('इस फ़ोन में हिंदी आवाज़ नहीं है।', 'No Hindi voice on this device.')); },
  opt: el => { const it = curItem(); handleAnswer(it, NLP.classify(it.word, el.dataset.v), { input: el.dataset.v, el }); },
  letter: el => { const it = curItem(); const p = fillParts(it); const resp = p.before + el.dataset.v + p.after; handleAnswer(it, NLP.classify(it.word, resp), { input: el.dataset.v, bad: resp, el }); },
  tile: el => { const it = curItem(); const n = NLP.graphemes(it.word).length; it._slots = it._slots || []; if (it._slots.length < n) { it._slots.push(+el.dataset.i); render(); } },
  slot: el => { const it = curItem(); const k = +el.dataset.i; if (it._slots && it._slots[k] != null) { it._slots.splice(k, 1); render(); } },
  'check-spell': () => { const it = curItem(); const tiles = makeTiles(it); const resp = it._slots.map(i => tiles.find(t => t.i === i).t).join(''); handleAnswer(it, NLP.classify(it.word, resp), { input: resp, bad: resp }); },
  word: el => {
    const it = curItem(); const words = it.sentence.split(' '); const i = +el.dataset.i;
    const bad = words[i].replace(/[।.,!?]/g, '');
    handleAnswer(it, i === it.wrongIdx ? 'CORRECT' : 'FIND_MISS', { input: bad, bad, el });
  },
  why: el => { const it = curItem(); const o = it.opts[+el.dataset.i]; handleAnswer(it, o.ok ? 'CORRECT' : o.label, { input: o.hi, el }); },
  mic: () => startListening(),
  'demo-say': () => { const v = (document.getElementById('demoText').value || '').trim(); if (v) { log('demo_transcript', { text: v }); onSpeech(curItem(), [{ text: v, conf: 1 }]); } },
  'speech-type': () => { session.speechDisabled = true; log('speech_fallback', { reason: 'two_unclear' }); ui.speechMsg = ''; save(); render(); },
  'speech-skip': () => { log('skip', { item: curItem().id }); nextTask(); },
  hint: () => giveHint(),
  retry: () => retryTask(),
  next: () => nextTask(),
  'goto-profile': () => go('profile'),
  'goto-log': () => go('log'),
  back: () => go(prevScreen && prevScreen !== currentScreen && prevScreen !== 'log' ? prevScreen : (resumable() ? session.phase : 'welcome')),
  'summary-done': () => { session = null; save(); go('welcome'); },
  reset: () => { ui.confirmReset = true; render(); },
  'reset-cancel': () => { ui.confirmReset = false; render(); },
  'reset-confirm': () => { log('reset_all'); profile = null; session = null; save(); store.set('profile', null); store.set('session', null); go('welcome'); },
  'log-export': () => exportLog(),
  'log-clear': () => { ui.confirmClear = true; render(); },
  'log-clear-confirm': () => { LOG = []; store.set('log', LOG); ui.confirmClear = false; log('log_cleared'); render(); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  e.stopPropagation();
  fn(el);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.sound-card[data-act]')) { e.preventDefault(); e.target.click(); }
});

/* ================= Header ================= */
document.getElementById('brandBtn').addEventListener('click', () => go('welcome'));
document.getElementById('profileBtn').addEventListener('click', () => go(profile ? 'profile' : 'welcome'));
const $lang = document.getElementById('langBtn');
function applyLang() {
  document.body.classList.toggle('show-en', lang === 'en');
  $lang.setAttribute('aria-pressed', lang === 'en');
  $lang.title = lang === 'en' ? 'Hide English' : 'Show English';
}
$lang.addEventListener('click', () => { lang = lang === 'en' ? 'hi' : 'en'; store.set('lang', lang); applyLang(); log('lang_toggle', { lang }); });

/* ================= Timer (C4) — counts only while a session screen is visible ================= */
setInterval(() => {
  if (session && TIMED_PHASES.includes(session.phase) && currentScreen === session.phase && !document.hidden) {
    session.elapsed++;
    if (session.elapsed % 5 === 0) save();
  }
  renderTimer();
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); log('pause'); } else { log('resume'); }
});
window.addEventListener('pagehide', () => save());

/* ================= Boot ================= */
(function boot() {
  applyLang();
  loadVoices();
  if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = loadVoices;
  if (session && session.phase === 'summary') session = null;
  if (session && !resumable()) { log('session_expired', { phase: session.phase }); session = null; }
  save();
  log('app_open', { demo: DEMO, speech: !!SR, ua: navigator.userAgent.slice(0, 80) });
  go('welcome');
})();
