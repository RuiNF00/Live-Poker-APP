// Recovery code format for the cloud backup. Pure, so it can be tested.

export const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

export interface CloudState {
  id: string;
  secret: string;
  lastAt?: number;
  /** What the server copy held after the last upload or restore from this phone. */
  counts?: Partial<Record<string, number>>;
  /** exportedAt of the copy this phone last uploaded or restored: a different one on the server was written by another phone. */
  sent?: number;
  /** Size of the last copy this phone uploaded (sealed bytes), for the warning before the server limit. */
  bytes?: number;
  /** The server copy this phone wrote or restored was deleted (another phone's «Apagar tudo», the website): never written again with this code. */
  gone?: boolean;
  /** Last upload that failed, and why ('network', 'quota'…); cleared by the next one that works. */
  failedAt?: number;
  failure?: string;
  /** The player said they keep the code somewhere (or typed it to restore). Until then Settings reminds them. */
  saved?: boolean;
  /** Another phone or tablet uses this code (its copy was seen on the server, or this one joined it): from then on this one also reads the copy when it opens. */
  shared?: boolean;
  /** exportedAt of the last server copy from another device already joined in here: the same one is not joined again. */
  seen?: number;
  /** Last time this phone read the server copy (to sync or before an upload). */
  checkedAt?: number;
  /** Last time this phone and the server copy were known to hold the same: after an upload, or a read with nothing to send. */
  syncedAt?: number;
  /** The last upload came from a read, not from a change made here: the next read doesn't answer with another (two phones' merges could bounce a copy back and forth). */
  echo?: boolean;
}

/** formatCode as a link: the iPhone camera opens the app with it (sweatbook://sync#…). The code sits in the fragment. */
export function syncLink(c: Pick<CloudState, 'id' | 'secret'>): string {
  return `sweatbook://sync#${c.id}${c.secret}`;
}

/** rl.cloud.v1 as saved: every field kept as it is, whichever build wrote it. */
export function parseCloud(raw: string | null): CloudState | null {
  return raw ? (JSON.parse(raw) as CloudState) : null;
}

/** XXXXX-XXXXX-XXXXXXXXXXXXXXXX */
export function formatCode(c: CloudState): string {
  return `${c.id.slice(0, 5)}-${c.id.slice(5)}-${c.secret}`;
}

/** Accepts the code with or without dashes or spaces, any case; Crockford look-alikes fixed. */
export function parseCode(raw: string): CloudState | null {
  const s = raw
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (s.length !== 26 || [...s].some((ch) => !ALPHA.includes(ch))) return null;
  return { id: s.slice(0, 10), secret: s.slice(10) };
}

// A code that arrived in a link (the QR read by the camera, or a link someone sent) waits here, in
// memory, for the join screen: never in the route (/devices?code=), where navigation history and
// logs keep it. Taken once.
let linked: Pick<CloudState, 'id' | 'secret'> | null = null;

export function setLinkedCode(c: Pick<CloudState, 'id' | 'secret'> | null): void {
  linked = c;
}

export function takeLinkedCode(): Pick<CloudState, 'id' | 'secret'> | null {
  const c = linked;
  linked = null;
  return c;
}
