/* Bhojpurify · ET617 · 23B2509
 * Content: sound cards, blocks, concept text, task bank, speech variants, feedback library.
 * All learner-facing text is Hindi first, with an English gloss (shown with the EN toggle).
 * See DESIGN.md §D3 and §D6.
 */
'use strict';

const APP_ID = '23B2509';
const STORE_PREFIX = 'et617_23b2509_';

/* Sound cards on the "choose" screen (S3). Cards rd + rr share one ड़ block. */
const CARDS = [
  { id: 'sh', block: 'sh', title: 'श / स', ex: ['शाम', 'साम'], hi: 'शाम या साम?', en: 'sh vs s' },
  { id: 'rd', block: 'rr', title: 'ड़ / ड', ex: ['सड़क', 'सडक'], hi: 'सड़क या सडक?', en: 'ṛ (dot) vs ḍ' },
  { id: 'rr', block: 'rr', title: 'ड़ / र', ex: ['पेड़', 'पेर'], hi: 'पेड़ या पेर?', en: 'ṛ (dot) vs r' },
  { id: 'dh', block: 'dh', title: 'ढ़ / ढ', ex: ['पढ़ना', 'पढना'], hi: 'पढ़ना या पढना?', en: 'ṛh vs ḍh', bonus: true }
];
const LOCKED_CARD = { title: 'ष', hi: 'जल्द आ रहा है', en: 'Coming soon' };

/* Diagnostic (S2): 3 items, no feedback shown. */
const DIAG = [
  { id: 'DG1', block: 'sh', clue: '🌆', q: '___ को हम खेलकर घर आते हैं।', en: 'In the ___ (evening) we come home after playing.', word: 'शाम', opts: ['शाम', 'साम'] },
  { id: 'DG2', block: 'rr', clue: '🛣️', q: '___ पर गाड़ियाँ चलती हैं।', en: 'Vehicles run on the ___ (road).', word: 'सड़क', opts: ['सड़क', 'सडक', 'सरक'] },
  { id: 'DG3', block: 'dh', clue: '📖', q: 'मुझे किताब ___ अच्छा लगता है।', en: 'I like ___ (reading) books.', word: 'पढ़ना', opts: ['पढ़ना', 'पढना'] }
];

