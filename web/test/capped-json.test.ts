import { describe, expect, it } from 'vitest';

import { cappedJson } from '../src/lib/coach-data';

const req = (body: string, headers: Record<string, string> = {}) => new Request('https://x.test/api', { method: 'POST', body, headers });

describe('cappedJson', () => {
  it('reads JSON up to the cap', async () => {
    expect(await cappedJson(req('{"a":1}'), 100)).toEqual({ a: 1 });
  });
  it('stops past the cap even when content-length is missing or lies', async () => {
    const big = JSON.stringify({ a: 'x'.repeat(500) });
    expect(await cappedJson(req(big), 100)).toBe('too_big');
    expect(await cappedJson(req(big, { 'content-length': '10' }), 100)).toBe('too_big');
  });
  it('null when it is not JSON', async () => {
    expect(await cappedJson(req('nope'), 100)).toBeNull();
  });
});
