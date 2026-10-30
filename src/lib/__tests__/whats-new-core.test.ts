/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { WHATS_NEW } from '../../data/whats-new';
import { releaseTitle, whatsNewStep } from '../whats-new-core';

const D = 86_400_000;

test('a fresh install never shows the card', () => {
  assert.deepEqual(whatsNewStep(null, '1.1.0', true, false, 0), { show: false, next: { version: '1.1.0' } });
});

test('an update with an entry shows it once, for 7 days at most', () => {
  const first = whatsNewStep({ version: '1.0.0' }, '1.1.0', true, true, 0);
  assert.equal(first.show, true);
  const again = whatsNewStep(first.next, '1.1.0', true, true, 3 * D);
  assert.deepEqual(again, { show: true, next: null });
  assert.deepEqual(whatsNewStep(first.next, '1.1.0', true, true, 7 * D), { show: false, next: { version: '1.1.0' } });
});

test('dismissed, or an update with nothing new: no card', () => {
  assert.equal(whatsNewStep({ version: '1.1.0' }, '1.1.0', true, true, 0).show, false);
  assert.deepEqual(whatsNewStep({ version: '1.0.0' }, '1.0.1', false, true, 0), { show: false, next: { version: '1.0.1' } });
});

test('an existing player from before the card existed sees it', () => {
  assert.equal(whatsNewStep(null, '1.1.0', true, true, 0).show, true);
});

test('versions compare part by part', async () => {
  const { versionAtMost } = await import('../whats-new-core');
  assert.equal(versionAtMost('1.0.1', '1.1.0'), true);
  assert.equal(versionAtMost('1.9.2', '1.10.0'), true);
  assert.equal(versionAtMost('1.1.0', '1.0.9'), false);
  assert.equal(versionAtMost('1.0.1', '1.0.1'), true);
});

test('the 1st update: the newest entry at or below the app version, shown once whichever store version it ships as', async () => {
  const { releaseFor } = await import('../whats-new-core');
  const { WHATS_NEW } = await import('../../data/whats-new');
  assert.equal(releaseFor(WHATS_NEW, '1.0.0')?.version, '1.0.0');
  for (const v of ['1.0.1', '1.0.2', '1.1.0']) {
    const r = releaseFor(WHATS_NEW, v)!;
    assert.equal(r.version, '1.0.1', v);
    // A 1.0.0 player with data: the card shows once, then stays away (the release is what is remembered).
    const first = whatsNewStep({ version: '1.0.0' }, r.version, true, true, 0);
    assert.equal(first.show, true, v);
    assert.equal(whatsNewStep({ version: r.version }, r.version, true, true, 0).show, false, v);
  }
  // A new player on the update: no card.
  assert.equal(whatsNewStep(null, '1.0.1', true, false, 0).show, false);
});

test('the 1st update lists the five things, the first being the one on the card', async () => {
  const { WHATS_NEW } = await import('../../data/whats-new');
  const r = WHATS_NEW[0];
  assert.equal(r.version, '1.0.1');
  assert.deepEqual(r.items.map((x) => x.title), ['Cash ao vivo', 'Análise Pro mais rigorosa', 'Notas sobre jogadores', 'ICM e deals', 'Mais rápida com anos de mãos']);
  // Store rules: nothing about money changing hands or betting.
  for (const it of r.items) assert.doesNotMatch(`${it.title} ${it.body}`, /apost|apuest|\bbet\b|ganhei|perdi|comprar|investir/i);
});

test('the card: never over a live session, and what is remembered is the release', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../components/WhatsNewCard.tsx', import.meta.url), 'utf8');
  assert.match(src, /if \(!ready \|\| decided\.current \|\| activeSession\) return;/);
  assert.match(src, /item: show && release && !activeSession \? release\.items\[0\] : null/);
  assert.match(src, /JSON\.stringify\(\{ version: key \}\)/);
  assert.doesNotMatch(src, /JSON\.stringify\(\{ version: VERSION \}\)/);
});

test('the 7 days start when the card is on screen, not while the first week holds its place', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../components/WhatsNewCard.tsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  // Dealt but not shown: nothing written; shown(): the stamp.
  assert.match(src, /if \(step\.show\) stamp\.current = step\.next;\s*else if \(step\.next\) await AsyncStorage\.setItem/);
  assert.match(src, /const id = setTimeout\(onShown, SEEN_AFTER_MS\);\s*return \(\) => clearTimeout\(id\);/);
  assert.match(home, /<StartChecklist state=\{checklist\} \/>\s*\) : news\.item \?/);
  assert.match(home, /<WhatsNewCard item=\{news\.item\} onDismiss=\{news\.dismiss\} onShown=\{news\.shown\} \/>/);
  // In the step itself: a 1.0.0 phone that never saw the card gets the full 7 days from the first time it shows.
  const day = 86_400_000;
  const first = whatsNewStep({ version: '1.0.0' }, '1.0.1', true, true, 10 * day);
  assert.deepEqual(first, { show: true, next: { version: '1.0.0', shownFor: '1.0.1', shownAt: 10 * day } });
});

test('Novidades titles the entry with the version that brought it, never a later bugfix', () => {
  assert.equal(releaseTitle('1.0.1', true, '1.1.0'), '1.1.0');
  assert.equal(releaseTitle('1.0.1', true, '1.0.1'), '1.0.1');
  // A bugfix with no entry of its own doesn't claim the 1st update's news.
  assert.equal(releaseTitle('1.0.1', true, '1.0.2'), '1.0.1');
  assert.equal(releaseTitle('1.0.1', true, '1.1.1'), '1.1.0');
  assert.equal(releaseTitle('1.0.0', false, '1.1.0'), '1.0.0');
});

test('the home card keeps the news to two lines, and the notes item has the Notes tile icon', () => {
  const card = readFileSync(new URL('../../components/WhatsNewCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /<T v="small" numberOfLines=\{2\}>\s*\{t\(item\.body\)\}/);
  const notes = WHATS_NEW[0].items.find((x) => x.title === 'Notas sobre jogadores');
  assert.equal(notes?.icon, 'create-outline');
});

test('the card names the same version as Novidades, and releaseFor keeps its own doc comment', () => {
  const card = readFileSync(new URL('../../components/WhatsNewCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /releaseTitle\(announced\.version, true, VERSION\)/);
  assert.match(card, /t\('Novo na versão \{v\}', \{ v: shownVersion \}\)/);
  const core = readFileSync(new URL('../whats-new-core.ts', import.meta.url), 'utf8');
  assert.match(core, /\*\/\nexport function releaseFor/);
  assert.match(core, /\*\/\nexport function releaseTitle/);
});
