import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inviteCodeFrom } from '../invite-code';

test('finds the code in a pasted invite link or on its own', () => {
  assert.equal(inviteCodeFrom('https://sweatbook.poker/r/K7MPQ2XA?lang=pt'), 'K7MPQ2XA');
  assert.equal(inviteCodeFrom('https://sweatbook.poker/h/abc?r=0a1b2c3d4e'), '0a1b2c3d4e');
  assert.equal(inviteCodeFrom('  k7mpq2xa '), 'K7MPQ2XA');
  assert.equal(inviteCodeFrom('Uso o Sweatbook. Experimenta: https://sweatbook.poker/r/0A1B2C3D4E'), '0a1b2c3d4e');
});

test('anything else on the clipboard is not a code', () => {
  assert.equal(inviteCodeFrom('olá'), null);
  assert.equal(inviteCodeFrom('https://example.com/r/xyz'), null);
  assert.equal(inviteCodeFrom('IIIIOOOO'), null);
  assert.equal(inviteCodeFrom(''), null);
});
