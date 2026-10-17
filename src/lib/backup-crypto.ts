// End-to-end encryption for the cloud backup. The recovery code's secret never
// leaves the phone: the server gets an auth key derived from it (to tell owners
// apart) and an AES-256-GCM sealed blob it cannot read. Pure, so it can be tested.

import { gcm } from '@noble/ciphers/aes';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { Gunzip, Gzip, gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';

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

/**
 * v2, what the app sends: "SWB2", the nonce and the AES-GCM bytes of the gzipped
 * backup, in a gzip container without compression (the server only takes JSON
 * or gzip, and checks the magic bytes). Same encryption as v1, without base64:
 * a quarter smaller, so a longer history fits the 2 MB.
 */
const V2 = [0x53, 0x57, 0x42, 0x32];

function pack(zipped: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  const ct = gcm(key, nonce).encrypt(zipped);
  const body = new Uint8Array(V2.length + nonce.length + ct.length);
  body.set(V2, 0);
  body.set(nonce, V2.length);
  body.set(ct, V2.length + nonce.length);
  return gzipSync(body, { level: 0 });
}

const isV2 = (b: Uint8Array) => b.length > 16 && V2.every((x, i) => b[i] === x);

function openV2(b: Uint8Array, key: Uint8Array): Uint8Array {
  try {
    return gcm(key, b.subarray(4, 16)).decrypt(b.subarray(16));
  } catch {
    throw new Error('forbidden');
  }
}

/** v1: gzip + AES-GCM, base64 in JSON. Still read; written only by older versions (and the tests). */
export function seal(plain: string, key: Uint8Array, nonce: Uint8Array): string {
  return envelope(gzipSync(strToU8(plain)), key, nonce);
}

const SLICE = 32 * 1024;
const breathe = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Seals as v2, gzipping in 32 KB slices with a pause between them.
 * gzip is the slow part (about half a second for 2,000 hands without a JIT,
 * as on Hermes, and more on a cheap phone); in one piece it froze the app
 * while the automatic backup ran a few seconds after launch.
 */
export async function sealAsync(plain: string, key: Uint8Array, nonce: Uint8Array, pause: () => Promise<void> = breathe): Promise<Uint8Array> {
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
  return pack(join(parts, size), key, nonce);
}

/** Opens a sealed backup; plain (older) backups pass through. Throws 'forbidden' on a wrong key. */
export function unseal(raw: Uint8Array, key: Uint8Array): string {
  const bytes = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
  if (isV2(bytes)) return strFromU8(gunzipSync(openV2(bytes, key)));
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

function join(parts: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** gunzip fed 24 KB at a time (a slice inflates ~20×, ~30 ms without a JIT), pausing in between. */
async function gunzipSliced(raw: Uint8Array, pause: () => Promise<void>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let size = 0;
  const gz = new Gunzip((chunk) => {
    parts.push(chunk);
    size += chunk.length;
  });
  for (let i = 0; ; i += 24576) {
    const last = i + 24576 >= raw.length;
    gz.push(raw.subarray(i, i + 24576), last);
    if (last) break;
    await pause();
  }
  return join(parts, size);
}

/** Same as unseal, with both gunzips sliced so a restore keeps the screen alive. */
export async function unsealAsync(raw: Uint8Array, key: Uint8Array, pause: () => Promise<void> = breathe): Promise<string> {
  const bytes = raw[0] === 0x1f && raw[1] === 0x8b ? await gunzipSliced(raw, pause) : raw;
  if (isV2(bytes)) {
    const zipped = openV2(bytes, key);
    await pause();
    return strFromU8(await gunzipSliced(zipped, pause));
  }
  const text = strFromU8(bytes);
  let env: Partial<Sealed>;
  try {
    env = JSON.parse(text) as Partial<Sealed>;
  } catch {
    return text;
  }
  if (env?.sweatbook !== 'backup' || env.alg !== 'A256GCM' || !env.n || !env.c) return text;
  let zipped: Uint8Array;
  try {
    zipped = gcm(key, fromB64(env.n)).decrypt(fromB64(env.c));
  } catch {
    throw new Error('forbidden');
  }
  await pause();
  return strFromU8(await gunzipSliced(zipped, pause));
}
