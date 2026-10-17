// End-to-end encryption for the cloud backup. The recovery code's secret never
// leaves the phone: the server gets an auth key derived from it (to tell owners
// apart) and an AES-256-GCM sealed blob it cannot read. Pure, so it can be tested.

import { gcm } from '@noble/ciphers/aes';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { Gzip, gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';

import { ALPHA } from './cloud-code';

const SALT = strToU8('sweatbook-backup-v1');

function b32(bytes: Uint8Array, len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHA[bytes[i] & 31];
  return out;
}

/** auth: what the server sees (16 base32 chars, same shape as the secret); enc: the AES key. */
export function deriveKeys(secret: string): { auth: string; enc: Uint8Array } {
  const ikm = strToU8(secret.toUpperCase());
  return {
    auth: b32(hkdf(sha256, ikm, SALT, 'auth', 16), 16),
    enc: hkdf(sha256, ikm, SALT, 'enc', 32),
  };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toB64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return s;
}

export function fromB64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    if (j < out.length) out[j++] = (n >> 16) & 255;
    if (j < out.length) out[j++] = (n >> 8) & 255;
    if (j < out.length) out[j++] = n & 255;
  }
  return out;
}

interface Sealed {
  sweatbook: 'backup';
  v: 1;
  alg: 'A256GCM';
  n: string;
  c: string;
}

function envelope(zipped: Uint8Array, key: Uint8Array, nonce: Uint8Array): string {
  const env: Sealed = { sweatbook: 'backup', v: 1, alg: 'A256GCM', n: toB64(nonce), c: toB64(gcm(key, nonce).encrypt(zipped)) };
  return JSON.stringify(env);
}

/** gzip + AES-GCM, wrapped in JSON (the server only accepts JSON or gzip). */
export function seal(plain: string, key: Uint8Array, nonce: Uint8Array): string {
  return envelope(gzipSync(strToU8(plain)), key, nonce);
}

const SLICE = 32 * 1024;
const breathe = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Same result as seal, but gzips in 32 KB slices with a pause between them.
 * gzip is the slow part (about half a second for 2,000 hands without a JIT,
 * as on Hermes, and more on a cheap phone); in one piece it froze the app
 * while the automatic backup ran a few seconds after launch.
 */
export async function sealAsync(plain: string, key: Uint8Array, nonce: Uint8Array, pause: () => Promise<void> = breathe): Promise<string> {
  const input = strToU8(plain);
  const parts: Uint8Array[] = [];
  let size = 0;
  const gz = new Gzip((chunk) => {
    parts.push(chunk);
    size += chunk.length;
  });
  for (let i = 0; ; i += SLICE) {
    const last = i + SLICE >= input.length;
    gz.push(input.subarray(i, i + SLICE), last);
    if (last) break;
    await pause();
  }
  const zipped = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    zipped.set(p, at);
    at += p.length;
  }
  return envelope(zipped, key, nonce);
}

/** Opens a sealed backup; plain (older) backups pass through. Throws 'forbidden' on a wrong key. */
export function unseal(raw: Uint8Array, key: Uint8Array): string {
  const bytes = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
  const text = strFromU8(bytes);
  let env: Partial<Sealed>;
  try {
    env = JSON.parse(text) as Partial<Sealed>;
  } catch {
    return text;
  }
  if (env?.sweatbook !== 'backup' || env.alg !== 'A256GCM' || !env.n || !env.c) return text;
  try {
    return strFromU8(gunzipSync(gcm(key, fromB64(env.n)).decrypt(fromB64(env.c))));
  } catch {
    throw new Error('forbidden');
  }
}
