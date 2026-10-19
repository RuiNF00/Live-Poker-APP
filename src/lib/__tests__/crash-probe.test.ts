/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { crashProbe } from '../crash-probe';

test('o teste de falha só dispara no ecrã pedido, até ser desligado', () => {
  const g = globalThis as { __sweatbookCrash?: string };
  crashProbe('hand');
  g.__sweatbookCrash = 'session';
  crashProbe('hand');
  assert.throws(() => crashProbe('session'), /crash probe: session/);
  assert.throws(() => crashProbe('session'), /crash probe: session/);
  delete g.__sweatbookCrash;
  crashProbe('session');
});
