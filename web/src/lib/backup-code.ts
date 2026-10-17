// The cloud backup's recovery code, for deleting a backup from the browser without the app.
// Mirrors the app (src/lib/cloud-code.ts and backup-crypto.ts): the code splits into the backup
// id and a secret; only an auth key derived from the secret goes to the server, so the secret
// (which also decrypts the backup) never leaves the browser. WebCrypto HKDF, same output as the
// app's @noble/hashes hkdf.

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
const SALT = new TextEncoder().encode('sweatbook-backup-v1');

/** With or without dashes or spaces, any case; Crockford look-alikes fixed. */
export function parseCode(raw: string): { id: string; secret: string } | null {
  const s = raw.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if (s.length !== 26 || [...s].some((ch) => !ALPHA.includes(ch))) return null;
  return { id: s.slice(0, 10), secret: s.slice(10) };
}

/** The x-backup-key the server checks: 16 base32 chars from HKDF-SHA256(secret, 'auth'). */
export async function authKey(secret: string): Promise<string> {
  const ikm = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret.toUpperCase()), 'HKDF', false, ['deriveBits']);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: new TextEncoder().encode('auth') }, ikm, 128),
  );
  let out = '';
  for (const b of bits) out += ALPHA[b & 31];
  return out;
}
