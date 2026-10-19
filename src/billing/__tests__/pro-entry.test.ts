/// <reference types="node" />
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// Every lock in the app reads the same: "Ver com Pro" (Rui's decision). A source scan, so a new
// lock with its own wording fails here instead of in review.
const root = path.join(__dirname, '..', '..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (n === '__tests__' || n === 'i18n') return [];
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
const src = files(root).map((p) => [path.relative(root, p), readFileSync(p, 'utf8')] as const);

test('every lock button says "Ver com Pro"', () => {
  const odd: string[] = [];
  for (const [f, s] of src)
    for (const m of s.matchAll(/<Button\b[^>]*icon="lock-(?:closed|open-outline)"[^>]*>/g)) {
      const title = /title=\{t\('([^']+)'/.exec(m[0])?.[1];
      if (title !== 'Ver com Pro') odd.push(`${f}: ${title}`);
    }
  assert.deepEqual(odd, []);
});

test('no Pro call to action uses other wording', () => {
  const banned = ["t('Ver Pro')", "t('Experimentar Pro')", "com Pro', {", "t('Juntar as moedas com Pro')"];
  const hits = src.flatMap(([f, s]) => banned.filter((b) => s.includes(b)).map((b) => `${f}: ${b}`));
  assert.deepEqual(hits, []);
});

test('at the table the free-hands cell never offers the trial and opens the live paywall', () => {
  const home = src.find(([f]) => f === path.join('app', '(tabs)', 'index.tsx'))![1];
  assert.match(home, /handsLeft === 0 && trialDays && !activeSession \?/);
  assert.match(home, /activeSession \? 'handsLive' : 'hands'/);
});

test('one picked hand goes to the solver on the free plan', () => {
  const home = src.find(([f]) => f === path.join('app', '(tabs)', 'index.tsx'))![1];
  assert.match(home, /isPro \|\| picked\.size === 1 \? toSolver/);
});

test('buying from a bankroll lock carries on with what was tapped', () => {
  const b = src.find(([f]) => f === path.join('app', '(tabs)', 'bankroll.tsx'))![1];
  assert.match(b, /paywall\('stats', \(\) => setSheet\(\{ type: 'filters' \}\)\)/);
  assert.match(b, /paywall\('stats', \(\) => setSheet\(\{ type: 'bankroll' \}\)\)/);
  assert.match(b, /locked \? paywall\('stats', go\)/);
});

test('a lifetime owner is never told they will lose Pro in the cancel flow', () => {
  const c = src.find(([f]) => f === path.join('app', 'cancel.tsx'))![1];
  assert.match(c, /hasLifetime\(\)\.then\(setForGood\)/);
  assert.match(c, /forGood \? null : <T v="small">\{t\('Fica tudo guardado\. Sem Pro/);
});

test('on 760-900 pt screens the paywall keeps both plans above the footer', () => {
  const p = src.find(([f]) => f === path.join('app', 'paywall.tsx'))![1];
  assert.match(p, /const medium = !compact && win\.height < 900;/);
  assert.match(p, /\{compact \|\| medium \? null : \(/);
  assert.match(p, /featuresFor\(reason\)\.slice\(0, medium \? 1 : undefined\)/);
  assert.match(p, /table && !compact && !medium \? <FreeVsPro/);
  assert.match(p, /reason !== 'welcome' && !medium \? <Pill/);
});
