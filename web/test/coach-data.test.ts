import { describe, expect, it } from 'vitest';
import { expiryFrom, OWNER_RE, parseComment, stripPrivate, TOKEN_RE } from '../src/lib/coach-data';

describe('coach links', () => {
  it('keeps a well-formed comment and drops the rest', () => {
    expect(parseComment({ handId: 'h1', stepIndex: 4, mark: 'mistake', name: ' Ana ', body: ' Fold. ', extra: 1 })).toEqual({ handId: 'h1', stepIndex: 4, mark: 'mistake', name: 'Ana', body: 'Fold.', key: null });
    expect(parseComment({ handId: 'h1', name: 'Ana', body: 'x', key: 'local-abc123' })?.key).toBe('local-abc123');
    expect(parseComment({ handId: 'h1', name: 'Ana', body: 'x', key: 'bad key!' })?.key).toBeNull();
    expect(parseComment({ handId: 'h1', stepIndex: -1, mark: 'great', name: 'Ana', body: 'x' })).toMatchObject({ stepIndex: null, mark: null });
    expect(parseComment({ handId: '../h1', name: 'Ana', body: 'x' })).toBeNull();
    expect(parseComment({ handId: 'h1', name: '', body: 'x' })).toBeNull();
    expect(parseComment({ handId: 'h1', name: 'Ana', body: '   ' })).toBeNull();
    expect(parseComment('nope')).toBeNull();
  });

  it('replies from the player never carry a mark', () => {
    expect(parseComment({ handId: 'h1', mark: 'good', name: 'Rui', body: 'ok' }, false)?.mark).toBeNull();
  });

  it('caps the expiry between 1 and 365 days, or none', () => {
    const now = Date.UTC(2026, 9, 17);
    expect(expiryFrom(30, now)).toBe(new Date(now + 30 * 86400000).toISOString());
    expect(expiryFrom(9999, now)).toBe(new Date(now + 365 * 86400000).toISOString());
    expect(expiryFrom(0, now)).toBeNull();
    expect(expiryFrom('7', now)).toBeNull();
  });

  it('only accepts tokens in the shape the server issues', () => {
    expect(TOKEN_RE.test('f52668a690418bee4f6fffefa10f57f4')).toBe(true);
    expect(TOKEN_RE.test('F52668A690418BEE4F6FFFEFA10F57F4')).toBe(false);
    expect(OWNER_RE.test('a'.repeat(64))).toBe(true);
    expect(OWNER_RE.test('a'.repeat(63))).toBe(false);
  });
});

describe('stripPrivate', () => {
  it('drops session, share, voice, folders and player ids, keeps the rest', () => {
    const out = stripPrivate({ id: 'h1', sessionId: 's', shareToken: 't', shareId: 'x', voiceNote: 'file://a', folders: ['f'], notes: 'n', players: [{ name: 'Ana', playerId: 'p1', stack: 1 }] }) as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual(['id', 'notes', 'players']);
    expect(out.players).toEqual([{ name: 'Ana', stack: 1 }]);
    expect(stripPrivate(null)).toBe(null);
    const g = stripPrivate({ id: 'h2', game: { kind: 'mtt', name: 'Main Event', buyIn: 100, venue: 'Estoril', sb: 1, bb: 2 } }) as { game: Record<string, unknown> };
    expect(g.game).toEqual({ kind: 'mtt', name: 'Main Event', sb: 1, bb: 2 });
  });
});
