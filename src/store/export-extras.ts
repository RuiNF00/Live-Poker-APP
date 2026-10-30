// "Exportar tudo" (Settings and Exportar): the backup plus what lives in its own stores on this
// phone and the backup doesn't carry: action packages sent to backers, hand sets, coach links and
// drill progress. Under `alsoOnThisPhone`, which a restore ignores, so the file still imports.
// The cloud copy is left as it is.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BackupData } from './backup';

export const EXTRA_KEYS = {
  actionOffers: 'rl.actionOffers.v2',
  handSets: 'rl.packs.v1',
  coachLinks: 'rl.coach.v1',
  drill: 'rl.drill.v1',
} as const;

/** The backup with the extras that are there; a store never written, or unreadable, is left out. */
export function withExtras(backup: BackupData, raw: readonly (readonly [string, string | null])[]): BackupData & { alsoOnThisPhone?: Record<string, unknown> } {
  const byKey = new Map(raw);
  const extra: Record<string, unknown> = {};
  for (const [name, key] of Object.entries(EXTRA_KEYS)) {
    const v = byKey.get(key);
    if (!v) continue;
    try {
      extra[name] = JSON.parse(v);
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
