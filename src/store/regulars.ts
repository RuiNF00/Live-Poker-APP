// The regulars of a card room: players you have notes on and have met there,
// read from your own hands (the session's venue, or the hand's). Nothing new
// is stored and nothing leaves the phone. Pure, so it can be tested.

import type { Hand } from '@/poker/types';

import type { PlayerNote, Session } from './types';

/** "Casino Lisboa", " casino  lisboa " and "Casíno Lisboa" are the same room. */
export function venueKey(v: string | undefined): string {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** A note worth showing: it says something (tags, a read, how to spot them). */
const hasRead = (p: PlayerNote) => p.tags.length > 0 || !!p.notes.trim() || !!p.look.trim();

/**
 * Player notes met at `venue`, the one seen there most recently first. A hand
 * belongs to its session's room, or to the room typed on the hand. Players are
 * matched by their note id or, for older hands, by name (as the notes screen does).
 */
export function regularsAt(
  venue: string,
  hands: readonly Pick<Hand, 'createdAt' | 'sessionId' | 'game' | 'players' | 'hero'>[],
  sessions: readonly Pick<Session, 'id' | 'venue'>[],
  players: readonly PlayerNote[],
): PlayerNote[] {
  const key = venueKey(venue);
  if (!key) return [];
  const roomOf = new Map(sessions.map((s) => [s.id, venueKey(s.venue)]));
  const byId = new Map(players.map((p) => [p.id, p]));
  const byName = new Map(players.filter((p) => p.name.trim()).map((p) => [p.name.trim().toLowerCase(), p]));
  const seen = new Map<string, number>();
  for (const h of hands) {
    const room = (h.sessionId && roomOf.get(h.sessionId)) || venueKey(h.game.venue);
    if (room !== key) continue;
    h.players.forEach((x, i) => {
      if (i === h.hero) return;
      const p = (x.playerId && byId.get(x.playerId)) || (x.name.trim() ? byName.get(x.name.trim().toLowerCase()) : undefined);
      if (p && hasRead(p)) seen.set(p.id, Math.max(seen.get(p.id) ?? 0, h.createdAt));
    });
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id)!);
}
