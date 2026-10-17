/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { attachmentName, supportEmail } from '../support';

const base = { fileName: 'export.CSV', text: 'Data;Local\n1;2', source: 'pbt' as const, rows: 120, read: 117, version: '1.0.0 (12)', platform: 'ios' };

test('the email says what support needs and nothing about the player', () => {
  const failed = [{ line: 4, reason: 'badDate' as const, value: 'soon' }, { line: 9, reason: 'badDate' as const, value: 'x' }, { line: 12, reason: 'noMoney' as const, value: '' }];
  const e = supportEmail({ ...base, failed });
  assert.equal(e.subject, 'Importação: pbt (120 linhas)');
  assert.match(e.body, /Linhas de fora: 3 \(badDate 2, noMoney 1\)/);
  assert.match(e.body, /Primeiras linhas de fora: 4, 9, 12/);
  assert.match(e.body, /App: 1\.0\.0 \(12\) · ios/);
  // The rows' contents travel in the attachment the player chose to send, not in the email text.
  assert.doesNotMatch(e.body, /soon/);
});

test('a file that could not be opened at all keeps its extension', () => {
  assert.equal(attachmentName({ fileName: 'Sessões 2025.xlsx', source: 'unreadable' }), 'sweatbook-importacao-unreadable.xlsx');
  assert.equal(attachmentName(base), 'sweatbook-importacao-pbt.csv');
  const e = supportEmail({ ...base, source: 'unreadable', read: 0, failed: [] });
  assert.doesNotMatch(e.body, /Linhas de fora/);
});
