// Decides how a hand gets its share link when the player taps Share, so a hand
// never has two public copies: one upload at a time, and a link made in the
// background is reused instead of uploading again. Pure, testable.

export type ShareLink = { shareId: string; shareToken: string };
export interface QueueState {
  waiting: string[];
  ready: Record<string, ShareLink>;
}

export type Slot =
  /** A link was made in the background: use it. */
  | { kind: 'ready'; link: ShareLink }
  /** The queued upload is being sent right now: wait for it, don't upload again. */
  | { kind: 'busy' }
  /** Nothing pending (or the pending job was cancelled before it went out): upload now. */
  | { kind: 'upload' };

/**
 * `cancelled` says whether the queued upload for this hand was taken out of the
 * outbox before it was sent. Mutates `s` to match the decision.
 */
export function takeSlot(s: QueueState, handId: string, cancelled: boolean): Slot {
  const link = s.ready[handId];
  if (link) {
    delete s.ready[handId];
    s.waiting = s.waiting.filter((id) => id !== handId);
    return { kind: 'ready', link };
  }
  if (s.waiting.includes(handId) && !cancelled) return { kind: 'busy' };
  s.waiting = s.waiting.filter((id) => id !== handId);
  return { kind: 'upload' };
}
