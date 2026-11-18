# DESIGN.md — Bhojpurify (भोजपुरीफ़ाई)

> **"बोलो अपने अंदाज़ में, लिखो किताब के अंदाज़ में।"**
> *Speak your own way, write the book's way.*

| Field | Value |
|---|---|
| **Course** | ET 617 — Educational Application Design, IIT Bombay (2026) |
| **Identity token (ID)** | **23B2509** |
| **Card** | **P2 / T10 / L8 / C4** |
| **P — Problem** | P2: Contextual language and literacy application (NLP · Language learning · Localisation) |
| **T — Topic** | T10: Hindi for Bhojpuri-speaking learners — श / स and ड़ |
| **L — Learner context** | L8: Learner whose home language differs from the school medium (Bhojpuri at home, Hindi at school) |
| **C — Design constraint** | C4: 10-minute sessions — one complete learning sequence fits in 10 minutes; learner can stop and resume |
| **Live app** | https://et617-23b2509.vercel.app |
| **Licence** | CC BY 4.0 (see `LICENSE`) |

---

## 0. Requirement traceability

Every assignment requirement mapped to where it is met (in this document and in the app).

| Requirement | Where it is met |
|---|---|
| P2: at least one NLP capability | Speech recognition (§D6.1) + rule-based spelling-error classification (§D6.2) |
| P2 design challenge: error vs. acceptable variation, one example each | §D7.3, Screen S5 (Speak task accepts "साम"; Write task flags "साम") |
| D1 Problem, 3 measurable outcomes, context of use | §D1 |
| D2 Persona expanded from L8 | §D2 |
| D3 Concept explanation, ≥5 tasks in ≥2 formats, model answers, feedback for correct + each misconception | §D3 (14 core tasks, 6 formats) |
| D4 ≥5 connected screens, inputs/outputs/transitions, C4 visible, ID on every screen | §D4 (9 screens + log viewer) |
| D5 Two contrasting scenarios with screenshots | §D5 |
| D6 AI spec: what, input (actual call), output, check, fallback | §D6 |
| D7 Pedagogical rationale, design challenge, how C4 and L8 shaped design | §D7 |
| D8 Evaluation plan: items/rubric, log data, success criteria | §D8 |
| Course: CC BY 4.0, GitHub repo, clickstream capture | `LICENSE`, repo, §D4.5 |

---

## D1. Educational problem

### D1.1 Problem statement

Children in Bhojpuri-speaking districts of Bihar and eastern Uttar Pradesh learn to read and write in **Hindi-medium schools**, but speak **Bhojpuri at home**. Bhojpuri speech commonly does not separate **श** from **स** (शाम is said as "साम"), and often says **ड़** like **र** or **ड** (सड़क as "सरक" or "सडक"). Because young writers spell the way they speak, they write *साम, सहर, सरक, पेर* in dictation (श्रुतलेख), and teachers mark them wrong, usually without explaining why. Children start to believe their home language is "wrong". Existing apps make this worse by marking their pronunciation as an error. These learners need short, private practice that **accepts their accent when they speak** but **teaches standard spelling when they write**.

### D1.2 Learning outcomes (Revised Bloom's Taxonomy verbs)

After 3–4 sessions of 10 minutes, the learner will be able to:

| # | Outcome | Bloom level | Measured by |
|---|---|---|---|
| **LO1** | **Distinguish** the correct written form of a word when श/स or ड़/ड/र alternatives are given | Analyse | ≥ 8 of 10 recognition items correct (§D8) |
| **LO2** | **Spell** common words containing श and ड़ correctly, including words not practised in the app | Apply | ≥ 8 of 10 dictated words correct, 4 of them unseen |
| **LO3** | **Explain** why a word is written with श or ड़ even if it is said differently at home, and **predict** ड vs ड़ using the position rule (ड़ never begins a word) | Understand / Apply | "Why?" items + one open oral answer scored on a 0–2 rubric; score ≥ 2 |

### D1.3 Context of use

| | |
|---|---|
| **Where** | At home, sitting on the floor near the family charging point; sometimes in the school's free period |
| **When** | Evenings, about 8:00–8:30 pm, after the father returns the phone |
| **Device** | Father's budget Android phone (6-inch screen, ~360 px CSS width), Chrome, shared prepaid data (~1.5 GB/day for the family), patchy 4G |
| **Duration** | One sitting of about 10 minutes, often interrupted when the phone is needed for a call |

---

## D2. Learner persona (expanded from L8)

### रवि कुमार (Ravi Kumar)

| Field | Detail |
|---|---|
| **Name & age** | Ravi Kumar, 11 years |
| **Class / school** | Class 6, government Hindi-medium middle school, Ara (Bhojpur district), Bihar |
| **Home language** | Bhojpuri. Hindi is heard on TV and in school. |
| **Location & support system** | Lives with parents and an elder sister (Class 10). Father works at a hardware shop; mother studied till Class 8 and reads Hindi slowly. The sister sometimes helps with homework but is busy with board exams. No private tuition. |
| **Device & data** | Shares father's Android phone (Chrome, ~360 px wide). Family data pack is shared; videos are avoided to save data. |
| **Time available** | ~10 minutes in the evening, 4–5 days a week. Often interrupted. |
| **Prior knowledge (prerequisites)** | Knows the full Hindi varnamala and all matras. Reads 3–4 word sentences slowly. Recognises श and स as separate letters on a chart, but uses them interchangeably while writing. Has seen ड़ but does not know what the dot means. Can type on a phone using the on-screen letters if they are shown. |
| **Misconception M1** | *"श और स एक ही आवाज़ हैं, तो कोई भी लिख दो।"* ("श and स are the same sound, so either spelling works.") He writes **साम** for शाम, **सहर** for शहर, **देस** for देश. |
| **Misconception M2** | *"ड़ बस ड (या र) है, बिंदी से कोई फ़र्क नहीं पड़ता।"* ("ड़ is just ड or र; the dot doesn't matter.") He writes **सडक** or **सरक** for सड़क, **पेर** for पेड़, **लरका** for लड़का. |
| **Side risk (watched by the app)** | Over-correction once he learns श: writing **शब** for सब, **शात** for सात. |
| **Primary goal** | Get full marks in the Friday dictation (श्रुतलेख) and stop seeing red circles in his copy. |
| **Biggest frustration** | "Ma'am says I speak wrong." He feels embarrassed about how his family talks. |
| **Motivation driver** | Keeps going with praise, visible progress (streaks, mastery bars) and small wins. Gives up if he is corrected harshly or if a task is long. |
| **Theory link** | **Language transfer / contrastive analysis** (Lado, 1957): his spelling errors come from Bhojpuri sound patterns, not from carelessness. **Affective filter hypothesis** (Krashen, 1982): shame about his home language raises anxiety and blocks learning, so the app must never mark his accent as wrong. **Cognitive load theory** (Sweller, 1988): he reads slowly, so each screen must have one short task. |

