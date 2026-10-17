// Recovery code format for the cloud backup. Pure, so it can be tested.

export const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

export interface CloudState {
  id: string;
  secret: string;
  lastAt?: number;
  /** What the server copy held after the last upload or restore from this phone. */
  counts?: Partial<Record<string, number>>;
  /** Last upload that failed, and why ('network', 'quota'…); cleared by the next one that works. */
  failedAt?: number;
  failure?: string;
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
