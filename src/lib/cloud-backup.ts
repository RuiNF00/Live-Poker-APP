// Cloud backup without an account: a random recovery code (id + secret) the
// user keeps. The server only stores sha256(secret), so the code is the key.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import type { BackupData } from '@/store/backup';
import { parseBackup } from '@/store/backup';
import { mergeBackups, writtenElsewhere } from '@/store/backup-merge';
import { BRAND } from '@/theme';

import { ALPHA, type CloudState } from './cloud-code';
import { countsOf, uploadBlock } from './cloud-guard';
import { longSignal } from './net';
import { isOnline } from './online';
import { outcomeOf, queue, registerSender } from './sync';

// The ciphers build their tables when loaded: only once a copy is actually sent or read, not at launch.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = () => require('./backup-crypto') as typeof import('./backup-crypto');

export { formatCode, parseCode, type CloudState } from './cloud-code';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const KEY = 'rl.cloud.v1';
/** Same as BACKUP_MAX_BYTES on the server. */
const MAX_BYTES = 2 * 1024 * 1024;
/** How long the quick "is the server there?" may take before a big transfer. */
const REACH_MS = 8000;


function randomB32(n: number): string {
  const bytes = Crypto.getRandomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHA[bytes[i] & 31];
  return out;
}

export async function loadCloud(): Promise<CloudState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const c = raw ? (JSON.parse(raw) as CloudState) : null;
    // Codes made before the keychain copy existed get one on the first read.
    if (c) void keepCode(c).catch(() => {});
    return c;
  } catch {
    return null;
  }
}

const listeners = new Set<(c: CloudState | null) => void>();
/** Called after every change to the saved cloud state (a copy made, failed, turned off). */
export function onCloudChange(fn: (c: CloudState | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The code also goes to the keychain. On iOS the keychain outlives deleting the
// app and comes back with an encrypted iCloud backup or Quick Start, so a
// reinstall can offer to restore even if the player never wrote the code down.
// Default accessibility on purpose (not THIS_DEVICE_ONLY). Lazy so web and the
// Node tests never load expo-secure-store.
type Keychain = Pick<typeof import('expo-secure-store'), 'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'>;
function keychain(): Keychain | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-secure-store') as Keychain;
  } catch {
    return null;
  }
}
const KEYCHAIN_KEY = 'sweatbook.cloud.v1';
let kept: string | null | undefined;

async function keepCode(c: CloudState | null) {
  const kc = keychain();
  if (!kc) return;
  const v = c ? JSON.stringify({ id: c.id, secret: c.secret }) : null;
  if (v === kept) return;
  if (v) await kc.setItemAsync(KEYCHAIN_KEY, v);
  else await kc.deleteItemAsync(KEYCHAIN_KEY);
  kept = v;
}

/**
 * The code this phone's keychain remembers when the app itself has none: the
 * app was deleted and installed again. Null otherwise.
 */
export async function rememberedCode(): Promise<CloudState | null> {
  if (await loadCloud()) return null;
  const kc = keychain();
  if (!kc) return null;
  try {
    const v = JSON.parse((await kc.getItemAsync(KEYCHAIN_KEY)) ?? 'null') as CloudState | null;
    return v && typeof v.id === 'string' && typeof v.secret === 'string' ? { id: v.id, secret: v.secret, saved: true } : null;
  } catch {
    return null;
  }
}

export async function saveCloud(c: CloudState | null): Promise<void> {
  if (c) await AsyncStorage.setItem(KEY, JSON.stringify(c));
  else await AsyncStorage.removeItem(KEY);
  await keepCode(c).catch(() => {});
  for (const fn of listeners) fn(c);
}

export function newCloud(): CloudState {
  return { id: randomB32(10), secret: randomB32(16) };
}

export interface UploadOpts {
  /** A brand-new code, or the player confirmed they deleted things on purpose: no guard, nothing joined in. */
  force?: boolean;
  /** Another phone wrote the server copy: its items were joined into the upload; this brings them to this phone too. */
  onRemote?: (remote: BackupData) => void;
}

/**
 * Replaces the server copy. Refuses ('would_shrink') when this phone is empty
 * or has less than half of the copy it would replace, unless force (a brand-new code, or the user
 * confirmed they deleted things on purpose). When another phone with the same
 * code wrote the copy since this one did, its items are joined in first, so neither phone's work is lost.
 */
export async function upload(c: CloudState, data: BackupData, opts: UploadOpts = {}): Promise<CloudState> {
  try {
    await reach();
    const next = await put(c, data, opts);
    setWaiting(false);
    return next;
  } catch (e) {
    const msg = (e as Error)?.message;
    // No signal is not a failed copy: it waits and goes out on reconnect (AutoCloudBackup).
    if (msg === 'offline') {
      setWaiting(true);
      throw e;
    }
    // It reached the server: no longer waiting on the network; the card shows the real reason.
    setWaiting(false);
    // Remembered for the backup warning (would_shrink is the player's call, not a failure).
    const reason = msg && ['would_shrink', 'too_big', 'quota', 'disabled', 'forbidden'].includes(msg) ? msg : 'network';
    if (reason !== 'would_shrink') {
      const now = await loadCloud();
      if (now && now.id === c.id) await saveCloud({ ...now, failedAt: Date.now(), failure: reason }).catch(() => {});
    }
    throw e;
  }
}

