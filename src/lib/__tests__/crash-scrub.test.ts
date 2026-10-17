/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { scrubBreadcrumb, scrubEvent, scrubString, stripUrl } from '../crash-scrub';

test('emails, telefones e textos longos saem; linhas de código ficam', () => {
  assert.equal(scrubString('erro para rui@exemplo.pt'), 'erro para [email]');
  assert.equal(scrubString('liga +351 912 345 678'), 'liga [number]');
  assert.equal(scrubString('at render (index.bundle:12:345)'), 'at render (index.bundle:12:345)');
  assert.equal(scrubString('x'.repeat(201)), '[201 chars removed]');
});

test('links perdem query e #', () => {
  assert.equal(stripUrl('https://sweatbook.poker/r/abc?edit_token=SECRET#key'), 'https://sweatbook.poker/r/abc');
});

test('o relatório não leva utilizador, nome do telemóvel, cookies nem etiquetas proibidas', () => {
  const e = scrubEvent({
    user: { id: 'install-123', ip_address: '1.2.3.4' },
    server_name: 'iPhone do Rui',
    request: { url: 'https://x.pt/a?code=1', cookies: 'c=1', headers: { a: 'b' } },
    contexts: { device: { name: 'iPhone do Rui', model: 'iPhone15,2' } },
    tags: { channel: 'production', install_id: 'abc', amount: '500' },
    extra: { note: 'Ele 3-beta muito leve com A5s, liga-me 912345678' },
    exception: { values: [{ type: 'TypeError', value: 'cannot read rui@x.pt', stacktrace: { frames: [{ filename: 'app:///index.bundle', lineno: 12 }] } }] },
    breadcrumbs: [{ category: 'console', message: 'log' }, { category: 'fetch', data: { method: 'GET', url: 'https://x.pt/api?token=1', status_code: 200, body: 'segredo' } }],
  });
  assert.equal('user' in e, false);
  assert.equal('server_name' in e, false);
  assert.deepEqual(e.request, { url: 'https://x.pt/a' });
  assert.deepEqual(e.contexts, { device: { model: 'iPhone15,2' } });
  assert.deepEqual(e.tags, { channel: 'production' });
  assert.equal((e.extra as { note: string }).note, 'Ele 3-beta muito leve com A5s, liga-me [number]');
  assert.equal(e.exception.values[0].value, 'cannot read [email]');
  assert.equal(e.exception.values[0].stacktrace.frames[0].lineno, 12);
  assert.deepEqual(e.breadcrumbs, [{ category: 'fetch', data: { method: 'GET', url: 'https://x.pt/api', status_code: 200 } }]);
});

test('migalhas de consola são deitadas fora', () => {
  assert.equal(scrubBreadcrumb({ category: 'console', message: 'x' }), null);
  assert.deepEqual(scrubBreadcrumb({ category: 'navigation', data: { from: '/hand/1?x=2', to: '/bankroll' } }), { category: 'navigation', data: { from: '/hand/1', to: '/bankroll' } });
});
