// The last way out when the app can't even open (the root crash screen): the
// player's records copied straight from storage, as they are, into a file the
// player shares themselves (Files, Drive, an email to support). Nothing is
// parsed, so data that crashes the app still comes out. Only the player's
// records, never the app's own keys (the cloud copy's key, coach and invite
// codes, the outbox). Pure (storage is passed in) so the tests run it in Node.

import { KEYS, QUARANTINE, SPECS } from './boot';
import type { KV } from './persist';

/** The other stores the backup carries (swaps, festival plans and own festivals, weekly tournaments). */
const OTHER_LISTS = [
  { index: 'rl.swaps.v1', prefix: 'rl.swap.v1.' },
  { index: 'rl.swapgroups.v1', prefix: 'rl.swapgroup.v1.' },
];
const OTHER_VALUES = ['rl.festivalPlans.v1', 'rl.myFestivals.v1', 'rl.weekly.v1'];

/** True for a key that holds the player's own records (hands, sessions, notes, bankroll, staking, settings…). */
export function isRecordKey(key: string): boolean {
  if (key.startsWith(QUARANTINE)) return true;
  if (key === KEYS.settings || key === KEYS.draft || OTHER_VALUES.includes(key)) return true;
  for (const s of [...Object.values(SPECS), ...OTHER_LISTS]) {
    if (key === s.index || key.startsWith(s.prefix)) return true;
    if ('legacy' in s && key === s.legacy) return true;
  }
  return false;
}

/** Every record key with its raw value. Never rejects: what can't be read is left out. */
export async function readRecords(kv: Pick<KV, 'getAllKeys' | 'multiGet' | 'getItem'>): Promise<[string, string][]> {
  let keys: string[];
  try {
    keys = (await kv.getAllKeys()).filter(isRecordKey).sort();
  } catch {
    return [];
  }
  if (!keys.length) return [];
  const keep = (rows: readonly (readonly [string, string | null])[]) => rows.filter((r): r is [string, string] => r[1] != null).map(([k, v]): [string, string] => [k, v]);
  try {
    return keep(await kv.multiGet(keys));
  } catch {
    // One value too big to read (Android) fails the whole batch: one by one, the rest still comes out.
    const rows = await Promise.all(keys.map((k) => kv.getItem(k).then((v) => [k, v] as const, () => [k, null] as const)));
    return keep(rows);
  }
}

export function rescueFile(records: [string, string][], meta: { version: string; platform: string }, now = Date.now()): string {
  return JSON.stringify({ app: 'sweatbook', kind: 'rescue', version: meta.version, platform: meta.platform, exportedAt: now, records: records.map(([key, raw]) => ({ key, raw })) }, null, 2);
}
