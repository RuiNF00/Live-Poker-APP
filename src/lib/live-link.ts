// Live link for backers: a public page (sweatbook.poker/live/<id>) that follows
// a session as it is played. The app sends a small snapshot whenever the session
// changes; the page polls it. Opt-in per session, and the player can remove it.
//
// Only what a backer needs goes out: no notes, no table roster, no backer names
// or amounts, no hands, and the venue only when the player chooses to show it.

import { cost, isPaused, playedMs, soldShare } from '@/store/session-math';
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
  hands: number;
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
    updatedAt: now,
  };
}

/** What changed for a backer: the clock alone doesn't count (the page runs its own). */
export function snapshotKey(x: LiveSnapshot): string {
  const { playedMs: _p, updatedAt: _u, ...rest } = x;
  return JSON.stringify(rest);
}

export function liveUrl(id: string): string {
  return `${BRAND.webUrl}/live/${id}`;
}

export async function createLive(snap: LiveSnapshot): Promise<{ id: string; token: string }> {
  const res = await fetch(`${API}/api/live`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ snapshot: snap }),
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
  const res = await fetch(`${API}/api/live/${encodeURIComponent(id)}`, { headers: { 'cache-control': 'no-store' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('live ' + res.status);
  const j = (await res.json()) as { snapshot: LiveSnapshot; updatedAt: string };
  return { snapshot: j.snapshot, updatedAt: Date.parse(j.updatedAt) };
}