/* Blocks: one sound contrast each (Cognitive Load Theory). */
const BLOCKS = {
  sh: {
    id: 'sh', title: 'श / स', titleEn: 'sh / s', hl: 'श', main: 'M1', letters: ['श', 'स', 'ष'],
    concept: [
      { hi: 'घर पर हम <b>"साम"</b> बोलते हैं — यह हमारी भोजपुरी का तरीका है, और यह बिल्कुल ठीक है। 😊', en: 'At home we say "साम". That is our Bhojpuri way, and it is completely fine.' },
      { hi: 'पर किताब वाली हिंदी में यह शब्द <b>श</b> से लिखा जाता है: <span class="hl">श</span>ाम।', en: 'But in book Hindi this word is written with श: शाम.' },
      { hi: '<b>पहली बात:</b> बोलना और लिखना अलग हो सकते हैं।', en: 'First: speaking and writing can be different.' },
      { hi: '<b>दूसरी बात:</b> कुछ शब्दों में <b>श</b> आता है — <span class="hl">श</span>ाम, <span class="hl">श</span>हर, दे<span class="hl">श</span>, <span class="hl">श</span>ेर।', en: 'Second: some words have श: शाम, शहर, देश, शेर.' },
      { hi: '<b>तीसरी बात:</b> कुछ शब्दों में <b>स</b> ही रहता है — <span class="hl">स</span>ब, <span class="hl">स</span>ात, <span class="hl">स</span>मय। हर स को श मत बनाना!', en: 'Third: some words keep स: सब, सात, समय. Do not turn every स into श!' },
      { hi: '🧠 <b>याद रखने की तरकीब:</b> "<span class="hl">श</span>ाम को <span class="hl">श</span>ेर <span class="hl">श</span>हर आया।"', en: 'Memory trick: "In the evening the lion came to the city."' }
    ],
    remedLines: [
      { hi: 'ध्यान से देखो: <span class="hl">श</span>ाम और <span class="hl">स</span>ब — दोनों अलग अक्षर हैं।', en: 'Look carefully: शाम and सब use two different letters.' },
      { hi: 'बोलने में "साम" ठीक है। <b>लिखने</b> में हमेशा <span class="hl">श</span>ाम।', en: 'Saying "साम" is fine. In writing it is always शाम.' }
    ],
    pairs: ['शाम', 'साम', 'शहर', 'सब', 'शेर', 'देश'],
    hint: { hi: 'याद करो: "<b>श</b>ाम को <b>श</b>ेर <b>श</b>हर आया।" इन शब्दों में श आता है।', en: 'Remember: "शाम को शेर शहर आया" — these words have श.' },
    items: [
      { id: 'S1', f: 'MCQ', clue: '🌆', q: 'सूरज डूबने का समय कौन-सा है?', en: 'Which word is the time when the sun sets (evening)?', word: 'शाम', opts: ['शाम', 'साम'] },
      { id: 'S2', f: 'FILL', clue: '🏙️', q: 'बड़ी जगह, जहाँ बहुत लोग रहते हैं', en: 'A big place where many people live (city)', word: 'शहर' },
      { id: 'S3', f: 'SPEAK', clue: '🌆', q: 'यह शब्द ज़ोर से बोलो', en: 'Say this word aloud', word: 'शाम', variants: ['साम'], cluetext: 'सूरज डूबने का समय' },
      { id: 'S4', f: 'MCQ', clue: '👨‍👩‍👧', q: '___ लोग आ गए। कौन-सा शब्द <b>स</b> से ही लिखा जाता है?', en: '___ (all) people came. Which word is written with स?', word: 'सब', opts: ['सब', 'शब'], hl: 'स', hint: { hi: 'हर स को श मत बनाना! <b>स</b>ब, <b>स</b>ात, <b>स</b>मय में स ही है।', en: 'Do not turn every स into श! सब, सात, समय keep स.' } },
      { id: 'S5', f: 'SPELL', clue: '🦁', q: 'जंगल का राजा — टुकड़े जोड़कर लिखो', en: 'King of the jungle — join the pieces to write it', word: 'शेर' },
      { id: 'S6', f: 'FIND', q: 'ग़लत लिखे शब्द पर टैप करो', en: 'Tap the wrongly spelled word', sentence: 'शाम को हम सहर गए।', wrongIdx: 3, word: 'शहर' },
      { id: 'S7', f: 'WHY', q: 'हम "साम" बोलते हैं, पर "शाम" क्यों लिखते हैं?', en: 'We say "साम", so why do we write "शाम"?', word: 'शाम',
        opts: [
          { hi: 'किताब की हिंदी में इस शब्द की सही वर्तनी श से है — बोलना अलग हो सकता है', en: 'In book Hindi this word is spelled with श; speaking can be different', ok: true },
          { hi: '"साम" बोलना ग़लत है, घर की भाषा ग़लत है', en: 'Saying "साम" is wrong; my home language is wrong', label: 'HOME' },
          { hi: 'श और स एक ही हैं, कोई भी लिख दो', en: 'श and स are the same, write either one', label: 'M1' }
        ],
        okFb: { hi: 'बिल्कुल सही! 🎉 बोलना और लिखना अलग हो सकते हैं। किताब में <span class="hl">श</span>ाम।', en: 'Exactly! Speaking and writing can differ. In books: शाम.' } }
    ],
    hard: [
      { id: 'SH1', f: 'FILL', clue: '🇮🇳', q: 'भारत हमारा ___ है', en: 'India is our ___ (country)', word: 'देश' },
      { id: 'SH2', f: 'SPELL', clue: '🌌', q: 'ऊपर नीला-नीला ___ — टुकड़े जोड़कर लिखो', en: 'The blue ___ (sky) above', word: 'आकाश' },
      { id: 'SH3', f: 'FILL', clue: '💡', q: 'बल्ब से ___ आती है', en: 'Light comes from the bulb', word: 'रोशनी' },
      { id: 'SH4', f: 'SPELL', clue: '💍', q: 'दीदी की ___ है — टुकड़े जोड़कर लिखो', en: "It's my sister's ___ (wedding)", word: 'शादी' }
    ],
    remed: [
      { id: 'SR1', f: 'MCQ', listen: true, clue: '🔊', q: 'सुनो, फिर सही लिखा शब्द चुनो', en: 'Listen, then choose the correctly written word', word: 'शाम', opts: ['शाम', 'साम'] },
      { id: 'SR2', f: 'FILL', clue: '🦁', q: 'जंगल का राजा', en: 'King of the jungle', word: 'शेर' }
    ],
    mid: [
      { id: 'SM1', f: 'MCQ', clue: '🥤', q: 'गर्मी में मीठा, ठंडा ___', en: 'A sweet cold drink in summer (sherbet)', word: 'शरबत', opts: ['शरबत', 'सरबत'] },
      { id: 'SM2', f: 'FILL', clue: '🐅', q: 'बाघ ___ करता है', en: 'The tiger goes hunting', word: 'शिकार' }
    ]
  },

  rr: {
    id: 'rr', title: 'ड़', titleEn: 'ṛ (dotted)', hl: 'ड़', main: 'M2_D', letters: ['ड', 'ड़', 'र'],
    concept: [
      { hi: 'देखो, <span class="hl">ड़</span> के नीचे एक छोटी-सी <b>बिंदी</b> होती है! 👀', en: 'Look, ड़ has a small dot below it!' },
      { hi: '<b>पहली बात:</b> ड़ कभी शब्द के <b>शुरू में नहीं</b> आता। शुरू में हमेशा <b>ड</b>: <span class="hl">ड</span>र, <span class="hl">ड</span>ाल, <span class="hl">ड</span>िब्बा।', en: 'First: ड़ never begins a word. At the start it is always ड: डर, डाल, डिब्बा.' },
      { hi: '<b>दूसरी बात:</b> शब्द के <b>बीच में या आखिर में</b> अक्सर <b>ड़</b>: स<span class="hl">ड़</span>क, पे<span class="hl">ड़</span>, ल<span class="hl">ड़</span>का।', en: 'Second: in the middle or at the end it is often ड़: सड़क, पेड़, लड़का.' },
      { hi: '<b>तीसरी बात:</b> अगर ड से पहले <b>ं</b> (बिंदु) हो, तो ड ही रहता है: अं<span class="hl">ड</span>ा, ठं<span class="hl">ड</span>ा।', en: 'Third: after the nasal sign ं it stays ड: अंडा, ठंडा.' },
      { hi: '<b>चौथी बात:</b> घर पर हम "पेर" या "सरक" बोल सकते हैं — कोई बात नहीं! पर लिखते हैं पे<span class="hl">ड़</span>, स<span class="hl">ड़</span>क।', en: 'Fourth: at home we may say "पेर" or "सरक" — fine! But we write पेड़, सड़क.' }
    ],
    remedLines: [
      { hi: 'बिंदी देखो: <span class="hl">ड</span> (डर) और <span class="hl">ड़</span> (सड़क)।', en: 'Look at the dot: ड (डर) and ड़ (सड़क).' },
      { hi: 'शब्द के बीच या आखिर में आए तो अक्सर <b>ड़</b> — पे<span class="hl">ड़</span>, घो<span class="hl">ड़</span>ा।', en: 'In the middle or at the end it is usually ड़: पेड़, घोड़ा.' }
    ],
    pairs: ['सड़क', 'सरक', 'पेड़', 'पेर', 'डर', 'ठंडा'],
    hint: { hi: 'ड़ शब्द के शुरू में नहीं आता — बीच या आखिर में आता है। नीचे <b>बिंदी</b> देखो!', en: 'ड़ never starts a word; it comes in the middle or at the end. Look for the dot!' },
    items: [
      { id: 'R1', f: 'MCQ', clue: '🛣️', q: 'जिस पर गाड़ियाँ चलती हैं', en: 'Where vehicles run (road)', word: 'सड़क', opts: ['सड़क', 'सडक', 'सरक'] },
      { id: 'R2', f: 'FILL', clue: '🌳', q: 'हरा-भरा, फल देने वाला', en: 'Green, gives fruit (tree)', word: 'पेड़' },
      { id: 'R3', f: 'SPEAK', clue: '🛣️', q: 'यह शब्द ज़ोर से बोलो', en: 'Say this word aloud', word: 'सड़क', variants: ['सरक', 'सडक'], cluetext: 'गाड़ियाँ इस पर चलती हैं' },
      { id: 'R4', f: 'MCQ', clue: '😨', q: 'मुझे अँधेरे से ___ लगता है। किस शब्द का शुरू सही है?', en: 'I am ___ (afraid) of the dark. Which word starts correctly?', word: 'डर', opts: ['डर', 'ड़र'], hl: 'ड', hint: { hi: 'ड़ शब्द के <b>शुरू में कभी नहीं</b> आता।', en: 'ड़ never comes at the start of a word.' } },
      { id: 'R5', f: 'SPELL', clue: '👦', q: 'छोटा ___ स्कूल जाता है — टुकड़े जोड़कर लिखो', en: 'The little ___ (boy) goes to school', word: 'लड़का' },
      { id: 'R6', f: 'FIND', q: 'ग़लत लिखे शब्द पर टैप करो', en: 'Tap the wrongly spelled word', sentence: 'मेरा घोरा तेज़ दौड़ता है।', wrongIdx: 1, word: 'घोड़ा' },
      { id: 'R7', f: 'WHY', q: '"पेड़" में ड़ क्यों, पर "डर" में ड क्यों?', en: 'Why ड़ in "पेड़" but ड in "डर"?', word: 'पेड़',
        opts: [
          { hi: 'ड़ शब्द के शुरू में नहीं आता; डर में ड शुरू में है', en: 'ड़ never starts a word; in डर the ड is at the start', ok: true },
          { hi: 'दोनों एक ही हैं, कोई भी लिख दो', en: 'They are the same, write either', label: 'M2_D' },
          { hi: 'जो सुंदर लगे वह लिख दो', en: 'Write whichever looks nicer', label: 'RANDOM' }
        ],
        okFb: { hi: 'बिल्कुल सही! 🎉 ड़ शब्द के शुरू में कभी नहीं आता।', en: 'Exactly! ड़ never begins a word.' } }
    ],
    hard: [
      { id: 'RH1', f: 'FILL', clue: '⛰️', q: 'ऊँचा-ऊँचा ___', en: 'A tall mountain', word: 'पहाड़' },
      { id: 'RH2', f: 'SPELL', clue: '🤲', q: 'गेंद को ___ — टुकड़े जोड़कर लिखो', en: '___ (catch) the ball', word: 'पकड़ना' },
      { id: 'RH3', f: 'FILL', clue: '🧊', q: 'बर्फ़ ___ होती है', en: 'Ice is cold (note: after ं it stays ड)', word: 'ठंडा', blank: 'ड' },
      { id: 'RH4', f: 'SPELL', clue: '👕', q: 'पहनने के लिए ___ — टुकड़े जोड़कर लिखो', en: 'Something to wear (cloth)', word: 'कपड़ा' }
    ],
    remed: [
      { id: 'RR1', f: 'MCQ', listen: true, clue: '🔊', q: 'सुनो, फिर सही लिखा शब्द चुनो', en: 'Listen, then choose the correctly written word', word: 'पेड़', opts: ['पेड़', 'पेर', 'पेड'] },
      { id: 'RR2', f: 'FILL', clue: '🐘', q: 'हाथी बहुत ___ होता है', en: 'An elephant is very big', word: 'बड़ा' }
    ],
    mid: [
      { id: 'RM1', f: 'MCQ', clue: '🚗', q: 'पापा की नई ___', en: "Papa's new ___ (car)", word: 'गाड़ी', opts: ['गाड़ी', 'गाडी', 'गारी'] },
      { id: 'RM2', f: 'FILL', clue: '🤏', q: 'बस ___ सा दो', en: 'Give just a little', word: 'थोड़ा' }
    ]
  },

  dh: {
    id: 'dh', title: 'ढ़ / ढ', titleEn: 'ṛh / ḍh', hl: 'ढ़', main: 'M2_DH', letters: ['ढ', 'ढ़', 'र'],
    concept: [
      { hi: '<span class="hl">ढ़</span> भी ड़ जैसा है — नीचे <b>बिंदी</b>! 👀', en: 'ढ़ works like ड़ — it has a dot below!' },
      { hi: '<b>पहली बात:</b> शुरू में हमेशा <b>ढ</b>: <span class="hl">ढ</span>ोल, <span class="hl">ढ</span>क्कन।', en: 'First: at the start it is always ढ: ढोल, ढक्कन.' },
      { hi: '<b>दूसरी बात:</b> बीच या आखिर में अक्सर <b>ढ़</b>: प<span class="hl">ढ़</span>ना, सी<span class="hl">ढ़</span>ी, बू<span class="hl">ढ़</span>ा।', en: 'Second: in the middle or end it is often ढ़: पढ़ना, सीढ़ी, बूढ़ा.' },
      { hi: '<b>तीसरी बात:</b> "पढना" या "परहना" बोलना ठीक है, पर लिखते हैं प<span class="hl">ढ़</span>ना।', en: 'Third: saying "पढना" or "परहना" is fine, but we write पढ़ना.' }
    ],
    remedLines: [
      { hi: 'बिंदी देखो: <span class="hl">ढ</span>ोल (शुरू में) और प<span class="hl">ढ़</span>ना (बीच में)।', en: 'Look at the dot: ढोल (start) and पढ़ना (middle).' }
    ],
    pairs: ['पढ़ना', 'पढना', 'सीढ़ी', 'ढोल'],
    hint: { hi: 'ढ़ शब्द के शुरू में नहीं आता — बीच या आखिर में आता है। <b>बिंदी</b> देखो!', en: 'ढ़ never starts a word. Look for the dot!' },
    items: [
      { id: 'D1', f: 'MCQ', clue: '📖', q: 'मुझे किताब ___ अच्छा लगता है', en: 'I like ___ (reading) books', word: 'पढ़ना', opts: ['पढ़ना', 'पढना'] },
      { id: 'D2', f: 'FILL', clue: '🪜', q: 'ऊपर चढ़ने के लिए', en: 'Used to climb up (ladder / stairs)', word: 'सीढ़ी' },
      { id: 'D3', f: 'SPEAK', clue: '📖', q: 'यह शब्द ज़ोर से बोलो', en: 'Say this word aloud', word: 'पढ़ना', variants: ['पढना', 'परहना'], cluetext: 'किताब ___' },
      { id: 'D4', f: 'MCQ', clue: '🥁', q: 'शादी में बजने वाला बाजा', en: 'The drum played at weddings', word: 'ढोल', opts: ['ढोल', 'ढ़ोल'], hl: 'ढ' },
      { id: 'D5', f: 'SPELL', clue: '👴', q: 'दादाजी ___ हैं — टुकड़े जोड़कर लिखो', en: 'Grandpa is ___ (old)', word: 'बूढ़ा' },
      { id: 'D6', f: 'FIND', q: 'ग़लत लिखे शब्द पर टैप करो', en: 'Tap the wrongly spelled word', sentence: 'मैं रोज़ पढता हूँ।', wrongIdx: 2, word: 'पढ़ता' },
      { id: 'D7', f: 'WHY', q: '"ढोल" में ढ, पर "पढ़ना" में ढ़ क्यों?', en: 'Why ढ in "ढोल" but ढ़ in "पढ़ना"?', word: 'पढ़ना',
        opts: [
          { hi: 'ढ़ शब्द के शुरू में नहीं आता; ढोल में ढ शुरू में है', en: 'ढ़ never starts a word; in ढोल the ढ is at the start', ok: true },
          { hi: 'दोनों एक ही हैं, कोई भी लिख दो', en: 'They are the same, write either', label: 'M2_DH' },
          { hi: 'जो सुंदर लगे वह लिख दो', en: 'Write whichever looks nicer', label: 'RANDOM' }
        ],
        okFb: { hi: 'बिल्कुल सही! 🎉 ढ़ शब्द के शुरू में कभी नहीं आता।', en: 'Exactly! ढ़ never begins a word.' } }
    ],
    hard: [
      { id: 'DH1', f: 'FILL', clue: '🪚', q: 'लकड़ी का काम करने वाला', en: 'Someone who works with wood (carpenter)', word: 'बढ़ई' },
      { id: 'DH2', f: 'SPELL', clue: '🧗', q: 'पेड़ पर ___ — टुकड़े जोड़कर लिखो', en: '___ (climb) the tree', word: 'चढ़ना' }
    ],
    remed: [
      { id: 'DR1', f: 'MCQ', listen: true, clue: '🔊', q: 'सुनो, फिर सही लिखा शब्द चुनो', en: 'Listen, then choose the correctly written word', word: 'पढ़ना', opts: ['पढ़ना', 'पढना'] },
      { id: 'DR2', f: 'FILL', clue: '👴', q: 'दादाजी ___ हैं', en: 'Grandpa is old', word: 'बूढ़ा' }
    ],
    mid: [
      { id: 'DM1', f: 'MCQ', clue: '🍳', q: 'खाना बनाने का बर्तन', en: 'A cooking pan (kadhai)', word: 'कढ़ाई', opts: ['कढ़ाई', 'कढाई'] },
      { id: 'DM2', f: 'FILL', clue: '🧔', q: 'दादाजी की लंबी ___', en: "Grandpa's long beard", word: 'दाढ़ी' }
    ]
  }
};

