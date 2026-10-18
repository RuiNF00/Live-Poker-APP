// A link whose page the server keeps but cannot read: sweatbook.poker/b#s=<id>.<key>.
// The app seals the page with AES-256-GCM under a key that only rides in the URL
// fragment (browsers never send it), and the page opens it in the browser
// (web/src/lib/sealed.ts, WebCrypto). The cipher comes from backup-crypto, loaded on
// the first seal: a module two lazy chunks share would land in the launch bundle. The id is bound in as associated data, so a
// sealed page can't be moved under another link. Pure, so it can be tested.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function b64url(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '') + (i + 2 < b.length ? B64[n & 63] : '');
  }
  return s;
}

export function fromB64url(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (i + k < s.length ? B64.indexOf(s[i + k]) : 0));
    if (v.some((x) => x < 0)) throw new Error('b64');
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    out.push((n >> 16) & 255);
    if (i + 2 < s.length) out.push((n >> 8) & 255);
    if (i + 3 < s.length) out.push(n & 255);
  }
  return Uint8Array.from(out);
}

function enc(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

function dec(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const x = b[i++];
    let c: number;
    if (x < 0x80) c = x;
    else if (x < 0xe0) c = ((x & 31) << 6) | (b[i++] & 63);
    else if (x < 0xf0) c = ((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else c = ((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(c);
  }
  return s;
}

/** What the server stores: the nonce and the ciphertext (with its tag), base64url. */
export interface Sealed {
  v: 1;
  n: string;
  c: string;
}

const aad = (id: string) => enc(`sweatbook-b:${id}`);

/** `key`: 32 bytes, base64url (43 chars). `nonce`: 12 fresh random bytes per seal. */
export async function seal(data: unknown, id: string, key: string, nonce: Uint8Array): Promise<Sealed> {
  const { gcm } = await import('./backup-crypto');
  const c = gcm(fromB64url(key), nonce, aad(id)).encrypt(enc(JSON.stringify(data)));
  return { v: 1, n: b64url(nonce), c: b64url(c) };
}

/** The data, or null when the key, the id or the bytes don't match. */
export async function open(x: Sealed, id: string, key: string): Promise<unknown> {
  const { gcm } = await import('./backup-crypto');
  try {
    return JSON.parse(dec(gcm(fromB64url(key), fromB64url(x.n), aad(id)).decrypt(fromB64url(x.c))));
  } catch {
    return null;
  }
}

/** The fragment of a sealed link, after '#'. */
export const sealedFragment = (id: string, key: string) => `s=${id}.${key}`;
