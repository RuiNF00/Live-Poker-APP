/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// The first week, read off the source: each step lands on its form.
const root = path.join(__dirname, '..', '..');
const read = (f: string) => readFileSync(path.join(root, f), 'utf8');

test('first-week steps open the form they name', () => {
  const s = read('components/StartChecklist.tsx');
  assert.match(s, /k === 'session'\) router\.navigate\(activeSession \? '\/session' : \{ pathname: '\/bankroll', params: \{ add: 'session' \} \}\)/);
  assert.match(s, /k === 'bankroll'\) router\.navigate\(\{ pathname: '\/bankroll', params: \{ add: 'deposit' \} \}\)/);
  const b = read('app/(tabs)/bankroll.tsx');
  assert.match(b, /add === 'deposit'\) setSheet\(\{ type: 'transfer', x: \{ \.\.\.blankTransfer\(defaultBankroll\.id, 'deposit'\), note: t\('Saldo inicial'\) \}, isNew: true \}\)/);
  assert.match(b, /router\.push\('\/import'\)/);
});

