// Live link for backers: a public page (sweatbook.poker/live/<id>) that follows
// a session as it is played. The app sends a small snapshot whenever the session
// changes; the page polls it. Opt-in per session, and the player can remove it.
//
// Only what a backer needs goes out: no notes, no table roster, no backer names
// or amounts, no hands, and the venue only when the player chooses to show it.

import { dayOf, isBagged } from '@/store/multi-day';
import { bountiesOf, cost, isPaused, pieceOf, playedMs, soldShare, stakesOf } from '@/store/session-math';
import type { Session } from '@/store/types';
import { BRAND } from '@/theme';

// Same server as share-api.ts (not imported from there: it pulls in native modules).
const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

export interface LiveSnapshot {
  v: 1;
  player: string;
  kind: Session['kind'];
  name: string;
  venue: string;
  currency: string;
  startedAt: number;
  endedAt: number | null;
  playedMs: number;
  paused: boolean;
  level: number | null;
  sb: number;
  bb: number;
  ante: number;
  stack: number;
  /** Stack over time, at most MAX_POINTS (oldest dropped). */
  stackLog: { t: number; stack: number }[];
  buyIn: number;
  entries: number;
  addOn: number;
  invested: number;
  cashOut: number;
  finish: number | null;
  field: number | null;
  stage: string | null;
  /** % of the action sold, so backers see the size of the whole package. */
  sold: number;
  /**
   * PKO, ended: the part of cashOut the backers have no piece of (bounties that stay with the
   * player), so `sold` × (cashOut − kept) is what they get. Absent when they share every bounty.
   */
  kept?: number;
  /** PKO, ended: all the bounties, inside cashOut; a backer whose link says k=1 has no piece of them. */
  bounties?: number;
  hands: number;
  /** Day of a multi-day tournament, 1-based. */
  day: number;
  /** The day ended with chips in the bag: `stack` is the bagged stack, not a result. */
  bagged: boolean;
  updatedAt: number;
}

export const MAX_POINTS = 120;

const str = (v: string | undefined, n: number) => (v ?? '').trim().slice(0, n);

export function liveSnapshot(s: Session, player: string, hands: number, now = Date.now()): LiveSnapshot {
  return {
    v: 1,
    player: str(player, 40),
    kind: s.kind,
    name: str(s.name, 80),
    venue: s.live?.showVenue ? str(s.venue, 80) : '',
    currency: str(s.currency, 4),
    startedAt: s.startedAt,
    endedAt: s.endedAt ?? null,
    playedMs: playedMs(s, now),
    paused: isPaused(s),
    level: s.level ?? null,
    sb: s.sb,
    bb: s.bb,
    ante: s.ante,
    stack: s.stack,
    stackLog: s.stackLog.slice(-MAX_POINTS).map((p) => ({ t: p.t, stack: p.stack })),
    buyIn: s.buyIn,
    entries: s.entries,
    addOn: s.addOn || 0,
    invested: cost(s),
    cashOut: s.endedAt ? s.cashOut || 0 : 0,
    finish: s.finish ?? null,
    field: s.field ?? null,
    stage: s.stage ?? null,
    sold: Math.round(soldShare(s) * 1000) / 10,
    hands,
    day: dayOf(s),
    bagged: isBagged(s),
    updatedAt: now,
    ...keptOf(s),
    ...(s.endedAt && bountiesOf(s) ? { bounties: Math.round(bountiesOf(s) * 100) / 100 } : null),
  };
}

/** Bounties kept out of the backers' prize, spread over everything sold (only some packages may keep them). */
function keptOf(s: Session): { kept: number } | null {
  const b = s.endedAt ? bountiesOf(s) : 0;
  const sold = soldShare(s);
  if (!b || !sold) return null;
  const keptShare = stakesOf(s).reduce((a, x) => a + (x.bountiesKept ? pieceOf(s, x) : 0), 0);
  return keptShare ? { kept: Math.round(((b * keptShare) / sold) * 100) / 100 } : null;
}

/** What changed for a backer: the clock alone doesn't count (the page runs its own). */
export function snapshotKey(x: LiveSnapshot): string {
  const { playedMs: _p, updatedAt: _u, ...rest } = x;
  return JSON.stringify(rest);
}

export function liveUrl(id: string): string {
  return `${BRAND.webUrl}/live/${id}`;
}

/** `token`: the edit token the app picked for this link (create-key.ts). Sent again after a lost
 *  answer, the server returns the link it already made instead of a second one. */
export async function createLive(snap: LiveSnapshot, token?: string): Promise<{ id: string; token: string }> {
  const res = await fetch(`${API}/api/live`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ snapshot: snap, token }),
  });
  if (!res.ok) throw new Error('live ' + res.status);
  const j = await res.json();
  return { id: j.id, token: j.token };
}

/** False when the link is gone (removed, or expired): stop sending. */
export async function updateLive(live: { id: string; token: string }, snap: LiveSnapshot): Promise<boolean> {
  const res = await fetch(`${API}/api/live/${encodeURIComponent(live.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-edit-token': live.token },
    body: JSON.stringify({ snapshot: snap }),
  });
  if (res.status === 404 || res.status === 403) return false;
  if (!res.ok) throw new Error('live ' + res.status);
  return true;
}

export async function deleteLive(live: { id: string; token: string }): Promise<void> {
  const res = await fetch(`${API}/api/live/${encodeURIComponent(live.id)}`, {
    method: 'DELETE',
    headers: { 'x-edit-token': live.token },
  });
  if (!res.ok && res.status !== 404) throw new Error('live ' + res.status);
}

/** Reads a live page the way a backer's browser does. Null when the link is gone. */
export async function fetchLive(id: string): Promise<{ snapshot: LiveSnapshot; updatedAt: number } | null> {
  const res = await fetch(`${API}/api/live/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('live ' + res.status);
  const j = (await res.json()) as { snapshot: LiveSnapshot; updatedAt: string };
  return { snapshot: j.snapshot, updatedAt: Date.parse(j.updatedAt) };
}
