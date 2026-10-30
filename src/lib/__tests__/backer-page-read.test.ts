/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readBackerPage, sealedPageRef } from '../backer-page-read';
import { b64url, seal } from '../sealed-link';

const key = b64url(Uint8Array.from({ length: 32 }, (_, i) => i * 3));
const id = 'AbCdEf1234';
const reply = (status: number, body: unknown = {}) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('a sealed backer link is found in the link, a whole message or the fragment the app is opened with', () => {
  const ref = { id, key };
  assert.deepEqual(sealedPageRef(`https://sweatbook.poker/b?r=ABC#s=${id}.${key}`), ref);
  assert.deepEqual(sealedPageRef(`As contas: https://sweatbook.poker/b#s=${id}.${key} 👍`), ref);
  assert.deepEqual(sealedPageRef(`s=${id}.${key}`), ref, 'what +native-intent hands to backing/add');
  assert.equal(sealedPageRef(`s=${id}.${key.slice(0, 30)}`), null, 'a key cut short');
  assert.equal(sealedPageRef('https://sweatbook.poker/b#eyJ2IjoxfQ'), null, 'an old statement link is not a sealed one');
});

test('the app opens a sealed backer page like the website: the statement, or why not', async () => {
  const statement = { v: 1, id: 'k_abc123', pl: 'Rui', cur: '€', bal: 120, rows: [] };
  const sealed = await seal(statement, id, key, Uint8Array.from({ length: 12 }, (_, i) => i));
  const st = await readBackerPage({ id, key }, reply(200, { sealed }));
  assert.ok(typeof st === 'object' && st.pl === 'Rui');
  assert.equal(await readBackerPage({ id, key }, reply(404)), 'gone');
  assert.equal(await readBackerPage({ id, key }, reply(200, { sealed: null })), 'empty');
  assert.equal(await readBackerPage({ id, key: b64url(new Uint8Array(32)) }, reply(200, { sealed })), 'bad');
  await assert.rejects(readBackerPage({ id, key }, reply(503)));
});