---

## D3. Educational content

### D3.1 Structure of one session (fits C4)

```
Diagnostic (3 Q) → Choose sounds → [ for each chosen sound block:  Concept → 6 tasks ] → Mid-check → Summary
```

Each **sound block** teaches one contrast only (Cognitive Load Theory). Tasks inside a block move up Bloom's levels: **recognise → recall a letter → produce (speak / spell) → analyse (find error) → explain (why)**.

Sound blocks available (all within T10):

| Card | Block | Contrast | Distractors used |
|---|---|---|---|
| 1 | **श-block** | श vs स | स (and ष on letter tasks) |
| 2 | **ड़-block (ड)** | ड़ vs ड | ड |
| 3 | **ड़-block (र)** | ड़ vs र | र |
| 4 | **ढ़-block** (bonus, same rule) | ढ़ vs ढ | ढ, र |

Cards 2 and 3 share one ड़-block. The card(s) chosen decide which distractor (ड or र) appears in tasks.

### D3.2 Concept explanations (shown on screen S4)

The guide character is **मिट्ठू (Mitthu), a talking parrot 🦜**, a familiar figure in Bihar homes. He speaks in short, conversational Hindi using "हम" and "चलो". Target letters are shown **bold and coloured** inside every word.

**श-block concept**

> 🦜 **चलो, एक बात समझते हैं!**
> घर पर हम **"साम"** बोलते हैं — यह हमारी भोजपुरी का तरीका है, और यह बिल्कुल ठीक है। 😊
> पर किताब वाली हिंदी में यह शब्द **श** से लिखा जाता है: **श**ाम।
>
> **पहली बात:** बोलना और लिखना अलग हो सकते हैं।
> **दूसरी बात:** कुछ शब्दों में **श** आता है — **श**ाम, **श**हर, दे**श**, **श**ेर।
> **तीसरी बात:** कुछ शब्दों में **स** ही रहता है — **स**ब, **स**ात, **स**मय। हर स को श मत बनाना!
>
> 🧠 **याद रखने की तरकीब:** "**श**ाम को **श**ेर **श**हर आया।"

