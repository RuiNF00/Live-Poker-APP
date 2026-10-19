// Push-to-end: which Live Activity to end when a session ends on another phone.
// The server only ever sees an opaque slot, HMAC(backup key, session id): not the
// session id, nor anything about the session. Pure, so it can be tested.

import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

/** 32 hex chars; the same on every phone with the same recovery code. */
export function liveSlot(enc: Uint8Array, sessionId: string): string {
  return bytesToHex(hmac(sha256, enc, utf8ToBytes(`live-end:${sessionId}`))).slice(0, 32);
}

/** Sessions that were running before and are now ended or gone: their Live Activities end everywhere. */
export function endedSince(before: { id: string; endedAt?: number }[], after: { id: string; endedAt?: number }[]): string[] {
  const now = new Map(after.map((s) => [s.id, s]));
  return before.filter((s) => !s.endedAt && (!now.has(s.id) || now.get(s.id)!.endedAt)).map((s) => s.id);
}
