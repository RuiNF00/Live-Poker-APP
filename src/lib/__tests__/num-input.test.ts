/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { numText, parseNum, syncText } from '../num-input';

// pt-PT, pt-BR and es write "," as the decimal mark; en writes ".".
const LANGS: [string, boolean][] = [['pt-PT', true], ['pt-BR', true], ['es', true], ['en', false]];

test('editing a cent amount keeps the cents (537,5 → 537,55)', () => {
  for (const [, comma] of LANGS) {
    const shown = numText(537.5, true, comma);
    assert.equal(shown, comma ? '537,5' : '537.5');
    assert.equal(parseNum(shown + '5', true, comma), 537.55);
    assert.equal(parseNum(shown.slice(0, -1), true, comma), 537);
    assert.equal(parseNum(shown.slice(0, -2), true, comma), 537);
  }
});

test('typing digit by digit', () => {
  for (const [, comma] of LANGS) {
    const m = comma ? ',' : '.';
    let text = '', value = 0;
    for (const ch of `12${m}05`) { text += ch; value = parseNum(text, true, comma); }
    assert.equal(value, 12.05);
    assert.equal(syncText(`12${m}`, 12, true, comma), `12${m}`);
    assert.equal(syncText(`12${m}0`, 12, true, comma), `12${m}0`);
  }
});

test('either mark works as decimal while typing', () => {
  for (const [, comma] of LANGS) {
    assert.equal(parseNum('12.5', true, comma), 12.5);
    assert.equal(parseNum('12,5', true, comma), 12.5);
    assert.equal(parseNum('12,345', true, true), 12.34);
  }
});

test('pasted amounts with thousands marks', () => {
  for (const [, comma] of LANGS) {
    assert.equal(parseNum('1.234,56', true, comma), 1234.56);
    assert.equal(parseNum('1,234.56', true, comma), 1234.56);
    assert.equal(parseNum('1.234.567', true, comma), 1234567);
    assert.equal(parseNum('€ 2 500,00', true, comma), 2500);
  }
  assert.equal(parseNum('1.500', true, true), 1500);
  assert.equal(parseNum('1,500', true, false), 1500);
});

test('an outside change replaces the text; the same value keeps it', () => {
  assert.equal(syncText('537', 600, true, true), '600');
  assert.equal(syncText('537,50', 537.5, true, true), '537,50');
  assert.equal(numText(0.1 + 0.2, true, false), '0.3');
  assert.equal(numText(0, true, true), '');
});

test('whole fields stay whole', () => {
  assert.equal(parseNum('1.500', false, true), 1500);
  assert.equal(numText(12, false, true), '12');
});
