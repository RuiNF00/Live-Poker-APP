// "Mãos partilhadas": the hands friends sent you (kept when you open their link in the app) and how
// many comments on them, and on your own shared hands, you haven't seen yet. Pure, no I/O.

export interface FriendHand {
  /** Share id (sweatbook.poker/h/<id>). */
  id: string;
  title: string;
  /** Hero's hole cards, so the row looks like the hand. */
  cards?: string[];
  openedAt: number;
}

/** Comments seen per share id. */
export type Seen = Record<string, number>;

export const MAX_FRIEND_HANDS = 100;

const ID = /^[A-Za-z0-9_-]{4,32}$/;
const CARD = /^[2-9TJQKA][shdc]$/;

const cardsOf = (x: unknown): { cards?: string[] } => (Array.isArray(x) && x.length === 2 && x.every((c) => typeof c === 'string' && CARD.test(c)) ? { cards: x as string[] } : {});

export function parseFriendHands(x: unknown): FriendHand[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((h): h is FriendHand => !!h && typeof h === 'object' && ID.test((h as FriendHand).id) && Number.isFinite((h as FriendHand).openedAt))
    .map((h) => ({ id: h.id, title: typeof h.title === 'string' ? h.title.slice(0, 120) : '', ...cardsOf(h.cards), openedAt: h.openedAt }))
    .slice(0, MAX_FRIEND_HANDS);
}

export function parseSeen(x: unknown): Seen {
  if (!x || typeof x !== 'object') return {};
  return Object.fromEntries(Object.entries(x as Record<string, unknown>).filter(([k, v]) => ID.test(k) && Number.isInteger(v) && (v as number) >= 0)) as Seen;
}

/** Opened again: back to the top, with the latest title. The oldest drop off past the cap. */
export function remember(list: FriendHand[], h: { id: string; title: string; cards?: string[] }, now: number): FriendHand[] {
  return [{ id: h.id, title: h.title.slice(0, 120), ...cardsOf(h.cards), openedAt: now }, ...list.filter((x) => x.id !== h.id)].slice(0, MAX_FRIEND_HANDS);
}

/** New comments per hand: what the server counts now, less what this phone has shown. */
export function unseen(counts: Record<string, number>, seen: Seen): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(counts)) if (n > (seen[id] ?? 0)) out[id] = n - (seen[id] ?? 0);
  return out;
}

export const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

/** Where the newest of the `n` new comments is: the street to open the hand on (null = the whole hand). */
export function streetOfNew<S extends string>(comments: { street?: S | null; createdAt: number }[], n: number): S | null {
  if (!(n > 0)) return null;
  const fresh = [...comments].sort((a, b) => a.createdAt - b.createdAt).slice(-n);
  for (let i = fresh.length - 1; i >= 0; i--) if (fresh[i].street) return fresh[i].street!;
  return null;
}

/** One tap from the home card: straight to the hand when only one has news, else the list. */
export function newsTarget(fresh: Record<string, number>, mine: { id: string; shareId?: string }[]): { kind: 'mine' | 'friend'; id: string; n: number } | null {
  const ids = Object.keys(fresh);
  if (ids.length !== 1) return null;
  const own = mine.find((h) => h.shareId === ids[0]);
  return own ? { kind: 'mine', id: own.id, n: fresh[ids[0]] } : { kind: 'friend', id: ids[0], n: fresh[ids[0]] };
}

/**
 * Why a shared hand didn't open: the server said it isn't there (404, 410), or it couldn't be
 * reached (no signal, a timeout, a server error). Only the first is "this hand no longer exists".
 */
export function handLoadError(e: unknown): 'gone' | 'offline' {
  const m = /^fetch (\d{3})$/.exec(e instanceof Error ? e.message : '');
  return m && (m[1] === '404' || m[1] === '410') ? 'gone' : 'offline';
}
