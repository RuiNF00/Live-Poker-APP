import { describe, expect, it } from 'vitest';
import { holdResult, parseSnapshot, RESULT_DELAY_MS, type LiveSnapshot } from '../src/lib/live-snapshot';

const base = {
  v: 1, player: 'Rui', kind: 'mtt', name: 'Main Event', venue: 'Casino Estoril', currency: '€', startedAt: 1_700_000_000_000,
  endedAt: null, playedMs: 3_600_000, paused: false, level: 12, sb: 400, bb: 800, ante: 800, stack: 45000,
  stackLog: [{ t: 1, stack: 30000 }, { t: 2, stack: 45000 }], buyIn: 150, entries: 1, addOn: 0, invested: 150,
  cashOut: 0, finish: null, field: null, stage: 'mid', sold: 30, hands: 4, updatedAt: 1_700_000_100_000,
};

describe('parseSnapshot', () => {
  it('keeps a valid snapshot as is', () => {
    expect(parseSnapshot(base)).toEqual(base);
  });
  it('drops anything that is not a known field', () => {
    const s = parseSnapshot({ ...base, notes: 'read on seat 3', backers: [{ name: 'João' }], roster: ['Zé'] });
    expect(JSON.stringify(s)).not.toMatch(/seat 3|João|Zé/);
  });
  it('cuts strings and refuses bad numbers', () => {
    const s = parseSnapshot({ ...base, name: 'x'.repeat(500), stack: Infinity, sold: 300, stage: '<script>', stackLog: [{ t: 'a', stack: 1 }, { t: 3, stack: 9 }] });
    expect(s).not.toBe(null);
    if (!s || s === 'offensive') return;
    expect(s.name.length).toBe(80);
    expect(s.stack).toBe(0);
    expect(s.sold).toBe(0);
    expect(s.stage).toBe(null);
    expect(s.stackLog).toEqual([{ t: 3, stack: 9 }]);
  });
  it('caps the stack history', () => {
    const s = parseSnapshot({ ...base, stackLog: Array.from({ length: 500 }, (_, i) => ({ t: i, stack: i })) });
    expect(s && s !== 'offensive' && s.stackLog.length).toBe(120);
  });
  it('rejects what is not a snapshot', () => {
    expect(parseSnapshot(null)).toBe(null);
    expect(parseSnapshot({ ...base, v: 2 })).toBe(null);
    expect(parseSnapshot({ ...base, kind: 'spin' })).toBe(null);
    expect(parseSnapshot({ ...base, startedAt: 'today' })).toBe(null);
  });
  it('blocks offensive public names', () => {
    expect(parseSnapshot({ ...base, name: 'Torneio do caralho' })).toBe('offensive');
  });
});

describe('holdResult', () => {
  const ended = { ...base, endedAt: 1_700_000_000_000, cashOut: 52_000, finish: 3, field: 412 } as LiveSnapshot;
  it('hides the prize and place for an hour after the end', () => {
    const s = holdResult(ended, ended.endedAt! + 10 * 60_000);
    expect(s.cashOut).toBe(0);
    expect(s.finish).toBe(null);
    expect(s.field).toBe(null);
    expect(s.heldUntil).toBe(ended.endedAt! + RESULT_DELAY_MS);
  });
  it('shows it after that, and never touches a running session', () => {
    expect(holdResult(ended, ended.endedAt! + RESULT_DELAY_MS)).toEqual(ended);
    expect(holdResult(base as LiveSnapshot, 0)).toEqual(base);
  });
});
