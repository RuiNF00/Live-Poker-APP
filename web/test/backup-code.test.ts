import { hkdfSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authKey, parseCode } from '../src/lib/backup-code';

// The app derives the key with @noble/hashes hkdf (src/lib/backup-crypto.ts); Node's own HKDF is
// an independent reference for the same RFC 5869 output.
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const reference = (secret: string) =>
  [...new Uint8Array(hkdfSync('sha256', secret.toUpperCase(), 'sweatbook-backup-v1', 'auth', 16))].map((b) => ALPHA[b & 31]).join('');

describe('deleting a backup from the browser', () => {
  it('reads the code like the app: dashes, spaces, case and look-alikes', () => {
    expect(parseCode('ab1cd-ef2gh-jkmnpqrstvwxyz34')).toEqual({ id: 'AB1CDEF2GH', secret: 'JKMNPQRSTVWXYZ34' });
    expect(parseCode('oiL23-45678-9abcdefghjkmnpqr')).toEqual({ id: '0112345678', secret: '9ABCDEFGHJKMNPQR' });
    expect(parseCode('too-short')).toBeNull();
    expect(parseCode('UUUUUUUUUUUUUUUUUUUUUUUUUU')).toBeNull();
  });

  it('derives the same auth key the app sends', async () => {
    for (const s of ['JKMNPQRSTVWXYZ34', '0123456789ABCDEF', 'zyxwvtsrqpnmkjhg']) expect(await authKey(s)).toBe(reference(s));
  });
});
