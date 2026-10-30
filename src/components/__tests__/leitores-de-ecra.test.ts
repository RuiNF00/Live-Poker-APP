/// <reference types="node" />
// VoiceOver and TalkBack in hand entry, the live session and the Summary (walked in the web build's
// accessibility tree, then read in the source: these screens are native, with no renderer here).
// The focus fell back to «Fechar» each time the hand moved on, about twenty stops from Fold; a hand
// or session saved was never said; the hand's result was read as just «Resultado»; the felt read
// «SWEATBOOK», bare chip numbers and «D»; the clock was read digit by digit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(path.join(root, ...p), 'utf8');
const entry = read('app', 'hand', 'new.tsx');
const detail = read('app', 'hand', '[id].tsx');
const summary = read('app', 'summary', '[id].tsx');
const live = read('app', '(tabs)', 'session.tsx');
const table = read('components', 'Table.tsx');
const header = read('components', 'HandHeader.tsx');
const row = read('components', 'HandRow.tsx');
const ui = read('components', 'ui.tsx');

test('when the hand moves on, the focus goes to the new part\'s heading, not back to the top', () => {
  assert.match(entry, /const reader = useScreenReader\(\);/);
  assert.match(entry, /if \(moved && reader && phase !== 'hero' && phase !== 'done'\) \{/);
  assert.match(entry, /const node = findNodeHandle\(phaseHead\.current\);\s*if \(node\) AccessibilityInfo\.setAccessibilityFocus\(node\);/);
  // One heading per part of the hand carries the ref: the action, the board, the 2nd run, the showdown.
  assert.equal(entry.match(/<T v="h2" ref=\{phaseHead\}/g)?.length, 4);
  // The heading says the folds made for you (iPhone), so the announcement isn't said over it.
  assert.match(entry, /accessibilityLabel=\{Platform\.OS === 'ios' && spoken \? spoken : undefined\}/);
  assert.match(entry, /if \(reader && Date\.now\(\) - f\.at < 1000\) return;/);
  // T passes the ref on to the native text.
  assert.match(ui, /export function T\(\{[^)]*ref\?: React\.Ref<React\.ComponentRef<typeof RNText>> \}\)/);
});

test('a hand saved from entry is announced on the next screen, with its result', () => {
  assert.match(entry, /\.\.\.\(asNew \? \{ g: '1' \} : null\)/);
  assert.match(detail, /g: justSaved \} = useLocalSearchParams/);
  assert.match(detail, /announceAfterChange\(savedMessage\('hand', net === undefined \? undefined :/);
  // Said once, and not cut off when the stored hand updates under it.
  assert.match(detail, /if \(!justSaved \|\| !hand \|\| savedSaid\.current\) return;/);
  assert.match(detail, /useEffect\(\(\) => \(\) => savedSaid\.current\?\.\(\), \[\]\);/);
});

test('a session just closed is announced on its summary, with the result', () => {
  assert.match(summary, /if \(!s\?\.endedAt \|\| openedAt - s\.endedAt > 10_000\) return;/);
  assert.match(summary, /announceAfterChange\(savedMessage\('session', plus\(p\) \+ money\(p, s\.currency\)\)\)/);
  const helper = read('lib', 'screen-reader.ts');
  // VoiceOver drops what is said during a screen change: it waits and joins the queue.
  assert.match(helper, /announceForAccessibilityWithOptions\(message, \{ queue: true \}\)/);
  assert.match(helper, /\}, 700\);/);
});

test('the hand\'s result is read with its value, not as «Resultado» alone', () => {
  assert.doesNotMatch(header, /accessibilityLabel=\{t\('Resultado'\)\}/);
  assert.match(header, /accessibilityLabel=\{`\$\{t\('Resultado'\)\}: \$\{/);
});

test('the felt reads the seats and the pot, not the drawing', () => {
  const hidden = 'accessibilityElementsHidden importantForAccessibility="no-hide-descendants"';
  assert.ok(table.includes(`<Text ${hidden} maxFontSizeMultiplier={TABLE_SCALE} style={[styles.watermark`), 'brand');
  assert.ok(table.includes(`<Text ${hidden} maxFontSizeMultiplier={TABLE_SCALE} style={[styles.narration`), 'street');
  assert.ok(table.includes(`<View ${hidden} style={[styles.bet,`), 'chips in front');
  assert.match(table, new RegExp(`<View\\s*${hidden}\\s*style=\\{\\[\\s*styles\\.dealer`), 'dealer');
  assert.match(table, /accessible accessibilityLabel=\{`\$\{t\('Pote'\)\} \$\{pot\}`\}/);
  // The street dots above the felt: the heading below says the street.
  assert.match(entry, /<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">\s*<Row gap=\{6\} style=\{\{ justifyContent: 'center', paddingVertical: 2 \}\}>/);
});

test('the live clock card is one stop, with the time in hours and minutes', () => {
  assert.match(live, /<PlayCard s=\{s\} paused=\{paused\} nHands=\{nHands\} \/>/);
  assert.match(live, /accessibilityLabel=\{\[state, spokenPlayed\(playedMs\(s, now\)\), \.\.\.started\.split\(' · '\)\]\.join\(', '\)\}/);
});

test('a hand row (Summary and Mãos) is one line: cards by name, where, result, time, pills', () => {
  assert.match(row, /accessibilityLabel=\{label\}/);
  assert.match(row, /hero\.cards\.map\(cardName\)\.join\(', '\)/);
  assert.match(row, /`\$\{t\('Resultado'\)\}: \$\{/);
  assert.match(row, /!done \? t\('Por completar'\) : ''/);
});
