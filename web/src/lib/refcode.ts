// Invite code formats, shared by pages and API routes.

/** Server-minted (8 chars, no 0/O/1/I) or app-minted (10 hex chars, the app's ?r= on share links). */
export const CODE_RE = /^(?:[A-HJ-NP-Z2-9]{8}|[0-9a-f]{10})$/;

/** Canonical form (length tells them apart): app hex codes lower-case, server codes upper-case. */
export function normalizeCode(raw: string): string | null {
  const s = raw.trim();
  const code = s.length === 10 ? s.toLowerCase() : s.toUpperCase();
  return CODE_RE.test(code) ? code : null;
}
