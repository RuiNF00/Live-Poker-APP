/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { APP_PREFIXES, DELETE_KINDS, dropCloud, KEEP_KEYS, keysToErase } from '../erase-core';

test('erasing removes every hand, session, setting and cloud code, and keeps the pending deletes and the free-plan log', () => {
  const all = ['rl.hands.v2', 'rl.hand.v2.a', 'rl.session.v2.b', 'rl.settings.v1', 'rl.cloud.v1', 'rl.draft.v1', 'rl.festivalPlans.v1', 'sweatbook.replayer.tips.v1', ...KEEP_KEYS, 'expo.other'];
  const gone = keysToErase(all);
  assert.deepEqual(gone, ['rl.hands.v2', 'rl.hand.v2.a', 'rl.session.v2.b', 'rl.settings.v1', 'rl.cloud.v1', 'rl.draft.v1', 'rl.festivalPlans.v1', 'sweatbook.replayer.tips.v1']);
  for (const k of ['rl.outbox.v1', 'sweatbook.share-queue.v1', 'rl.usage.v1', 'rl.pro.v1']) assert.ok(!gone.includes(k), k);
  assert.ok(!gone.includes('expo.other'));
});

test('every storage key the app writes is one "delete all my data" knows about', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) {
        if (f !== '__tests__' && f !== 'node_modules') walk(p);
      } else if (/\.tsx?$/.test(f)) files.push(p);
    }
  };
  walk(join(__dirname, '..', '..'));
  // Storage keys look like 'xx.name.v1' (or a prefix 'xx.name.v1.').
  const keys = new Set<string>();
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/'([a-z]+\.[A-Za-z0-9.-]+\.v\d+\.?)'/g)) keys.add(m[1]);
  assert.ok(keys.size > 20, `found ${keys.size} keys`);
  const unknown = [...keys].filter((k) => !APP_PREFIXES.some((p) => k.startsWith(p)));
  assert.deepEqual(unknown, [], 'a key outside APP_PREFIXES would survive "Apagar todos os meus dados"');
});

test('apagar tudo não volta a ligar os relatórios de erros', () => {
  assert.ok(!keysToErase(['rl.crash.v1', 'rl.hands.v2']).includes('rl.crash.v1'));
});

test('every delete the app queues is one the outbox never gives up on', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join(__dirname, '..');
  const kinds = new Set<string>();
  for (const f of readdirSync(dir)) {
    if (!/\.tsx?$/.test(f)) continue;
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/registerSender\('([a-z-]+)'/g)) kinds.add(m[1]);
  }
  const deletes = [...kinds].filter((k) => /-(delete|erase|leave|revoke)$/.test(k));
  assert.ok(deletes.length >= 10, `found ${deletes.length}`);
  assert.deepEqual(deletes.filter((k) => !DELETE_KINDS.includes(k)), []);
  // And no listed kind is a typo: each one has a sender.
  assert.deepEqual(DELETE_KINDS.filter((k) => !kinds.has(k)), []);
});

test('o código da cópia na nuvem só é esquecido depois de o apagar entrar na fila', async () => {
  const log: string[] = [];
  await dropCloud('c', async () => void log.push('queued'), async () => void log.push('forgot'));
  assert.deepEqual(log, ['queued', 'forgot']);
  // The cipher didn't load: the delete isn't queued, so the code stays and the erase fails.
  const kept: string[] = [];
  await assert.rejects(dropCloud('c', async () => Promise.reject(new Error('chunk')), async () => void kept.push('forgot')), /chunk/);
  assert.deepEqual(kept, []);
  // No cloud copy: just forget.
  const none: string[] = [];
  await dropCloud(null, async () => void none.push('queued'), async () => void none.push('forgot'));
  assert.deepEqual(none, ['forgot']);
});
