/* Bhojpurify · ET617 · 23B2509 — classifier + speech-judge checks (DESIGN.md §D6.2 "Check").
 * Run: node tests/nlp.test.js
 */
'use strict';
const assert = require('assert');
const { classify, judgeSpeech, graphemes, normalise } = require('../nlp.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('classify()');
const cases = [
  ['शाम', 'शाम', 'CORRECT'],
  ['शाम', 'साम', 'M1'],
  ['शहर', 'सहर', 'M1'],
  ['देश', 'देस', 'M1'],
  ['शेर', 'सेर', 'M1'],
  ['सब', 'शब', 'OVER'],
  ['सड़क', 'सडक', 'M2_D'],
  ['सड़क', 'सरक', 'M2_R'],
  ['पेड़', 'पेर', 'M2_R'],
  ['लड़का', 'लडका', 'M2_D'],
  ['पढ़ना', 'पढना', 'M2_DH'],
  ['पढ़ना', 'परना', 'M2_DH'],
  ['डर', 'ड़र', 'POS'],
  ['ढोल', 'ढ़ोल', 'POS'],
  ['ठंडा', 'ठंड़ा', 'OVER_D'],
  ['शाम', 'शम', 'OTHER'],
  ['शहर', 'षहर', 'OTHER'],
  ['सड़क', 'सड़क ', 'CORRECT'],
  ['शहर', 'शहर।', 'CORRECT']
];
cases.forEach(([target, resp, want]) => t(`${target} ← ${resp} = ${want}`, () => assert.strictEqual(classify(target, resp), want)));

t('precomposed ड़ (U+095C) equals ड + nukta', () => {
  assert.strictEqual(classify('सड़क', 'सड़क'), 'CORRECT');
});

console.log('judgeSpeech()');
t('standard word heard', () => assert.strictEqual(judgeSpeech('शाम', ['साम'], [{ text: 'शाम', conf: .9 }]).result, 'SPEECH_STD'));
t('dialect variant heard → accepted', () => assert.strictEqual(judgeSpeech('शाम', ['साम'], [{ text: 'साम', conf: .8 }]).result, 'SPEECH_VAR'));
t('standard found in later alternative wins', () => assert.strictEqual(judgeSpeech('शाम', ['साम'], [{ text: 'साम' }, { text: 'शाम' }]).result, 'SPEECH_STD'));
t('word inside a phrase', () => assert.strictEqual(judgeSpeech('सड़क', ['सरक'], [{ text: 'यह सरक है' }]).result, 'SPEECH_VAR'));
t('near miss', () => assert.strictEqual(judgeSpeech('शहर', [], [{ text: 'शहद' }]).result, 'SPEECH_NEAR'));
t('unclear', () => assert.strictEqual(judgeSpeech('शाम', ['साम'], [{ text: 'नमस्ते' }]).result, 'SPEECH_UNCLEAR'));
t('empty result', () => assert.strictEqual(judgeSpeech('शाम', ['साम'], []).result, 'SPEECH_UNCLEAR'));

console.log('graphemes()');
t('शेर → शे | र', () => assert.deepStrictEqual(graphemes('शेर'), ['शे', 'र']));
t('लड़का → ल | ड़ | का', () => assert.deepStrictEqual(graphemes('लड़का').map(normalise), ['ल', 'ड़', 'का'].map(normalise)));
t('आकाश → आ | का | श', () => assert.deepStrictEqual(graphemes('आकाश'), ['आ', 'का', 'श']));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
