// A sealed page (sweatbook.poker/b#s=<id>.<key>): the server stores it, the browser
// opens it. Same format as the app's src/lib/sealed-link.ts (AES-256-GCM, 12-byte
// nonce, the tag at the end, "sweatbook-b:<id>" as associated data), opened here with
// WebCrypto so the page needs no library. The key never leaves the fragment.

export interface Sealed {
  v: 1;
  n: string;
  c: string;
}

const B64URL = /^[A-Za-z0-9_-]+$/;

/** What the server accepts and stores: the shape only, it can't read the rest. */
export function parseSealed(x: unknown): Sealed | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (o.v !== 1 || typeof o.n !== 'string' || typeof o.c !== 'string') return null;
  if (o.n.length !== 16 || !B64URL.test(o.n) || !B64URL.test(o.c) || o.c.length < 22 || o.c.length > 60000) return null;
  return { v: 1, n: o.n, c: o.c };
}

/** `s=<id>.<key>` from a link's fragment, or null when it isn't a sealed link. */
export function sealedRef(hash: string): { id: string; key: string } | null {
  const m = /^#?s=([A-Za-z0-9]{6,16})\.([A-Za-z0-9_-]{43})$/.exec(hash.trim());
  return m ? { id: m[1], key: m[2] } : null;
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The data, or null when the key, the id or the bytes don't match. */
export async function openSealed(x: Sealed, id: string, key: string): Promise<unknown> {
  try {
    const k = await crypto.subtle.importKey('raw', fromB64url(key), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(x.n), additionalData: new TextEncoder().encode(`sweatbook-b:${id}`) }, k, fromB64url(x.c));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}
