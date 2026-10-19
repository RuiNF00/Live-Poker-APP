import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The store is server-only; outside Next that import would throw.
vi.mock('server-only', () => ({}));
const { LocalPages } = await import('../src/lib/backer-pages');

const page = (c: string) => ({ v: 1 as const, n: 'n', c });
const tok = 'a'.repeat(64);

describe('LocalPages versions (Swaps P3, 19 Oct)', () => {
  let dir: string;
  let store: InstanceType<typeof LocalPages>;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'pages-'));
    store = new LocalPages(path.join(dir, 'pages.json'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('a phone with older data cannot replace a newer page', async () => {
    const { id } = await store.create(tok);
    expect(await store.update(id, tok, page('new'), 200)).toBe('ok');
    expect(await store.update(id, tok, page('old'), 100)).toBe('stale');
    expect((await store.get(id))?.sealed?.c).toBe('new');
    // The same version again (a resend) and a newer one are taken.
    expect(await store.update(id, tok, page('again'), 200)).toBe('ok');
    expect(await store.update(id, tok, page('newer'), 300)).toBe('ok');
    expect((await store.get(id))?.sealed?.c).toBe('newer');
  });

  it('an app without versions still updates; a wrong token is refused', async () => {
    const { id } = await store.create(tok);
    expect(await store.update(id, tok, page('v'), 200)).toBe('ok');
    expect(await store.update(id, tok, page('old app'))).toBe('ok');
    // The stored version stays, so an old phone with a version still can't go back.
    expect(await store.update(id, tok, page('old'), 100)).toBe('stale');
    expect((await store.get(id))?.sealed?.c).toBe('old app');
    expect(await store.update(id, 'b'.repeat(64), page('x'), 999)).toBe(false);
    expect(await store.get(id)).not.toHaveProperty('version');
  });
});
