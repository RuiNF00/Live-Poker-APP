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
    // Literal or in a ternary (icon={isPro ? '…' : 'lock-closed'}): the locked title is "Ver com Pro".
    for (const m of s.matchAll(/<Button\b(?:[^>]|=>)*?lock-(?:closed|open-outline)(?:[^>]|=>)*?\/>/g))
      if (!m[0].includes("t('Ver com Pro')")) odd.push(`${f}: ${/title=\{([^}]+)\}/.exec(m[0])?.[1]}`);
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

test('restoring the one-time Pro on the paywall unlocks like a subscription', () => {
  const p = src.find(([f]) => f === path.join('app', 'paywall.tsx'))![1];
  const body = /const onRestore = async \(\) => \{([\s\S]*?)\n {2}\};/.exec(p)?.[1] ?? '';
  assert.match(body, /const found = res === 'ok' \|\| res === 'lifetime';/);
  assert.match(body, /if \(found\) return unlocked\(/);
  assert.doesNotMatch(body, /res === 'ok'\) return unlocked/);
});

test('with large text the plan price goes under the name, so the per-month line has the width', () => {
  const p = src.find(([f]) => f === path.join('app', 'paywall.tsx'))![1];
  assert.match(p, /const bigText = useWindowDimensions\(\)\.fontScale > 1\.3;/);
  assert.doesNotMatch(p, /numberOfLines=\{bigText \? undefined : 2\}/);
});

test('restoring a one-time Pro inside the cancel flow reads lifetime again', () => {
  const c = src.find(([f]) => f === path.join('app', 'cancel.tsx'))![1];
  const body = /const onRestore = async \(\) => \{([\s\S]*?)\n {2}\};/.exec(c)?.[1] ?? '';
  assert.match(body, /if \(res === 'ok' \|\| res === 'lifetime'\) hasLifetime\(\)\.then\(setForGood\);/);
});

test('nothing floats over the paywall plans, and the trial steps stack with large text', () => {
  // The no-signal badge sits in the header row, never floating, and the paywall has no header.
  const n = src.find(([f]) => f === path.join('components', 'NetStatus.tsx'))![1];
  assert.doesNotMatch(n, /position: 'absolute'/);
  const l = src.find(([f]) => f === path.join('app', '_layout.tsx'))![1];
  assert.match(l, /name="paywall" options=\{\{ headerShown: false/);
  const p = src.find(([f]) => f === path.join('app', 'paywall.tsx'))![1];
  assert.match(p, /const stacked = useWindowDimensions\(\)\.fontScale > 1\.3;/);
});

test('Settings reads the plan again after a restore, also when already Pro', () => {
  const st = src.find(([f]) => f === path.join('app', 'settings.tsx'))![1];
  assert.match(st, /\}, \[pro\.isPro, restored\]\);/);
  assert.match(st, /if \(res === 'ok' \|\| res === 'lifetime'\) setRestored\(\(n\) => n \+ 1\);/);
});

test('the paywall at the hand limit says the hand is kept as a draft, at the table too', () => {
  const plans = readFileSync(path.join(root, 'billing', 'plans.ts'), 'utf8');
  const body = (r: string) => new RegExp(`\\n  ${r}: \\{\\n    title: [^\\n]+\\n    body: ([^\\n]+)`).exec(plans)?.[1] ?? '';
  assert.match(plans, /hands: \{\n    title: t\('Mão guardada como rascunho'\)/);
  assert.match(body('handsLive'), /rascunho/);
});
