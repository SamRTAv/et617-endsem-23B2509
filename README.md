# Bhojpurify 🦜 · ET617 · 23B2509

**"बोलो अपने अंदाज़ में, लिखो किताब के अंदाज़ में।"** *Speak your own way, write the book's way.*

Bhojpurify helps Class 6 children who speak **Bhojpuri at home** and study in **Hindi-medium schools** spell **श / स** and **ड़ (ढ़)** correctly. It accepts their regional pronunciation when they speak (e.g. "साम" for शाम) but teaches the standard spelling when they write, in **10-minute sessions** that can be stopped and resumed.

- **Card:** P2 / T10 / L8 / C4 (Contextual language app · Hindi for Bhojpuri speakers: श/स and ड़ · home language ≠ school medium · 10-minute sessions)
- **Live app:** https://et617-23b2509.vercel.app
- **Design report:** [DESIGN.md](DESIGN.md) (D1–D8)
- **Licence:** [CC BY 4.0](LICENSE)

## Run locally

No build step: it's a static site.

```bash
# any static server works, for example:
python -m http.server 5173
# or
npm start            # npx serve on port 5173
```

Open http://localhost:5173 in **Chrome or Edge** (speech recognition needs Chrome/Edge; localhost counts as a secure origin, so the mic works).

- `?demo=1` (e.g. http://localhost:5173/?demo=1) adds a "simulate transcript" box under the 🎤 button, so the speech path can be tested without a microphone.
- 📊 **Log** (Profile → लॉग) shows the clickstream and exports it as JSON.
- **EN** in the header shows English translations under the Hindi text.

## Tests

```bash
npm install      # dev-only: jsdom + puppeteer-core
npm test         # classifier tests + both D5 scenarios end-to-end
node tools/screenshots.js http://localhost:5173 screenshots   # capture D5 screenshots (uses installed Edge/Chrome)
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell; header with the ID badge **23B2509**, timer, EN toggle, profile |
| `styles.css` | Mobile-first styles (360 px), no external assets |
| `app.js` | Screens S1–S10, session flow + resume (C4), adaptivity rules, speech, clickstream log |
| `nlp.js` | Spelling-error classifier, speech judge, akshara segmentation |
| `data.js` | Word bank, concept text, Bhojpuri pronunciation variants, feedback library |
| `tests/` | `nlp.test.js` (30 checks), `smoke.test.js` (scenarios A and B, resume, no-mic fallback) |
| `tools/screenshots.js` | Captures the D5 screenshot set in a real browser |
