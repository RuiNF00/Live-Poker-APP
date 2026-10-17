import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { APP_EVENTS } from '../src/lib/store';

const root = join(__dirname, '..', '..');
const quoted = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

/** The app's FunnelEvent union, from src/lib/events.ts. */
function appEvents(): string[] {
  const src = readFileSync(join(root, 'src/lib/events.ts'), 'utf8');
  return quoted(src.slice(src.indexOf('export type FunnelEvent'), src.indexOf(';', src.indexOf('export type FunnelEvent'))));
}

/** The event list in the newest migration that rebuilds app_events_event_check. */
function dbEvents(): string[] {
  const dir = join(root, 'supabase/migrations');
  const last = readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && readFileSync(join(dir, f), 'utf8').includes('add constraint app_events_event_check'))
    .sort()
    .at(-1)!;
  const sql = readFileSync(join(dir, last), 'utf8');
  return quoted(sql.slice(sql.indexOf('add constraint app_events_event_check')));
}

describe('funnel events', () => {
  it('every event the app sends is accepted by the API (else it is dropped with 422)', () => {
    const missing = appEvents().filter((e) => !(APP_EVENTS as readonly string[]).includes(e));
    expect(missing).toEqual([]);
  });

  it('the database accepts exactly the events the API accepts', () => {
    expect([...dbEvents()].sort()).toEqual([...APP_EVENTS].sort());
  });
});
