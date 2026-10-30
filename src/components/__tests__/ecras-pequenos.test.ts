/// <reference types="node" />
// Small screens and large text (walked in the web build at 360×640, 375×667 and 320×568, at 100%,
// 135% and 200% text, in pt-PT, pt-BR and es). The hand's dock was pinned under the felt and never
// scrolled: at 200% on a 360 dp Android, Fold went below the screen and the clubs row was cut, and
// at 100% the first-hand tip was already 12 px past the bottom. Now the dock gives up its tips when
// it doesn't fit, and whatever is still left over scrolls. Read from the source: the screen is native
// layout with no renderer in these tests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.join(__dirname, '..', '..');
const hand = readFileSync(path.join(root, 'app', 'hand', 'new.tsx'), 'utf8');
const ui = readFileSync(path.join(root, 'components', 'ui.tsx'), 'utf8');
const dock = hand.slice(hand.indexOf('{/* dock: everything the thumb needs'), hand.indexOf('{toldOpened ?'));

test('the dock shrinks to the screen and scrolls what is left, keeping taps while the keyboard is up', () => {
  assert.match(dock, /<View style=\{\[SHADOW, \{ flexShrink: 1,/, 'the dock never gave way to the screen');
  const scroll = dock.slice(dock.indexOf('<ScrollView'), dock.indexOf('<Animated.View'));
  assert.ok(scroll.length > 0 && dock.indexOf('<ScrollView') < dock.indexOf('<Animated.View'), 'the dock is not in a scroll view');
  assert.match(scroll, /style=\{\{ flexGrow: 0 \}\}/);
  // The notes at the showdown: a tap on Guardar mustn't just close the keyboard.
  assert.match(scroll, /keyboardShouldPersistTaps="handled"/);
  // The showdown's own list scrolls inside it on Android too.
  assert.match(dock, /keyboardShouldPersistTaps="handled" nestedScrollEnabled>/);
  assert.ok(dock.trimEnd().endsWith('</ScrollView>\n      </View>'), 'the scroll view closes the dock');
});

test('only a dock that really overflows turns compact, read once the layout settles, and it stays', () => {
  assert.match(dock, /onLayout=\{\(e\) => fitDock\(e\.nativeEvent\.layout\.height\)\}/);
  assert.match(dock, /onContentSizeChange=\{\(_, h\) => fitDock\(undefined, h\)\}/);
  // Content arrives before the frame grows to it: checked after a pause, or a normal phone turned compact.
  assert.match(hand, /setTimeout\(\(\) => \{\s*if \(d\.frame > 0 && d\.content > d\.frame \+ 1\) setCramped\(true\);\s*\}, 250\)/);
  assert.match(hand, /if \(cramped\) return;/);
  assert.doesNotMatch(hand, /setCramped\(false\)/);
});

test('a compact dock gives the felt less, drops the tips and puts the voice button up as a chip', () => {
  assert.match(hand, /const compact = shortScreen \|\| cramped;/);
  assert.match(hand, /const feltMin = cramped \? 120 : 160;/);
  assert.match(hand, /minHeight: feltMin,/);
  assert.match(hand, /\{compact && !hand\.actions\.length \? \(\s*<Chip label=\{voiceLocked/);
  assert.match(hand, /\{!hand\.actions\.length && !compact && \(\s*<Pressable/);
  assert.match(hand, /\{!settings\.onboarded && !isEdit && !cramped \? \(\s*<T v="tiny"[^>]*>\s*\{t\('Posição e duas cartas/);
  assert.match(hand, /\{firstHint && !cramped \? \(/);
  // An iPhone SE at normal text keeps its tips: they fit there.
  assert.doesNotMatch(hand, /firstHint && !compact|!isEdit && !compact/);
});

test('the seat buttons are capped like button text, so the seats stay in their rows', () => {
  const seats = hand.slice(hand.indexOf('{positionOrder(n).map((label) => {'), hand.indexOf('<CardPicker used={usedCards(hand, heroCards)}'));
  assert.match(seats, /<T v="body" maxFontSizeMultiplier=\{1\.6\}/);
});

test('Android: a scrolling screen moves up for the keyboard (the session cash-out went under it)', () => {
  const screen = ui.slice(ui.indexOf('export function Screen('), ui.indexOf('export function ScreenHeader('));
  // iPhone: the scroll view's own inset, as before.
  assert.match(screen, /automaticallyAdjustKeyboardInsets/);
  assert.match(screen, /if \(Platform\.OS !== 'android'\) return list;/);
  assert.match(screen, /<KeyboardAvoidingView behavior="padding" style=\{\{ flex: 1, backgroundColor: C\.bg \}\}>\s*\{list\}\s*<\/KeyboardAvoidingView>/);
});