/**
 * Before a transfer that may take 120 s on one bar of signal: with no network
 * it fails in a few seconds ('offline') instead of after two long timeouts.
 * Any answer means the server is there (as in probeWhileOffline).
 */
async function reach(): Promise<void> {
  if (!isOnline()) throw new Error('offline');
  await fetch(API, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: longSignal(REACH_MS) }).catch(() => {
    throw new Error('offline');
  });
}

let waiting = false;
const waitingListeners = new Set<(w: boolean) => void>();
function setWaiting(w: boolean) {
  if (w === waiting) return;
  waiting = w;
  for (const fn of waitingListeners) fn(w);
}
/** A copy was asked for with no signal and goes out when it's back. */
export function copyWaiting(): boolean {
  return waiting;
}
export function onCopyWaiting(fn: (w: boolean) => void): () => void {
  waitingListeners.add(fn);
  return () => {
    waitingListeners.delete(fn);
  };
}

async function put(c: CloudState, local: BackupData, opts: UploadOpts): Promise<CloudState> {
  let data = local;
  if (!opts.force && c.lastAt) {
    // Read and decrypted here, on the phone; the server never sees either copy.
    const remote = await get(c).catch((e: Error) => {
      if (e.message === 'not_found') return null;
      throw e;
    });
    if (remote && writtenElsewhere(remote, c.sent)) {
      data = mergeBackups(local, remote);
      opts.onRemote?.(remote);
    }
  }
  const block = uploadBlock(countsOf(data), c, opts.force);
  if (block) throw new Error(block);
  const { auth, enc } = crypto().deriveKeys(c.secret);
  const body = await crypto().sealAsync(JSON.stringify(data), enc, Crypto.getRandomBytes(12));
  // The server's limit: no point sending what it will refuse.
  if (body.length > MAX_BYTES) throw new Error('too_big');
  const res = await fetch(`${API}/api/backup/${c.id}`, {
    method: 'PUT',
    // Encrypted on the phone; the server only ever sees a key derived from the code.
    headers: { 'content-type': 'application/gzip', 'x-backup-key': auth },
    // React Native sends typed arrays as they are (convertRequestBody).
    body: body as Uint8Array<ArrayBuffer>,
    signal: longSignal(),
  });
  if (res.status === 413) throw new Error('too_big');
  if (res.status === 507) throw new Error('quota');
  if (res.status === 503) throw new Error('disabled');
  if (!res.ok) throw new Error(res.status === 403 ? 'forbidden' : 'network');
  const { failedAt: _f, failure: _r, ...ok } = c;
  const next: CloudState = { ...ok, lastAt: Date.now(), counts: countsOf(data), sent: data.exportedAt };
  // A restore with another code may have finished while this was uploading;
  // don't put the old code back.
  const now = await loadCloud();
  if (!now || now.id === c.id) await saveCloud(next);
  return next;
}

export async function download(c: CloudState): Promise<BackupData> {
  await reach().catch(() => {
    throw new Error('network');
  });
  return get(c);
}

async function get(c: CloudState): Promise<BackupData> {
  const { auth, enc } = crypto().deriveKeys(c.secret);
  const res = await fetch(`${API}/api/backup/${c.id}`, { headers: { 'x-backup-key': auth }, signal: longSignal() });
  if (res.status === 404) throw new Error('not_found');
  if (res.status === 503) throw new Error('disabled');
  if (!res.ok) throw new Error('network');
  // Encrypted with this code's key or nothing: never a plain copy someone put on the server.
  return parseBackup(await crypto().unsealAsync(new Uint8Array(await res.arrayBuffer()), enc, undefined, true));
}

export async function removeRemote(c: CloudState): Promise<void> {
  const res = await fetch(`${API}/api/backup/${c.id}`, { method: 'DELETE', headers: { 'x-backup-key': crypto().deriveKeys(c.secret).auth } }).catch(() => null);
  // 404: already gone. Anything else means the copy may still be on the server.
  if (!res || (!res.ok && res.status !== 404)) throw new Error(res?.status === 403 ? 'forbidden' : res?.status === 503 ? 'disabled' : 'network');
}

/**
 * Deletes the server copy now or when the signal is back. Only the derived key goes in
 * the queue: it can delete the copy but not read it.
 */
export function queueCloudDelete(c: CloudState) {
  queue('cloud-delete', { id: c.id, auth: crypto().deriveKeys(c.secret).auth }, c.id);
}

registerSender('cloud-delete', async (p) => {
  const { id, auth } = p as { id: string; auth: string };
  const res = await fetch(`${API}/api/backup/${id}`, { method: 'DELETE', headers: { 'x-backup-key': auth } }).catch(() => null);
  if (!res) return 'retry';
  return res.status === 404 ? 'done' : outcomeOf(res.status);
});