*(English gloss: At home we say "साम". That is our Bhojpuri way, and it is fine. But in book Hindi this word is written with श. First: speaking and writing can differ. Second: some words have श. Third: some words keep स, so don't turn every स into श. Memory trick: "In the evening the lion came to the city.")*

**ड़-block concept**

> 🦜 **देखो, ड़ के नीचे एक छोटी-सी बिंदी होती है!**
>
> **पहली बात:** ड़ कभी शब्द के **शुरू में नहीं** आता। शुरू में हमेशा **ड**: **ड**र, **ड**ाल, **ड**िब्बा।
> **दूसरी बात:** शब्द के **बीच में या आखिर में** अक्सर **ड़** आता है: स**ड़**क, पे**ड़**, ल**ड़**का।
> **तीसरी बात:** अगर ड से पहले **ं** (बिंदु) हो, तो ड ही रहता है: अं**ड**ा, ठं**ड**ा।
> **चौथी बात:** घर पर हम "पेर" या "सरक" बोल सकते हैं — कोई बात नहीं! पर लिखते हैं पे**ड़**, स**ड़**क।

*(English gloss: ड़ has a small dot below. First: ड़ never begins a word; at the start it is always ड. Second: in the middle or at the end it is often ड़. Third: after the nasal sign ं it stays ड (अंडा, ठंडा). Fourth: at home we may say "पेर" or "सरक", and that's fine, but we write पेड़, सड़क.)*

**ढ़-block concept:** the same position rule as ड़: ढोल (start = ढ); प**ढ़**ना, सी**ढ़**ी, बू**ढ़**ा (middle/end = ढ़).

### D3.3 Task formats (6 formats)

| Code | Format | Learner input | Bloom level |
|---|---|---|---|
| **MCQ** | Choose the correct word (2–3 options) | Tap | Remember / Analyse |
| **FILL** | Fill in the missing letter (word with a blank + letter options) | Tap a letter | Remember |
| **SPEAK** | Read the word aloud (speech recognition) | Voice 🎤 (fallback: type) | Apply (oral) |
| **SPELL** | Build the word from akshara tiles that include confusable distractor tiles | Tap tiles in order | Apply |
| **FIND** | Tap the wrongly spelled word in a sentence | Tap a word | Analyse |
| **WHY** | Choose the correct reason (each wrong option maps to a misconception) | Tap | Understand |

### D3.4 Task bank with model answers

**श-block (core sequence, Level 1–2)**

| # | Format | Prompt (on screen) | Options / input | Model answer |
|---|---|---|---|---|
| S1 | MCQ | 🌆 सूरज डूबने का समय कौन-सा है? | शाम / साम | **शाम** |
| S2 | FILL | 🏙️ बड़ी जगह, जहाँ बहुत लोग रहते हैं: **_हर** | श / स / ष | **श** (शहर) |
| S3 | SPEAK | 🎤 यह शब्द बोलो: **शाम** | voice | accept **शाम** or **साम** |
| S4 | MCQ | कौन-सा शब्द **स** से ही लिखा जाता है? | सब / शब | **सब** (checks over-correction) |
| S5 | SPELL | 🦁 जंगल का राजा — टुकड़े जोड़कर लिखो | tiles: [शे] [से] [र] | **शेर** |
| S6 | FIND | ग़लत शब्द पर टैप करो: "शाम को हम **सहर** गए।" | tap a word | **सहर** → शहर |
| S7 | WHY | हम "साम" बोलते हैं, पर "शाम" क्यों लिखते हैं? | (a) किताब की हिंदी में इस शब्द की सही वर्तनी श से है; बोलना अलग हो सकता है · (b) "साम" बोलना ग़लत है, घर की भाषा ग़लत है · (c) श और स एक ही हैं, कोई भी लिखो | **(a)**. (b) → feedback on home-language shame; (c) → M1 |

**श-block Level 3 (harder words, after 3 correct in a row):** दे_ (FILL → श), आकाश (SPELL: [आ][का][श][स]), रो_नी (FILL → श), शादी (SPELL: [शा][सा][दी]).
**श-block remediation items (Level 1, after 2 M1 errors):** listen-and-choose 🔊 शाम / साम; FILL _ेर (🦁).

**ड़-block (core sequence)**

| # | Format | Prompt | Options / input | Model answer |
|---|---|---|---|---|
| R1 | MCQ | 🛣️ जिस पर गाड़ियाँ चलती हैं: | सड़क / सडक / सरक | **सड़क** |
| R2 | FILL | 🌳 **पे_** | ड / ड़ / र | **ड़** (पेड़) |
| R3 | SPEAK | 🎤 यह शब्द बोलो: **सड़क** | voice | accept **सड़क**, **सरक**, **सडक** |
| R4 | MCQ | किस शब्द के **शुरू** में सही अक्षर है? 😨 | डर / ड़र | **डर** (position rule) |
| R5 | SPELL | 👦 टुकड़े जोड़कर लिखो: "लड़का" | tiles: [ल] [ड़] [ड] [र] [का] | **लड़का** |
| R6 | FIND | ग़लत शब्द पर टैप करो: "मेरा **घोरा** तेज़ दौड़ता है।" | tap | **घोरा** → घोड़ा |
| R7 | WHY | "पेड़" में ड़ क्यों, पर "डर" में ड क्यों? | (a) ड़ शब्द के शुरू में नहीं आता; डर में ड शुरू में है · (b) दोनों एक ही हैं, कोई भी लिखो · (c) जो सुंदर लगे वह लिखो | **(a)**. (b) → M2 |

**ड़-block Level 3:** पहा_ (FILL → ड़), पकड़ना (SPELL), ठं_ा (FILL → **ड**, the nasal exception), कपड़ा (SPELL).
**ड़-block remediation:** listen-and-choose 🔊 पेड़ / पेर; FILL ब_ा (बड़ा).

**ढ़-block (bonus):** MCQ पढ़ना / पढना; FILL सी_ी (ढ़); SPEAK पढ़ना (accept पढ़ना, पढना, परहना); SPELL बूढ़ा; FIND "मैं रोज़ **पढता** हूँ।"; WHY "ढोल में ढ, पढ़ना में ढ़ क्यों?"

**Mid-check (after the first block, 2 new words, no hints):** श-block → MCQ शरबत / सरबत; FILL _िकार (शिकार). ड़-block → MCQ गाड़ी / गाडी; FILL थो_ा (थोड़ा).

### D3.5 Feedback library (actual text shown)

The app classifies every written answer (§D6.2) and shows the matching feedback. Feedback is always kind, names the **letter**, shows the correct word with the letter highlighted, and offers **one retry**.

| Response type | Example | Feedback shown (Hindi) | English gloss | Next step |
|---|---|---|---|---|
| **Correct** | शाम | शाबाश, रवि! 🎉 **श**ाम में **श** ही आता है। | Well done Ravi! शाम has श. | Confidence +8, next task |
| **Correct after hint/retry** | शाम (2nd try) | बहुत अच्छे! इस बार तुमने सही कर लिया। 💪 | Very good! You got it this time. | Confidence +4 |
| **M1: स for श** | साम | तुम्हारा बोलना बिल्कुल ठीक है! 😊 पर लिखते समय यहाँ **श** लगता है: **श**ाम। चलो, एक बार और। | Your speaking is fine! But in writing this needs श. Try once more. | Retry with श/स highlighted |
| **Over-correction: श for स** | शब | ध्यान दो! **स**ब में **स** ही आता है। हर स, श नहीं बनता: **स**ब, **स**ात, **स**मय। | Careful! सब keeps स. Not every स becomes श. | Retry |
| **M2-D: ड for ड़** | सडक | लगभग सही! 👀 यहाँ ड के नीचे **बिंदी** चाहिए: स**ड़**क। बीच में आने वाला यह अक्षर **ड़** होता है। | Almost! This needs the dot: सड़क. | Retry |
| **M2-R: र for ड़** | सरक | घर पर हम "सरक" बोलते हैं — कोई बात नहीं! पर लिखते हैं स**ड़**क, **र** नहीं। | At home we say "सरक", fine! But we write सड़क, not र. | Retry |
| **Position error: ड़ at word start** | ड़र | ड़ शब्द के **शुरू में कभी नहीं** आता। शुरू में **ड**: **ड**र। | ड़ never starts a word. At the start: ड. | Retry |
| **Other error** | शम | यह शब्द ऐसे लिखते हैं: **शाम**। एक बार ध्यान से देखो। 👀 | This word is written: शाम. | Show answer, re-queue later |
| **Speech: standard** | heard "शाम" | वाह! तुमने "शाम" साफ़ बोला। 🎉 | Wow! You said शाम clearly. | Next |
| **Speech: dialect variant (accepted)** | heard "साम" | बहुत बढ़िया! 🎉 "साम" — यह तुम्हारे इलाके का उच्चारण है, **बिल्कुल ठीक है**। बस लिखते समय याद रखना: **श**ाम। | Great! "साम" is how people in your area say it, completely fine. Just remember to write शाम. | Next (counted correct) |
| **Speech: unclear** | no match | आवाज़ साफ़ नहीं आई। एक बार फिर बोलो 🎤 | Didn't catch that. Say it again. | Retry (max 2), then type fallback |
| **WHY option (b)** | "घर की भाषा ग़लत है" | नहीं! तुम्हारी भोजपुरी ग़लत नहीं है। ❤️ बोलने के कई तरीके होते हैं। बस **लिखने** का एक तय तरीका है। | No! Your Bhojpuri is not wrong. There are many ways to speak, but one fixed way to write. | Show correct reason |
| **Remediation trigger** | 2 M1 errors | 🦜 लगता है श/स थोड़ा मुश्किल लग रहा है। चलो, एक छोटी-सी बात फिर से देखें। | Looks like श/स is a bit hard. Let's look again quickly. | Mini-lesson + 2 easy items |

**Retry policy:** a wrong answer gets feedback and one retry. A second wrong answer shows the correct word, marks the item "दोबारा देखेंगे" (we'll see it again), and re-queues it 2 tasks later (spacing).

---

## D4. Working application

### D4.1 Screens and transitions

The ID badge **"ET617 · 23B2509"** sits in the header of **every** screen, next to the **⏱ timer** and **👤 profile** button.

| ID | Screen | Learner input | System output | Transitions to |
|---|---|---|---|---|
| **S1** | **स्वागत / Welcome** | Name, class (first visit only); "शुरू करो" or "जारी रखो" | Greeting by name; 10-minute plan; resume card if a session is saved ("पिछली बार तुम श/स के सवाल 4 पर थे — जारी रखें?") | S2 (new), S5 (resume), S9 |
| **S2** | **जाँच / Diagnostic** | 3 MCQ taps (शाम/साम, सड़क/सडक/सरक, पढ़ना/पढना) | One question at a time, no right/wrong shown (low stakes) | S3 |
| **S3** | **क्या सीखना है? / Choose sounds** | Tap sound cards on/off; 🔊 preview each pair | Cards flagged by the diagnostic are pre-selected with "⭐ सुझाया गया"; warning if a recommended card is removed; estimated session time | S4 |
| **S4** | **समझो / Concept** | "आगे" (next); 🔊 listen; "अक्षर तोड़ो" tool | Mitthu's explanation for the current block, letters highlighted, contrast pairs | S5 |
| **S5** | **अभ्यास / Practice** | Taps, tiles, voice, "इशारा" (hint) button | One task (6 formats); progress bar "सवाल 3 / 6"; hint pulses after 20 s idle | S6 (after each answer) |
| **S6** | **जवाब / Feedback** (panel over S5) | "फिर से करो" / "आगे" | Feedback by error type (§D3.5), confidence meter change, correct word highlighted | S5 (next/retry), S4 (remediation mini-lesson), S7 |
| **S7** | **छोटी जाँच / Mid-check** | 2 new items, no hints | Pass → next block; fail → 2 remediation items first | S4 (next block) / S5 / S8 |
| **S8** | **आज का सार / Summary** | "प्रगति देखो", "कल फिर मिलेंगे" | Score, time used, mastery per sound, words to review, streak +1 | S9, S1 |
| **S9** | **मेरी प्रगति / Profile** | "आज का अभ्यास शुरू करो"; "नई शुरुआत" (reset) | Name, 🔥 streak with 7-day dots, mastery bar per sound ("सीख लिया ✓" at ≥ 80%), confidence meter, total time, sessions | S1 / S5 |
| **S10** | **📊 Log** (for teacher / evaluator, from S9 footer) | "Export JSON", "Clear" | Clickstream table (§D4.5) | S9 |

### D4.2 How C4 (10-minute sessions) is visibly implemented

| C4 requirement | Implementation (visible in the app) |
|---|---|
| One complete sequence fits in 10 min | Fixed plan: diagnostic ~1 min, choose ~0.5 min, concept ~1 min per block, 6 tasks × ~40 s per block, mid-check ~0.5 min, summary ~0.5 min. **1 block ≈ 6 min, 2 blocks ≈ 9.5 min.** If 3 blocks are chosen, each block is shortened to 4 tasks (MCQ, FILL, SPELL, WHY) so the total stays under 10 min. S3 shows "⏱ लगभग 9 मिनट" for the current choice. |
| Visible time | Header countdown **"⏱ 7:42 बचे"** (left) on every screen; turns amber at 2:00. The timer pauses when the tab is hidden (phone taken away). |
| Graceful end | At 9:30 the current task finishes, then the app goes to S8: "आज के लिए बहुत अच्छा! बाकी कल करेंगे।" Unfinished tasks are saved for the next session. |
| Stop and resume | State is saved to `localStorage` **after every answer** and on `visibilitychange`. Reopening shows the resume card on S1 with the exact block and question number. Saved sessions older than 24 h are offered as a fresh start instead. |

### D4.3 Topic-specific tools (rubric T6)

1. **Confusable letter pad:** FILL tasks show confusable letters side by side in the same order every time (श स ष / ड ड़ र / ढ ढ़).
2. **Akshara tiles:** SPELL tasks split the word into akshara units with `Intl.Segmenter` and add confusable distractor tiles (e.g. [शे][से][र]). No Hindi keyboard is needed on the phone.
3. **🔊 Listen:** reads any word aloud with the device's Hindi voice (`speechSynthesis`, `hi-IN`).
4. **"अक्षर तोड़ो" (break the word):** shows a word split into aksharas with the target letter boxed: स | **ड़** | क.

### D4.4 Interface design principles (rubric T1)

- **Visibility:** one task per screen; the primary action is always a large button in the bottom bar (thumb reach on a 360 px screen).
- **Affordance:** buttons have borders and icons (🎤 बोलो, 🔊 सुनो, 💡 इशारा); selected tiles visibly lift.
- **Consistency:** green = continue, the same feedback panel position, the same header on all screens.
- **Mapping:** progress bar fills left to right as tasks are done; the timer counts down; tiles go into slots in reading order.
- **No hover-only interactions;** works fully by touch.

### D4.5 Clickstream logging

Every learner action is appended to a local event log (`localStorage` key `et617_23b2509_log`) and can be viewed or exported on S10.

```json
{ "t": "2026-11-18T20:04:11.512Z", "sid": "s_3", "ev": "answer",
  "screen": "S5", "block": "sh", "item": "S2", "format": "FILL",
  "input": "स", "result": "M1", "attempt": 1, "latencyMs": 6240,
  "hints": 0, "level": 1, "confidence": 46 }
```

Events logged: `app_open`, `screen_view`, `diag_answer`, `topic_toggle` (with `recommended: true/false`), `concept_listen`, `answer`, `hint`, `speech_result` (raw transcript + alternatives), `speech_fallback`, `remediation_start`, `level_change`, `midcheck`, `pause` / `resume`, `session_end` (with time used).

### D4.6 Technical architecture

| | |
|---|---|
| **Stack** | Static HTML + CSS + vanilla JavaScript. No framework, no build step, no backend. |
| **Files** | `index.html`, `styles.css`, `app.js` (screens, adaptivity, logging), `data.js` (word bank, variants, feedback text), `DESIGN.md`, `README.md`, `LICENSE` |
| **Size** | Target < 100 KB total; no images or video (emoji are used for pictures). Works offline after the first load, except speech recognition. |
| **Storage** | `localStorage`: `et617_23b2509_profile`, `et617_23b2509_session`, `et617_23b2509_log` |
| **Hosting** | Vercel, static deployment from GitHub: `et617-23b2509.vercel.app` |
| **Browser** | Chrome for Android (speech recognition needs Chrome or Edge; everything else works in any modern browser) |

---

## D5. Two contrasting learner scenarios

Both scenarios are run on the live app. Screenshots are stored in `screenshots/`.

### Scenario A — Learner who responds correctly ("Aman", Class 6)

| Step | Learner does | System responds | Screenshot |
|---|---|---|---|
| A1 | Enters name "Aman", taps शुरू करो | Greeting; 10-minute plan | `screenshots/a1-welcome.png` |
| A2 | Diagnostic: picks शाम, सड़क, पढ़ना (3/3) | No sound is recommended | `screenshots/a2-diagnostic.png` |
| A3 | Choose sounds: no ⭐ cards; selects श/स anyway | Block starts at **Level 2** (diagnostic was correct); "⏱ लगभग 6 मिनट" | `screenshots/a3-choose.png` |
| A4 | S1–S3 correct on the first try (says "शाम" clearly in S3) | "शाबाश, अमन! 🎉"; confidence rises; after 3 correct in a row → **Level 3** (harder words: आकाश, रोशनी) | `screenshots/a4-correct-feedback.png` |
| A5 | Finishes the block and the mid-check (2/2) | Mid-check passed | `screenshots/a5-midcheck.png` |
| A6 | Summary | Score 100%, श/स mastery 100% "सीख लिया ✓", streak 🔥1 | `screenshots/a6-summary.png` |

### Scenario B — Learner showing misconception M1 ("Ravi")

| Step | Learner does | System responds (differently from A) | Screenshot |
|---|---|---|---|
| B1 | Diagnostic: picks **साम**, सड़क, पढ़ना | श/स flagged | `screenshots/b1-diagnostic.png` |
| B2 | Choose sounds | **श/स pre-selected with "⭐ सुझाया गया"**; block starts at **Level 1** | `screenshots/b2-choose-recommended.png` |
| B3 | S2 FILL **_हर**: taps **स** | Classified **M1**: "तुम्हारा बोलना बिल्कुल ठीक है! 😊 पर लिखते समय यहाँ **श** लगता है…" → retry, then correct | `screenshots/b3-m1-feedback.png` |
| B4 | S3 SPEAK **शाम**: says "**साम**" | **Accepted as a dialect variant**: "'साम' — यह तुम्हारे इलाके का उच्चारण है, बिल्कुल ठीक है।" (**variation example**) | `screenshots/b4-speech-variant.png` |
| B5 | S5 SPELL **शेर**: builds **सेर** | Second M1 error → **remediation triggered**: Mitthu's mini-lesson + 2 easy items (🔊 शाम/साम, _ेर) inserted; level stays 1 (**error example**) | `screenshots/b5-remediation.png` |
| B6 | S7 WHY: picks (c) "श और स एक ही हैं" | M1 conceptual feedback; correct reason shown | `screenshots/b6-why-feedback.png` |
| B7 | Summary | Score lower; श/स mastery 50%; "कल फिर अभ्यास करेंगे: शहर, शेर"; streak 🔥1; confidence meter shown | `screenshots/b7-summary.png` |

**How the system responds differently:** different recommendation on S3, different starting level, misconception-specific feedback instead of praise, an inserted remediation mini-lesson and extra items, a different summary, and a review list for the next session.

---

## D6. AI functionality specification

The app uses two NLP capabilities. Neither calls a paid API or a large language model; this keeps it free, fast on a slow connection, and predictable for children (see §D6.4).

### D6.1 Speech recognition (ASR) for the SPEAK task

| | |
|---|---|
| **What the AI does** | Converts the learner's spoken word into Hindi text so the app can check whether the right word was read. **It is never used to mark pronunciation as wrong.** |
| **Model** | The browser's Web Speech API (`webkitSpeechRecognition`). In Chrome this sends the audio to Google's cloud speech service. |
| **Input** | Microphone audio of one word, plus this configuration: |

```js
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
const rec = new Rec();
rec.lang = 'hi-IN';          // Hindi (India)
rec.interimResults = false;  // final result only
rec.maxAlternatives = 5;     // ask for up to 5 guesses
rec.onresult = (e) => {
  const alts = Array.from(e.results[0]).map(a => ({ text: a.transcript, conf: a.confidence }));
  judgeSpeech(item, alts);   // check (below)
};
rec.onerror = (e) => speechFallback(e.error);  // 'not-allowed', 'no-speech', 'network', ...
rec.start();
```

| | |
|---|---|
| **Output** | Up to 5 transcript alternatives with confidence values, e.g. `[{text:"साम",conf:0.81},{text:"शाम",conf:0.62}]` |
| **Check before the learner sees anything** | 1. **Normalise** each alternative: Unicode NFC (so ड़ typed as one code point U+095C or as ड + nukta U+093C compares equal), trim, remove punctuation and spaces.<br>2. If any alternative equals the **standard word** → "standard" feedback.<br>3. Else if any alternative is in that word's **accepted-variant list** (table below) → "dialect variant accepted" feedback.<br>4. Else if the best alternative is within edit distance 1 of the standard word → "almost, say it again".<br>5. Else → "आवाज़ साफ़ नहीं आई, फिर से बोलो". **The learner is never shown "wrong" for speech.** |
| **Fallback when it fails** | • Browser has no speech support → the SPEAK task is shown as "✍️ लिखकर करो" (type/tiles) from the start.<br>• Mic permission denied (`not-allowed`) or `network` error → same switch, with the message "माइक नहीं चला — कोई बात नहीं, लिखकर करते हैं।"<br>• 2 unclear attempts → offer "लिखकर करो" or "छोड़ो" (skip). Skipping is not counted as an error.<br>• All fallbacks are logged (`speech_fallback`). |
| **Known limitation** | The ASR's language model favours standard spellings, so it may turn Ravi's "साम" into "शाम". That is harmless here because both are accepted. This is exactly why speech is used only to confirm that the word was read, never to judge accent. |

**Accepted Bhojpuri-influenced pronunciation variants (speech only):**

| Standard | Accepted spoken variants |
|---|---|
| शाम | साम |
| शहर | सहर |
| देश | देस |
| शेर | सेर |
| सड़क | सरक, सडक |
| पेड़ | पेर, पेड |
| लड़का | लरका, लडका |
| घोड़ा | घोरा, घोडा |
| पढ़ना | पढना, परहना |

### D6.2 Spelling-error classifier (rule-based NLP) for FILL, SPELL and FIND

| | |
|---|---|
| **What it does** | Compares the learner's written answer with the target word and labels **what kind** of error it is, so the feedback can address the specific misconception. |
| **Input** | `target` (e.g. "शाम") and `response` (e.g. "साम"), both Unicode strings |
| **Output** | One label: `CORRECT`, `M1` (स for श), `OVER` (श for स), `M2_D` (ड for ड़), `M2_R` (र for ड़), `M2_DH` (ढ/र for ढ़), `POS` (ड़/ढ़ at word start), `OTHER` |

```js
const N = s => s.normalize('NFC').replace(/[\s।,.!?]/g, '');
const RULES = [ // [target char, wrong char, label]
  ['श','स','M1'], ['स','श','OVER'],
  ['ड़','ड','M2_D'], ['ड़','र','M2_R'],
  ['ढ़','ढ','M2_DH'], ['ढ़','र','M2_DH']
];
function classify(target, response) {
  const t = [...N(target)], r = [...N(response)];
  if (t.join('') === r.join('')) return 'CORRECT';
  if (/^(ड़|ढ़)/.test(N(response))) return 'POS';
  // align after NFC: ड़ = 'ड'+'़' so drop the nukta to compare letter positions
  ...  // find positions where t and r differ; if every difference matches one RULE → that label
  return 'OTHER';
}
```

| | |
|---|---|
| **Check** | Deterministic: the same answer always gets the same label. Before release, the classifier is run on every word in the bank with its common misspellings (e.g. शाम→साम = M1, सब→शब = OVER, सड़क→सडक = M2_D, सड़क→सरक = M2_R, डर→ड़र = POS, शाम→शम = OTHER). All must return the expected label. |
| **Fallback** | `OTHER` gets neutral feedback that shows the correct word with the target letter highlighted, and the item is re-queued. All `OTHER` cases are logged, so a teacher can review them and new rules can be added. |

### D6.3 Text-to-speech (supporting feature)

`speechSynthesis` with a `hi-IN` voice reads words for the 🔊 button. **Fallback:** if the device has no Hindi voice, the 🔊 button is hidden and a written meaning hint (emoji + short Hindi clue) is shown instead.

### D6.4 Why no large language model

- **Low bandwidth:** no API calls per answer; the app works offline after loading (except ASR).
- **Safety and predictability:** a child sees only feedback text that has been written and checked in advance (§D3.5); nothing generated can be wrong or unkind.
- **Cost:** free to run for any number of learners.
- **Future extension (§D8.5):** an LLM could generate new practice sentences for each word, but only after a validator confirms each sentence contains the target word spelled correctly and uses vocabulary from a Class 3–6 word list.

---

## D7. Pedagogical rationale

### D7.1 How the design supports learning (ADDIE + theory)

| ADDIE phase | What was done |
|---|---|
| **Analysis** | Learner (L8, persona Ravi), problem (L1 transfer in spelling), constraints (shared phone, 10 minutes, patchy data) — §D1, §D2 |
| **Design** | Outcomes at Bloom levels; one contrast per block; task sequence recognise → recall → produce → analyse → explain; feedback per misconception — §D3 |
| **Development** | Static web app, NLP checks, clickstream logger — §D4, §D6 |
| **Implementation** | Deployed on Vercel; two scenarios run on the live app — §D5 |
| **Evaluation** | Pre/post dictation, log analysis, success criteria — §D8 |

### D7.2 Design principles ("We will … because …")

1. **We will accept Bhojpuri pronunciation in speaking tasks** because marking a child's home language as wrong raises anxiety and blocks learning (**Affective Filter Hypothesis**), and because L8 learners need their home language respected.
2. **We will teach one sound contrast per block (श/स, then ड़)** because working memory holds only about 7 ± 2 items and Ravi reads slowly (**Cognitive Load Theory**).
3. **We will colour and enlarge the target letter in every word** because the first step to memory is attention (**Atkinson–Shiffrin model**, sensory → working memory).
4. **We will link each word to something Ravi knows (🌆 शाम = when you come home from playing) and give a memory sentence** because encoding is stronger when new information connects to existing knowledge (**encoding → storage → retrieval**).
5. **We will order tasks from recognition (MCQ) to recall (FILL) to production (SPELL/SPEAK) to explanation (WHY)** because support should be withdrawn gradually as competence grows (**Vygotsky's ZPD / scaffolding**, **Revised Bloom's Taxonomy**).
6. **We will give feedback that names the specific misconception and allows one retry** because a generic "wrong" doesn't tell the learner what to change, and the persona gives up when corrected harshly.
7. **We will save progress after every answer and show a countdown** because Ravi's father may take the phone back at any moment (**persona + C4**).
8. **We will show a confidence meter (आत्मविश्वास) and a streak, not only a score** because Ravi is motivated by visible progress and small wins (**persona motivation driver**).
9. **We will keep the app under 100 KB with no images or video** because the family shares a small prepaid data pack (**context of use**).
10. **We will let the learner choose sounds as well as taking a diagnostic** because self-selection gives the learner control, which lowers anxiety, and also tells us whether learners judge their own weak areas accurately (**learner agency, D8 data**).

### D7.3 Answer to P2's design challenge: error vs. acceptable variation

**Decision rule:**

> The app separates **the channel** (speech vs. writing) from **the standard**.
> • **In speech**, a response is accepted if it matches the standard word **or** a known regional pronunciation variant of it (§D6.1 table). Pronunciation is treated as identity, not error.
> • **In writing**, only the standard spelling is accepted, because written Hindi has one agreed spelling that school exams use. Known Bhojpuri-pattern substitutions are classified as M1 / M2 and get explanatory feedback; anything else is a general error.

| | Example in the app | App response |
|---|---|---|
| **Acceptable variation** | Ravi **says** "साम" for शाम in the SPEAK task (S3) | ✅ Counted correct: "'साम' — यह तुम्हारे इलाके का उच्चारण है, बिल्कुल ठीक है। बस लिखते समय याद रखना: **श**ाम।" |
| **Language error** | Ravi **writes** "सेर" for शेर in the SPELL task (S5) | ❌ Classified M1: "तुम्हारा बोलना बिल्कुल ठीक है! पर लिखते समय यहाँ **श** लगता है…", retry, remediation after 2 such errors |

The same feedback also teaches the rule itself ("बोलना और लिखना अलग हो सकते हैं"), so the learner understands *why* one is fine and the other is not.

### D7.4 Feedback and scaffolding

- **Immediate, specific feedback** after every answer, in the error type's own words (§D3.5).
- **Hints (💡 इशारा):** level 1 highlights the confusable letter's position; level 2 removes one wrong option. The hint button pulses after 20 s of no input.
- **Retry once, then show and re-queue** (spaced repetition within the session).
- **Remediation mini-lesson** after 2 errors of the same type.
- **Mid-check** after the first block (a lesson from the Waterfall group's case: check learning mid-way, not only at the end).

### D7.5 Adaptivity rules (rubric P13)

| Source | Rule |
|---|---|
| **Profile (diagnostic + self-selection)** | A sound answered wrong in the diagnostic is recommended (⭐). Learner can add or remove blocks. A block whose diagnostic item was correct starts at **Level 2**; otherwise **Level 1**. |
| **Performance** | 3 correct first attempts in a row → level +1 (max 3, harder words). 2 errors of the same misconception within the last 3 items → remediation mini-lesson + 2 easy items, level −1 (min 1). Mid-check < 2/2 → 2 remediation items before the next block. |
| **Interaction** | ≥ 2 hints in the last 3 items → hold level and insert a FILL scaffold before the next SPELL. Latency > 20 s → hint button pulses. Speech failed twice → switch that learner's SPEAK tasks to tiles for the rest of the session. |
| **Time (C4)** | 3 blocks chosen → 4 tasks per block. At 9:30 → finish the current task and go to the summary. |

**Mastery** per sound = % correct first attempts over the last 5 graded items. ≥ 80% → "सीख लिया ✓".
**Confidence meter:** starts at 50; +8 correct first try, +4 correct after retry or hint, −3 wrong; kept between 0 and 100. It falls gently so it doesn't punish an anxious learner.
**Streak:** consecutive calendar days with at least one completed task.

### D7.6 How C4 and the learner context (L8) shaped the design

- **C4** led to the fixed, short sequence; the countdown; save-after-every-answer and resume; fewer tasks per block when more blocks are chosen; and the mid-session check instead of a long final test.
- **L8** led to the speech/writing split (the design challenge answer), feedback that begins "तुम्हारा बोलना बिल्कुल ठीक है", the WHY item that corrects "my home language is wrong", the Bhojpuri variant table, and Hindi as the interface language (with an English toggle for teachers and evaluators).
- **The shared phone and data pack** led to a < 100 KB static app with no media, emoji instead of pictures, a profile without a password, and large touch targets for a 360 px screen.

### D7.7 Build process

The app was built with a **Lean / Kanban** approach suited to a solo, time-boxed build: a working thin slice first (one block, three formats, deployed), then features pulled from a single prioritised list (adaptivity, logging, profile, remaining blocks). Each change was deployed and checked on a phone-width screen before the next item.

---

## D8. Evaluation plan

### D8.1 Assessment items per outcome

**Pre-test and post-test** (paper or in-app, same format, different word order). The post-test is given after 4 sessions.

| Outcome | Items | Scoring |
|---|---|---|
| **LO1 Distinguish** | 10 MCQ items: 5 श/स (शाम/साम, शहर/सहर, सब/शब, देश/देस, सात/शात) and 5 ड़ (सड़क/सरक, पेड़/पेड, डर/ड़र, घोड़ा/घोरा, ठंडा/ठंड़ा) | 1 mark each |
| **LO2 Spell** | 10-word dictation (teacher reads aloud): 6 practised words (शाम, शहर, शेर, सड़क, पेड़, लड़का) + **4 unseen** (शरबत, दशहरा, कपड़ा, गाड़ी) + **3 control words with स** (सपना, सोना, बस) to detect over-correction | 1 mark per correct word; over-correction counted separately |
| **LO3 Explain / Predict** | (a) Oral question: "तुम 'साम' बोलते हो, फिर 'शाम' क्यों लिखते हो?" (b) Predict: "इन नए शब्दों में ड या ड़? — _ाकिया (postman), बा_ (fence), ठं_ (cold)" | Rubric below |

**LO3 rubric (0–2):**
| Score | Description |
|---|---|
| 0 | No reason, or says the home language is wrong |
| 1 | Says the book spelling is different, but cannot say when to use ड़ |
| 2 | Says speaking and writing can differ **and** states or correctly applies the position rule (ड़ is not at the start) |

### D8.2 Log data collected (from the clickstream, §D4.5)

- Per item: response, error label, attempt number, latency, hints used, level
- Per sound: mastery trajectory across sessions; M1 / M2 / OVER counts per session
- Diagnostic result vs. sounds the learner chose (did self-selection match the diagnostic?)
- Remediation triggers and whether the next items after remediation were correct
- Speech: number of attempts, how often a dialect variant was accepted, fallback rate and reason
- Session: time used, completed vs. stopped early, number of resumes, streak length

### D8.3 What counts as success

| Measure | Success threshold |
|---|---|
| LO1 post-test | ≥ 8 / 10 for at least 70% of learners |
| LO2 post-test | ≥ 8 / 10, **including ≥ 3 of the 4 unseen words** (shows transfer, not memorisation) |
| LO3 rubric | Score 2 for at least 60% of learners |
| M1 + M2 errors in logs | Fall by ≥ 50% from session 1 to session 4 |
| Over-correction | ≤ 1 control word wrong on the post-test (learners don't swap every स to श) |
| C4 fit | ≥ 80% of sessions end within 10 minutes with the sequence completed; resumed sessions finish successfully |
| Affective | Confidence meter rises across sessions; a 3-item smiley survey ("I feel okay about how I speak") does not fall |

### D8.4 Study design

A small pilot with 8–10 Class 6 learners from a Bhojpuri-speaking area: pre-test → 4 sessions over one week (10 min each, at home or school) → post-test → short interview with 3 learners and their Hindi teacher. Log JSON is exported from each device (S10).

### D8.5 Next iteration (Design-Based Research loop)

Findings feed back into the next design cycle: add rules for new error patterns seen in `OTHER` logs; tune the variant table with real recordings; add a teacher view to review flagged answers; optional cloud sync so progress survives a change of phone; validated LLM-generated practice sentences (§D6.4).

---

## Limitations

- Speech recognition needs internet and works best in Chrome; its output may normalise dialect pronunciations to standard spelling (harmless here, since both are accepted).
- The variant table covers the patterns in T10 only; Bhojpuri speech varies across districts.
- Progress is stored on one device; clearing browser data or changing phones resets it.
- The design has not yet been tested with real learners; §D8 describes how it will be.

## References

- Anderson, L. W., & Krathwohl, D. R. (2001). *A Taxonomy for Learning, Teaching, and Assessing* (Revised Bloom's Taxonomy).
- Atkinson, R. C., & Shiffrin, R. M. (1968). Human memory: A proposed system and its control processes.
- Krashen, S. (1982). *Principles and Practice in Second Language Acquisition* (Affective Filter Hypothesis).
- Lado, R. (1957). *Linguistics Across Cultures* (Contrastive Analysis).
- Sweller, J. (1988). Cognitive load during problem solving: Effects on learning.
- Vygotsky, L. S. (1978). *Mind in Society* (Zone of Proximal Development).
- ET 617 class slides (2026): Bloom's taxonomy, memory model, CLT, ADDIE, DBR, persona-driven design, software development models.

---

*© 2026 23B2509. Licensed under CC BY 4.0.*
