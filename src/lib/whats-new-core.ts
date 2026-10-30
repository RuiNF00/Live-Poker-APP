// When the home shows the "Novo na versão" card (design/pedido-avaliacao.md §5):
// once, after an update that has an entry, never on a fresh install, gone after
// "Ver tudo", × or 7 days. Pure, so it can be tested.

export interface WhatsNewSeen {
  /** The version whose card was dealt with (or skipped as a fresh install). */
  version?: string;
  /** When the card for `shownFor` first appeared. */
  shownAt?: number;
  shownFor?: string;
}

export const WHATS_NEW_DAYS = 7;

export type WhatsNewStep = { show: boolean; next: WhatsNewSeen | null };

/** `hasEntry`: WHATS_NEW lists this version. `existingUser`: data from before this version (not a fresh install). */
export function whatsNewStep(seen: WhatsNewSeen | null, version: string, hasEntry: boolean, existingUser: boolean, now: number): WhatsNewStep {
  if (seen?.version === version) return { show: false, next: null };
  // Fresh install, or nothing new to tell: remember the version silently.
  if ((!seen && !existingUser) || !hasEntry) return { show: false, next: { version } };
  if (seen?.shownFor === version && seen.shownAt != null) {
    if (now - seen.shownAt >= WHATS_NEW_DAYS * 86_400_000) return { show: false, next: { version } };
    return { show: true, next: null };
  }
  return { show: true, next: { ...seen, shownFor: version, shownAt: now } };
}

/** "1.10.0" after "1.9.2": numbers compared part by part. */
export function versionAtMost(a: string, b: string): boolean {
  const x = a.split('.').map((n) => Number(n) || 0);
  const y = b.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  return true;
}

/**
 * The version an entry is titled with on Novidades. The entry this install announces says the version
 * the player has (1.0.1's entry on 1.1.0 says 1.1.0); a later bugfix with no entry of its own (1.0.2,
 * 1.1.1) doesn't claim it, so the title drops back to the x.y.0 it came with, or the entry's own.
 */
export function releaseTitle(entry: string, isCurrent: boolean, installed: string): string {
  if (!isCurrent) return entry;
  const base = installed.replace(/\.\d+$/, '.0');
  return versionAtMost(base, entry) ? entry : base;
}

/**
 * The release this app version announces: the newest entry at or below it. The store version of an
 * update isn't known when its entry is written (1.0.1 or 1.1.0), so an entry covers the versions
 * after it until the next entry; a phone that skipped a version sees the newest.
 */
export function releaseFor<R extends { version: string }>(releases: readonly R[], version: string): R | undefined {
  return releases.filter((r) => versionAtMost(r.version, version)).sort((a, b) => (versionAtMost(a.version, b.version) ? 1 : -1))[0];
}
