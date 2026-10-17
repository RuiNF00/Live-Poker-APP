// Hand packs (/p/<id>): several shared hands behind one link. Shapes and input checks.

export const MAX_PACK_HANDS = 30;
export const PACK_ID_RE = /^[a-f0-9]{12}$/;
export const OWNER_RE = /^[a-f0-9]{64}$/;
export const SHARE_ID_RE = /^[A-Za-z0-9]{3,20}$/;

export interface PackRecord {
  id: string;
  title: string;
  handIds: string[];
  hideAmounts: boolean;
  createdAt: string;
}

export interface PackHandClaim {
  id: string;
  token: string;
}

/** The app's list of { id, token } (share id and its edit token), deduplicated, in order, capped. */
export function parsePackHands(x: unknown): PackHandClaim[] {
  if (!Array.isArray(x)) return [];
  const seen = new Set<string>();
  const out: PackHandClaim[] = [];
  for (const h of x) {
    const { id, token } = (h ?? {}) as { id?: unknown; token?: unknown };
    if (typeof id !== 'string' || !SHARE_ID_RE.test(id) || typeof token !== 'string' || token.length < 8 || token.length > 128 || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, token });
    if (out.length === MAX_PACK_HANDS) break;
  }
  return out;
}
