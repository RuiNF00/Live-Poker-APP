// The invite code inside whatever the friend pasted: the /r/<code> link the invite page
// copies when they tap the App Store button, a link with ?r=, or the bare code.

/** Server-minted (8 chars, no 0/O/1/I) or app-minted (10 hex chars). Same rule as web/src/lib/refcode.ts. */
const CODE = /^(?:[A-HJ-NP-Z2-9]{8}|[0-9a-f]{10})$/;

function normalize(raw: string): string | null {
  const s = raw.trim();
  const code = s.length === 10 ? s.toLowerCase() : s.toUpperCase();
  return CODE.test(code) ? code : null;
}

export function inviteCodeFrom(text: string): string | null {
  const s = text.trim().slice(0, 300);
  const inLink = /\/r\/([A-Za-z0-9]{8,10})(?=[/?#\s]|$)/.exec(s)?.[1] ?? /[?&]r=([A-Za-z0-9]{8,10})(?=[&#\s]|$)/.exec(s)?.[1];
  return normalize(inLink ?? s);
}