/* Feedback library (§D3.5). {name}, {w} (correct word, highlighted), {L} (target letter), {bad} (learner's word). */
const FB = {
  CORRECT:       { tone: 'ok',   hi: 'शाबाश, {name}! 🎉 {w} में <b>{L}</b> ही आता है।', en: 'Well done, {name}! {w} has {L}.' },
  CORRECT_RETRY: { tone: 'ok',   hi: 'बहुत अच्छे! इस बार तुमने सही कर लिया। 💪 {w}', en: 'Very good! You got it this time. {w}' },
  FIND_OK:       { tone: 'ok',   hi: 'शाबाश, {name}! 🎉 "{bad}" ग़लत था — सही है {w}।', en: 'Well done! "{bad}" was wrong — the correct word is {w}.' },
  M1:            { tone: 'warn', hi: 'तुम्हारा बोलना बिल्कुल ठीक है! 😊 पर लिखते समय यहाँ <b>श</b> लगता है: {w}। चलो, एक बार और।', en: 'Your speaking is fine! But in writing this needs श: {w}. Try once more.' },
  OVER:          { tone: 'warn', hi: 'ध्यान दो! {w} में <b>स</b> ही आता है। हर स, श नहीं बनता: <b>स</b>ब, <b>स</b>ात, <b>स</b>मय।', en: 'Careful! {w} keeps स. Not every स becomes श.' },
  M2_D:          { tone: 'warn', hi: 'लगभग सही! 👀 यहाँ ड के नीचे <b>बिंदी</b> चाहिए: {w}। बीच में आने वाला यह अक्षर <b>ड़</b> होता है।', en: 'Almost! This needs the dot: {w}. In the middle it is usually ड़.' },
  M2_R:          { tone: 'warn', hi: 'घर पर हम "{bad}" बोलते हैं — कोई बात नहीं! पर लिखते हैं {w}, <b>र</b> नहीं।', en: 'At home we say "{bad}", that\'s fine! But we write {w}, not र.' },
  M2_DH:         { tone: 'warn', hi: 'लगभग सही! 👀 यहाँ <b>ढ़</b> चाहिए, नीचे बिंदी के साथ: {w}।', en: 'Almost! This needs ढ़ with the dot: {w}.' },
  POS:           { tone: 'warn', hi: 'ड़ / ढ़ शब्द के <b>शुरू में कभी नहीं</b> आता। शुरू में <b>ड / ढ</b>: {w}।', en: 'ड़/ढ़ never comes at the start of a word. At the start: ड/ढ. {w}' },
  OVER_D:        { tone: 'warn', hi: 'यहाँ बिंदी <b>नहीं</b> लगती: {w}। (ं के बाद या शब्द के शुरू में ड ही रहता है।)', en: 'No dot here: {w}. (After ं or at the start, it stays ड.)' },
  OTHER:         { tone: 'warn', hi: 'यह शब्द ऐसे लिखते हैं: {w}। एक बार ध्यान से देखो। 👀', en: 'This word is written: {w}. Look carefully once.' },
  FIND_MISS:     { tone: 'warn', hi: '"{bad}" तो सही लिखा है। 🙂 कोई दूसरा शब्द देखो — किसमें श/स या ड़ ग़लत है?', en: '"{bad}" is spelled correctly. Look at another word.' },
  HOME:          { tone: 'warn', hi: 'नहीं! तुम्हारी भोजपुरी ग़लत नहीं है। ❤️ बोलने के कई तरीके होते हैं। बस <b>लिखने</b> का एक तय तरीका है।', en: 'No! Your Bhojpuri is not wrong. There are many ways to speak, but one fixed way to write.' },
  RANDOM:        { tone: 'warn', hi: 'वर्तनी सुंदरता से नहीं, <b>नियम</b> से तय होती है। 🙂 एक बार और सोचो।', en: 'Spelling follows a rule, not looks. Think again.' },
  WHY_M1:        { tone: 'warn', hi: 'श और स <b>दो अलग अक्षर</b> हैं। बोलने में एक जैसे लग सकते हैं, पर लिखने में अलग हैं।', en: 'श and स are two different letters. They may sound alike, but are written differently.' },
  WHY_M2:        { tone: 'warn', hi: 'ड और ड़ (ढ और ढ़) <b>अलग</b> हैं — बिंदी वाला अक्षर शब्द के शुरू में नहीं आता।', en: 'ड and ड़ (ढ and ढ़) are different — the dotted one never starts a word.' },
  SHOW:          { tone: 'info', hi: 'सही शब्द है: {w}। इसे थोड़ी देर बाद फिर देखेंगे। 👀', en: 'The correct word is {w}. We will see it again in a little while.' },
  SPEECH_STD:    { tone: 'ok',   hi: 'वाह! तुमने "{bad}" साफ़ बोला। 🎉', en: 'Wow! You said "{bad}" clearly.' },
  SPEECH_VAR:    { tone: 'ok',   hi: 'बहुत बढ़िया! 🎉 "{bad}" — यह तुम्हारे इलाके का उच्चारण है, <b>बिल्कुल ठीक है</b>। बस लिखते समय याद रखना: {w}।', en: 'Great! "{bad}" is how people in your area say it — completely fine. Just remember to write {w}.' },
  SPEECH_NEAR:   { tone: 'info', hi: 'लगभग! एक बार और साफ़ बोलो 🎤', en: 'Almost! Say it once more, clearly.' },
  SPEECH_UNCLEAR:{ tone: 'info', hi: 'आवाज़ साफ़ नहीं आई। एक बार फिर बोलो 🎤', en: "I didn't catch that. Say it again." },
  SPEECH_FAIL:   { tone: 'info', hi: 'माइक नहीं चला — कोई बात नहीं, लिखकर करते हैं। ✍️', en: "The mic didn't work — no problem, let's write instead." },
  REMED:         { tone: 'info', hi: 'लगता है {T} थोड़ा मुश्किल लग रहा है। चलो, एक छोटी-सी बात फिर से देखें।', en: 'Looks like {T} is a bit hard. Let\'s look at it again quickly.' }
};

/* Accepted spoken variants (speech only — §D6.1). Item-level `variants` are merged with this table. */
const SPEECH_VARIANTS = {
  'शाम': ['साम'], 'शहर': ['सहर'], 'देश': ['देस'], 'शेर': ['सेर'],
  'सड़क': ['सरक', 'सडक'], 'पेड़': ['पेर', 'पेड'], 'लड़का': ['लरका', 'लडका'],
  'घोड़ा': ['घोरा', 'घोडा'], 'पढ़ना': ['पढना', 'परहना']
};

const LEVEL_NAMES = { 1: 'स्तर 1', 2: 'स्तर 2', 3: 'स्तर 3' };
const WEEKDAYS_HI = ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श']; // Sun..Sat
