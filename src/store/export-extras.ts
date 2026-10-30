// "Exportar tudo" (Settings and Exportar): the backup plus what lives in its own stores on this
// phone and the backup doesn't carry: action packages sent to backers, hand sets, coach links and
// drill progress. Under `alsoOnThisPhone`, which a restore ignores, so the file still imports.
// The cloud copy is left as it is. The keys that let this phone edit or delete what it shared
// (a coach link's or hand set's ownerToken, an action link's edit token) stay out of the file:
// it is plain text that travels by mail and chat, and a restore never reads them back.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BackupData } from './backup';

export const EXTRA_KEYS = {
  actionOffers: 'rl.actionOffers.v2',
  handSets: 'rl.packs.v1',
  coachLinks: 'rl.coach.v1',
  drill: 'rl.drill.v1',
} as const;

/** The owner secrets, wherever they sit: `ownerToken`, and the edit `token` of a `remote` link. */
export function withoutSecrets(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutSecrets);
  if (!v || typeof v !== 'object') return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === 'ownerToken') continue;
    if (k === 'remote' && x && typeof x === 'object' && !Array.isArray(x)) {
      const { token: _edit, ...rest } = x as Record<string, unknown>;
      out[k] = withoutSecrets(rest);
      continue;
    }
    out[k] = withoutSecrets(x);
  }
  return out;
}

/** The backup with the extras that are there; a store never written, or unreadable, is left out. */
export function withExtras(backup: BackupData, raw: readonly (readonly [string, string | null])[]): BackupData & { alsoOnThisPhone?: Record<string, unknown> } {
  const byKey = new Map(raw);
  const extra: Record<string, unknown> = {};
  for (const [name, key] of Object.entries(EXTRA_KEYS)) {
    const v = byKey.get(key);
    if (!v) continue;
    try {
      extra[name] = withoutSecrets(JSON.parse(v));
    } catch {
      // A broken store isn't worth failing the whole export over.
    }
  }
  return Object.keys(extra).length ? { ...backup, alsoOnThisPhone: extra } : backup;
}

/** The full export file's contents. */
export async function exportAll(backup: BackupData): Promise<string> {
  const raw = await AsyncStorage.multiGet(Object.values(EXTRA_KEYS)).catch(() => [] as [string, string | null][]);
  return JSON.stringify(withExtras(backup, raw));
}
