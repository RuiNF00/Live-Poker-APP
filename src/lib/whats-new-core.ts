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
