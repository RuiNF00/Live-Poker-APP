// Push-to-end: which sessions just ended. Apart from live-end-slot.ts so the lock screen can ask this
// at launch without loading the HMAC (noble), which comes with the backup ciphers when a slot is needed.

/** Sessions that were running before and are now ended or gone: their Live Activities end everywhere. */
export function endedSince(before: { id: string; endedAt?: number }[], after: { id: string; endedAt?: number }[]): string[] {
  const now = new Map(after.map((s) => [s.id, s]));
  return before.filter((s) => !s.endedAt && (!now.has(s.id) || now.get(s.id)!.endedAt)).map((s) => s.id);
}
