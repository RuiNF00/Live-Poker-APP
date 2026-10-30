/// <reference types="node" />
// A tap or a timer that throws: once the app is up, what is waiting is written, the player is told
// once, and the app stays open; errors one after another still close it, after the writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CLOSE_AFTER_MS, STORM, TELL_EVERY_MS, isRenderError, makeGuard } from '../error-guard-core';

function setup(dev = false) {
  const log: string[] = [];
  let clock = 0;
  const timers: { fn: () => void; ms: number }[] = [];
  const g = makeGuard({
    now: () => clock,
    dev,
    fallback: (_e, fatal) => log.push(fatal ? 'close' : 'soft'),
    flush: () => log.push('flush'),
    tell: () => log.push('tell'),
    later: (fn, ms) => timers.push({ fn, ms }),
  });
  return { g, log, timers, tick: (ms: number) => (clock += ms) };
}

test('before the store has loaded, React Native handles the error as before', () => {
  const { g, log } = setup();
  g.handle(new Error('x'), true);
  assert.deepEqual(log, ['close']);
});

test('once up: writes first, tells the player once, and stays open', () => {
  const { g, log, tick } = setup();
  g.setReady(true);
  g.handle(new Error('x'), true);
  assert.deepEqual(log, ['flush', 'tell']);
  tick(2000);
  g.handle(new Error('y'), true);
  assert.deepEqual(log, ['flush', 'tell', 'flush'], 'not told twice in a row');
  tick(TELL_EVERY_MS);
  g.handle(new Error('z'), true);
  assert.deepEqual(log.slice(-2), ['flush', 'tell']);
  assert.ok(!log.includes('close'));
});

test('errors one after another: written, then the app closes once', () => {
  const { g, log, timers, tick } = setup();
  g.setReady(true);
  for (let i = 0; i < STORM + 2; i++) {
    g.handle(new Error('loop'), true);
    tick(100);
  }
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, CLOSE_AFTER_MS);
  assert.ok(!log.includes('close'), 'the writes get time to land');
  timers[0].fn();
  assert.equal(log.filter((x) => x === 'close').length, 1);
  assert.equal(log.filter((x) => x === 'flush').length, STORM + 2);
});

test('errors far apart never add up to closing', () => {
  const { g, timers, tick } = setup();
  g.setReady(true);
  for (let i = 0; i < 20; i++) {
    g.handle(new Error('rare'), true);
    tick(60_000);
  }
  assert.equal(timers.length, 0);
});

test('non-fatal errors and development keep React Native\'s handling (after writing)', () => {
  const a = setup();
  a.g.setReady(true);
  a.g.handle(new Error('soft'), false);
  assert.deepEqual(a.log, ['flush', 'soft']);
  const b = setup(true);
  b.g.setReady(true);
  b.g.handle(new Error('dev'), true);
  assert.deepEqual(b.log, ['flush', 'close']);
});

test('a render error no boundary caught closes as before (after writing): no white screen left open', () => {
  const withStack = Object.assign(new Error('render'), { componentStack: '\n    in HandRow\n    in RootLayout' });
  const flagged = Object.assign(new Error('render'), { isComponentError: true });
  for (const e of [withStack, flagged]) {
    const a = setup();
    a.g.setReady(true);
    a.g.handle(e, true);
    assert.deepEqual(a.log, ['flush', 'close']);
  }
  assert.equal(isRenderError(new Error('tap')), false);
  assert.equal(isRenderError(Object.assign(new Error('x'), { componentStack: '' })), false);
  assert.equal(isRenderError('a string'), false);
  assert.equal(isRenderError(null), false);
  // A tap's error right after still gets the notice: the render error didn't count towards a storm.
  const b = setup();
  b.g.setReady(true);
  b.g.handle(withStack, true);
  b.g.handle(new Error('tap'), true);
  assert.deepEqual(b.log, ['flush', 'close', 'flush', 'tell']);
});

test('a write that throws never stops the rest', () => {
  const log: string[] = [];
  const g = makeGuard({ now: () => 0, dev: false, fallback: () => log.push('close'), flush: () => { throw new Error('disk'); }, tell: () => log.push('tell'), later: () => {} });
  g.setReady(true);
  g.handle(new Error('x'), true);
  assert.deepEqual(log, ['tell']);
});

test('wired in: installed before crash reports, the store writes and says when it is up', () => {
  const layout = readFileSync(new URL('../../app/_layout.tsx', import.meta.url), 'utf8');
  assert.ok(layout.indexOf('installErrorGuard();') > 0 && layout.indexOf('installErrorGuard();') < layout.indexOf('startCrashReports();'));
  const store = readFileSync(new URL('../../store/store.tsx', import.meta.url), 'utf8');
  assert.match(store, /onErrorFlush\(flushAll\)/);
  assert.match(store, /errorGuardReady\(ready\)/);
  // The draft (every tap of hand entry) is part of what is written.
  assert.match(store, /const flushAll = \(\) => \{\s*if \(draftTimer\.current\) flushDraft\(\);/);
});
