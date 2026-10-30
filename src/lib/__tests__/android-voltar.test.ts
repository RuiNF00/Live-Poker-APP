/// <reference types="node" />
// Android back and gesture never lose a hand, close what is on top first, and links from outside
// open the right screen. These screens load React Native, so most checks read their code.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { redirectSystemPath } from '../../app/+native-intent';

const src = fileURLToPath(new URL('../../', import.meta.url));
const read = (f: string) => readFileSync(join(src, f), 'utf8');
const files = (dir: string): string[] =>
  readdirSync(join(src, dir)).flatMap((n) => {
    const f = join(dir, n);
    if (n === '__tests__') return [];
    return statSync(join(src, f)).isDirectory() ? files(f) : /\.tsx$/.test(n) ? [f] : [];
  });

test('leaving an edited hand without «Guardar» asks first; a new hand keeps its draft', () => {
  const s = read('app/hand/new.tsx');
  assert.match(s, /usePreventRemove\(isEdit && !leaving && draft\.hand !== editedFrom,/);
  assert.match(s, /if \(saved\.current\) return leave\(\);/);
  // The guard comes off before the navigation runs again, or it would ask in a loop.
  assert.ok(s.indexOf('usePreventRemove(') < s.indexOf('if (leaving) navigation.dispatch(leaving);'));
  // A new hand's × with something entered goes back with the draft kept (store.draft).
  assert.match(s, /onPress=\{\(\) => \(busy \? router\.back\(\) : discard\(\)\)\}/);
  assert.match(s, /if \(!isEdit\) store\.setDraft\(hand\);/);
});

test('every Modal closes with Android back', () => {
  const missing = files('.').flatMap((f) => {
    const s = read(f);
    return [...s.matchAll(/<Modal\b[^>]*>/g)].filter((m) => !/onRequestClose=/.test(m[0])).map(() => f);
  });
  assert.deepEqual(missing, []);
});

test('Android back while recording a voice note cancels it and stays on the hand', () => {
  const s = read('components/entry/VoiceNote.tsx');
  assert.match(s, /BackHandler\.addEventListener\('hardwareBackPress', \(\) => \(void cancel\.current\(\), true\)\)/);
});

test('notes saved on blur are saved too when the screen goes, the street changes or the app is put away', () => {
  const hook = read('components/useSaveOnLeave.ts');
  assert.match(hook, /AppState\.addEventListener\('change', \(s\) => s === 'background' && latest\.current\(\)\)/);
  assert.match(hook, /sub\.remove\(\);\s*latest\.current\(\);/);
  const c = read('components/Comments.tsx');
  assert.match(c, /useSaveOnLeave\(pending\);/);
  assert.match(c, /if \(!editable\) pending\(\);/);
  assert.match(read('components/ReviewCard.tsx'), /useSaveOnLeave\(saveNote\);/);
  // Never onto a hand deleted on that screen: the save on the way out would bring it back.
  const d = read('app/hand/[id].tsx');
  assert.match(d, /deleted\.current = true;\s*deleteHand\(hand\.id\);/);
  assert.match(d, /if \(!hand \|\| deleted\.current\) return;/);
  assert.match(d, /onChange=\{keepNote\}/);
});

test('only a note the player typed is saved on the way out: one that changed elsewhere is never overwritten', () => {
  for (const f of ['components/Comments.tsx', 'components/ReviewCard.tsx']) {
    const s = read(f);
    assert.match(s, /const touched = useRef\(false\);/, f);
    assert.match(s, /onChangeText=\{\(v\) => \{\s*touched\.current = true;/, f);
    assert.match(s, /if \(!touched\.current \|\| .+\) return;\s*touched\.current = false;/, f);
  }
  // The street note's blur goes through the same guard.
  assert.match(read('components/Comments.tsx'), /onBlur=\{pending\}/);
});

test('Android opens the same links as the iPhone, and only those', () => {
  const app = JSON.parse(readFileSync(join(src, '..', 'app.json'), 'utf8'));
  const data = app.expo.android.intentFilters.flatMap((f: { data: { path?: string; pathPrefix?: string }[] }) => f.data);
  const paths = data.map((d: { path?: string; pathPrefix?: string }) => d.path ?? d.pathPrefix + '*');
  // The backer's statement is /b or /b/…, never any page of the site that starts with a b.
  assert.deepEqual(paths.sort(), ['/b', '/b/*', '/h/*', '/live/*', '/r/*', '/swap/*'].sort());
});

test('links from outside land on the right screen, cold or from the background', () => {
  const k = 'a'.repeat(32);
  for (const initial of [true, false]) {
    const go = (path: string) => redirectSystemPath({ path, initial });
    assert.equal(go(`https://sweatbook.poker/swap/s1#k=${k}`), `/swap/s1?k=${k}`);
    assert.equal(go(`https://sweatbook.poker/swap/g/g1?x=1#i=${k}&k=${k}`), `/swap/g/g1?x=1&i=${k}&k=${k}`);
    assert.equal(go('https://sweatbook.poker/b?r=abc#eyJ'), '/backing/add?d=eyJ&r=abc');
    assert.equal(go('https://sweatbook.poker/h/abc123'), 'https://sweatbook.poker/h/abc123');
    assert.equal(go('https://sweatbook.poker/h/demo'), '/hand/sample');
    assert.equal(go('sweatbook://swap/g/g1?pay=1'), 'sweatbook://swap/g/g1?pay=1');
  }
  // Under the linked screen there is always the app's home, so Back never leaves an empty screen.
  assert.match(read('app/_layout.tsx'), /anchor: '\(tabs\)'/);
});
