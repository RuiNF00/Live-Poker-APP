/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { compareRowLabel, freeVsPro, planLabel, PLUS_ON } from '../plans';

const read = (f: string) => readFileSync(path.join(__dirname, '..', '..', f), 'utf8');

test('each comparison row is one sentence with its columns, «∞» said as «sem limite»', () => {
  const hands = freeVsPro().find((r) => r.label === 'Mãos novas por dia')!;
  assert.equal(compareRowLabel(hands), PLUS_ON ? 'Mãos novas por dia. Grátis: 3. Plus: sem limite. Pro: sem limite.' : 'Mãos novas por dia. Grátis: 3. Pro: sem limite.');
  assert.equal(compareRowLabel({ label: 'Staking e swaps', free: false, plus: false, pro: true }), PLUS_ON ? 'Staking e swaps. Grátis: Não. Plus: Não. Pro: Sim.' : 'Staking e swaps. Grátis: Não. Pro: Sim.');
  const src = read('components/CompareTable.tsx');
  assert.match(src, /accessible accessibilityLabel=\{compareRowLabel\(r\)\}/);
  assert.match(src, /accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/);
});

test('a plan reads «por ano», not «barra ano», with the free days and the saving', () => {
  assert.equal(
    planLabel({ name: 'Pro', title: 'Anual', big: '199,99 US$', unit: '/ano', line: '16,67 US$ por mês', tags: ['3 dias grátis', null, '−44%'] }),
    'Pro, Anual, 199,99 US$ por ano, 16,67 US$ por mês, 3 dias grátis, −44%',
  );
  assert.equal(planLabel({ name: 'Pro', title: 'Mensal', big: '29,99 US$', unit: '/mês', line: 'Cancela quando quiseres' }), 'Pro, Mensal, 29,99 US$ por mês, Cancela quando quiseres');
  assert.match(read('app/paywall.tsx'), /accessibilityLabel=\{planLabel\(\{ name, title, big, unit, line, tags \}\)\}/);
});

test('a button says its second line; the cancel flow asks the store once at a time and says thank you', () => {
  assert.match(read('components/ui.tsx'), /accessibilityLabel=\{sub \? `\$\{title\}, \$\{sub\}` : title\}/);
  const c = read('app/cancel.tsx');
  assert.equal(c.match(/disabled=\{buying\} onPress=\{once\(/g)?.length, 3);
  assert.match(c, /hint=\{t\('Escolher outro motivo'\)\}/);
  assert.match(c, /announceForAccessibility\(t\('Obrigado\. Lemos tudo o que nos mandam\.'\)\)/);
});

test('the cancel flow\'s switch to the yearly plan counts as a switch, not a paywall purchase', () => {
  assert.match(read('app/cancel.tsx'), /purchase\(ownPlans\.annual, 'switch', product \?\? undefined\)/);
});

test('a switch made in the cancel flow is remembered, so Settings doesn\'t offer it again', () => {
  const c = read('app/cancel.tsx');
  assert.match(c, /if \(res === 'ok' && what === 'annual' && product && ends\) rememberAnnualSwitch\(\{ product, ends \}\)/);
  assert.match(c, /setEnds\(s\?\.ends \? new Date\(s\.ends\)\.toISOString\(\) : null\)/);
});
