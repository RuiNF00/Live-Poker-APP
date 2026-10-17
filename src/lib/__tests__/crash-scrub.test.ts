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

test('links perdem query, # e tokens no caminho', () => {
  assert.equal(stripUrl('https://sweatbook.poker/r/abc?edit_token=SECRET#key'), 'https://sweatbook.poker/r/abc');
  assert.equal(stripUrl('https://api.sweatbook.poker/api/coach/Zx9_kq2LmNoP4rStUv'), 'https://api.sweatbook.poker/api/coach/:id');
  assert.equal(stripUrl('sweatbook://swap/AbCdEfGh12345678'), 'sweatbook://swap/:id');
  assert.equal(stripUrl('/hand/h_000123'), '/hand/:id');
  assert.equal(stripUrl('/bankroll'), '/bankroll');
  assert.equal(stripUrl('https://sweatbook.poker/api/coach/AbCdEfGhIjKlMnOpQr/comments?x=1'), 'https://sweatbook.poker/api/coach/:id/comments');
});

test('o URL dentro da mensagem de erro também é limpo', () => {
  assert.equal(scrubString('Network request failed: https://x.pt/api/backup/Q1w2E3r4T5y6U7i8O9p0?k=1'), 'Network request failed: https://x.pt/api/backup/:id');
});

test('o relatório não leva utilizador, nome do telemóvel, cookies nem etiquetas proibidas', () => {
  const e = scrubEvent({
    user: { id: 'install-123', ip_address: '1.2.3.4' },
    server_name: 'iPhone do Rui',
    request: { url: 'https://x.pt/a?code=1', cookies: 'c=1', headers: { a: 'b' } },
    contexts: { device: { name: 'iPhone do Rui', id: 'dev-123', model: 'iPhone15,2' } },
    transaction: '/swap/AbCdEfGh12345678',
    tags: { channel: 'production', install_id: 'abc', amount: '500' },
    extra: { note: 'Ele 3-beta', said: 'Ele 3-beta muito leve com A5s, liga-me 912345678' },
    exception: { values: [{ type: 'TypeError', value: 'cannot read rui@x.pt', stacktrace: { frames: [{ filename: 'app:///index.bundle', lineno: 12 }] } }] },
    breadcrumbs: [{ category: 'console', message: 'log' }, { category: 'fetch', data: { method: 'GET', url: 'https://x.pt/api?token=1', status_code: 200, body: 'segredo' } }],
  });
  assert.equal('user' in e, false);
  assert.equal('server_name' in e, false);
  assert.deepEqual(e.request, { url: 'https://x.pt/a' });
  assert.equal('headers' in (e.request as object), false);
  assert.deepEqual(e.contexts, { device: { model: 'iPhone15,2' } });
  assert.equal(e.transaction, '/swap/:id');
  assert.deepEqual(e.tags, { channel: 'production' });
  assert.deepEqual(e.extra, { said: 'Ele 3-beta muito leve com A5s, liga-me [number]' });
  assert.equal(e.exception.values[0].value, 'cannot read [email]');
  assert.equal(e.exception.values[0].stacktrace.frames[0].lineno, 12);
  assert.deepEqual(e.breadcrumbs, [{ category: 'fetch', data: { method: 'GET', url: 'https://x.pt/api', status_code: 200 } }]);
});

test('migalhas de consola e de toques são deitadas fora; navegação só com a rota', () => {
  assert.equal(scrubBreadcrumb({ category: 'console', message: 'x' }), null);
  assert.equal(scrubBreadcrumb({ category: 'ui.click', message: 'Zé · 500 €' }), null);
  assert.equal(scrubBreadcrumb({ category: 'touch', data: { label: 'Ana' } }), null);
  assert.deepEqual(scrubBreadcrumb({ category: 'navigation', data: { from: '/hand/h_1?x=2', to: '/bankroll' } }), { category: 'navigation', data: { from: '/hand/:id', to: '/bankroll' } });
});

test('cartas e montantes saem do texto do erro', () => {
  assert.equal(scrubString('bad action for AhKd on Qs7c2d'), 'bad action for [cards] on [cards]');
  assert.equal(scrubString('stack €1.250,50 vs 300 EUR'), 'stack [amount] vs [amount]');
  assert.equal(scrubString('buy-in $ 500 and R$ 99'), 'buy-in [amount] and [amount]');
  // Code and HTTP codes stay readable.
  assert.equal(scrubString('live 500 at Thing.render (index.bundle:12:345)'), 'live 500 at Thing.render (index.bundle:12:345)');
});

test('as variáveis locais das linhas da pilha não saem; ficheiro e linha ficam', () => {
  const e = scrubEvent({
    exception: { values: [{ type: 'Error', value: 'x', stacktrace: { frames: [{ filename: 'app.js', lineno: 3, function: 'save', vars: { hand: { cards: 'AhKd' } } }] } }] },
    contexts: { react: { componentStack: 'at Hand (rui@exemplo.pt)' } },
  }) as { exception: { values: { stacktrace: { frames: Record<string, unknown>[] } }[] }; contexts: { react: { componentStack: string } } };
  assert.deepEqual(e.exception.values[0].stacktrace.frames[0], { filename: 'app.js', lineno: 3, function: 'save' });
  assert.equal(e.contexts.react.componentStack, 'at Hand ([email])');
});

test('chaves com nomes, notas e tokens saem inteiras de extra e contexts; o sistema fica', () => {
  const e = scrubEvent({
    extra: { name: 'Rui', note: 'jogou mal', edit_token: 'x1', player_name: 'Gil', level: 8, nested: { nickname: 'R' } },
    contexts: { session: { name: 'Main Event', notes: 'cansado' }, os: { name: 'iOS', version: '18.1' }, app: { app_name: 'Sweatbook', device_app_hash: 'f00d' } },
    logentry: { message: 'saved for rui@exemplo.pt', params: ['AhKd'] },
    threads: { values: [{ id: 1, stacktrace: { frames: [{ filename: 'a.js', lineno: 1, vars: { hand: 'AhKd' } }] } }] },
  }) as Record<string, any>;
  assert.deepEqual(e.extra, { level: 8, nested: {} });
  assert.deepEqual(e.contexts.session, {});
  assert.deepEqual(e.contexts.os, { name: 'iOS', version: '18.1' });
  assert.deepEqual(e.contexts.app, { app_name: 'Sweatbook' });
  assert.deepEqual(e.logentry, { message: 'saved for [email]', params: ['[cards]'] });
  assert.deepEqual(e.threads.values[0].stacktrace.frames[0], { filename: 'a.js', lineno: 1 });
});
