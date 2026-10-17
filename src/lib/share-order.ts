// One order for every Partilhar sheet: Instagram Story, WhatsApp, X, copy link, the other apps.
// The destination used last moves to the top, so a player who always sends to WhatsApp taps it first.

export type ShareKey = 'instagram' | 'whatsapp' | 'x' | 'copy' | 'other';

export const SHARE_ORDER: readonly ShareKey[] = ['instagram', 'whatsapp', 'x', 'copy', 'other'];

export const isShareKey = (v: unknown): v is ShareKey => typeof v === 'string' && (SHARE_ORDER as readonly string[]).includes(v);

/** Keyed options in SHARE_ORDER with `lastUsed` first; options without a key keep their place after them. */
export function orderShare<T extends { key?: ShareKey }>(options: T[], lastUsed: ShareKey | null): T[] {
  const rank = (o: T) => (o.key ? (o.key === lastUsed ? -1 : SHARE_ORDER.indexOf(o.key)) : SHARE_ORDER.length);
  return options
    .map((o, i) => ({ o, i }))
    .sort((a, b) => rank(a.o) - rank(b.o) || a.i - b.i)
    .map((x) => x.o);
}
