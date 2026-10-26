// Cloud backup without an account: a random recovery code (id + secret) the
// user keeps. The server only stores sha256(secret), so the code is the key.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import type { BackupData } from '@/store/backup';
import { parseBackup } from '@/store/backup';
import { mergeBackups, syncPlan, writtenElsewhere } from '@/store/backup-merge';
import { BRAND } from '@/theme';

import { ALPHA, parseCloud, type CloudState } from './cloud-code';
import { BACKUP_MAX_BYTES, countsOf, savesOver, uploadBlock } from './cloud-guard';
import { longSignal } from './net';
import { isOnline } from './online';
import { outcomeOf, queueOrThrow, registerSender } from './sync';

// The ciphers and gzip (fflate, noble: ~90 KB) load only once a copy is actually sent or read, not at launch.
const crypto = () => import('./backup-crypto');

export { formatCode, parseCode, type CloudState } from './cloud-code';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const KEY = 'rl.cloud.v1';
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
    const c = parseCloud(await AsyncStorage.getItem(KEY));
    // Codes made before the keychain copy existed get one on the first read.
    if (c) void keepCode(c).catch(() => {});
    // With the copy on, the ciphers load now: «Apagar tudo» offline needs them to queue the delete.
    if (c) void crypto().catch(() => {});
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

// One read or write of the server copy at a time on this phone: a sync on opening and a copy after a
// saved hand must not each read the copy and then write over what the other just sent.
let line: Promise<unknown> = Promise.resolve();
function inLine<T>(job: () => Promise<T>): Promise<T> {
  const run = line.then(job, job);
  line = run.catch(() => {});
  return run;
}

/**
 * Replaces the server copy. Refuses ('would_shrink') when this phone is empty
 * or has less than half of the copy it would replace, unless force (a brand-new code, or the user
 * confirmed they deleted things on purpose). When another phone with the same
 * code wrote the copy since this one did, its items are joined in first, so neither phone's work is lost.
 */
export function upload(c: CloudState, data: BackupData, opts: UploadOpts = {}): Promise<CloudState> {
  return inLine(() => uploadNow(c, data, opts));
}

async function uploadNow(c: CloudState, data: BackupData, opts: UploadOpts): Promise<CloudState> {
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
    const reason = msg && ['would_shrink', 'too_big', 'quota', 'disabled', 'forbidden', 'gone'].includes(msg) ? msg : 'network';
    if (reason !== 'would_shrink') {
      const now = await loadCloud();
      if (now && now.id === c.id) await saveCloud({ ...now, failedAt: Date.now(), failure: reason, ...(reason === 'gone' ? { gone: true } : {}) }).catch(() => {});
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
  // Deleted on purpose somewhere else: this code is never written again, not even when forced.
  if (c.gone) throw new Error('gone');
  let data = local;
  let next = c;
  if (c.lastAt) {
    // Read and decrypted here, on the phone; the server never sees either copy.
    // Also when forced: a copy this phone wrote or restored that is no longer there was deleted
    // («Apagar tudo» on another phone, the website), and must not come back with the same code.
    const remote = await get(c).catch((e: Error) => {
      if (e.message === 'not_found') throw new Error('gone');
      // Replacing on purpose: a copy that can't be read (a later version, damaged) is what gets replaced.
      if (opts.force) return null;
      throw e;
    });
    if (remote) next = { ...next, checkedAt: Date.now() };
    if (remote && !opts.force && writtenElsewhere(remote, c.sent)) {
      data = mergeBackups(local, remote);
      // Another device uses this code: from now on this one reads the copy when it opens, too.
      next = { ...next, shared: true, seen: remote.exportedAt };
      opts.onRemote?.(remote);
    }
  }
  return send(next, data, opts);
}

/** `echo`: sent because a read found the copy behind, not because something changed here (CloudState.echo). */
async function send(c: CloudState, data: BackupData, opts: UploadOpts & { echo?: boolean }): Promise<CloudState> {
  const block = uploadBlock(countsOf(data), c, opts.force);
  if (block) throw new Error(block);
  const cr = await crypto();
  const { auth, enc } = cr.deriveKeys(c.secret);
  const body = await cr.sealAsync(JSON.stringify(data), enc, Crypto.getRandomBytes(12));
  // The server's limit: no point sending what it will refuse.
  if (body.length > BACKUP_MAX_BYTES) throw new Error('too_big');
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
  if (res.status === 429) throw new Error('rate_limited');
  if (!res.ok) throw new Error(res.status === 403 ? 'forbidden' : 'network');
  const { failedAt: _f, failure: _r, ...ok } = c;
  const at = Date.now();
  const next: CloudState = { ...ok, lastAt: at, counts: countsOf(data), sent: data.exportedAt, bytes: body.length, syncedAt: at, echo: !!opts.echo };
  if (savesOver(await loadCloud(), c.id)) await saveCloud(next);
  return next;
}

/**
 * Reads the server copy and brings here what another device sent (onRemote: importData with sync),
 * then sends back only what the copy lacks (syncPlan): on opening and back from the background, for a
 * code two devices use. Never forces: an upload that would shrink the copy is left for the player
 * (cloud-guard). A copy deleted elsewhere marks the code gone, as an upload does. Resolves with the
 * state saved; throws 'offline' and the like as download does, and then nothing changed.
 */
export function syncCloud(c: CloudState, local: BackupData, opts: Pick<UploadOpts, 'onRemote'> = {}): Promise<CloudState> {
  return inLine(async () => {
    // An upload queued before this one may have moved the state on (sent, lastAt): read it again.
    const saved = await loadCloud();
    if (saved && saved.id === c.id) c = saved;
    if (c.gone) throw new Error('gone');
    await reach();
    const remote = await get(c).catch(async (e: Error) => {
      if (e.message !== 'not_found' || !c.lastAt) throw e;
      // This phone wrote or read that copy: it was deleted on purpose elsewhere, never written again.
      const now = await loadCloud();
      if (now && now.id === c.id) await saveCloud({ ...now, gone: true, failedAt: Date.now(), failure: 'gone' }).catch(() => {});
      throw new Error('gone');
    });
    const at = Date.now();
    const plan = syncPlan(local, remote, c, at);
    let next: CloudState = { ...c, checkedAt: at, ...(plan.other ? { shared: true, seen: remote.exportedAt } : null) };
    if (plan.join) opts.onRemote?.(remote);
    if (plan.push) {
      try {
        return await send(next, plan.data, { echo: true });
      } catch (e) {
        // Fewer things here than in the copy: the player's call («Sincronizar agora»), not a failure.
        if ((e as Error)?.message !== 'would_shrink') throw e;
      }
    } else if (!plan.ahead) next = { ...next, syncedAt: at };
    if (savesOver(await loadCloud(), c.id)) await saveCloud(next);
    return next;
  });
}

/**
 * «Usar noutro aparelho» on the device that receives the code: brings the copy here (onRemote:
 * importData with sync, so nothing on either side is lost or doubled) and sends back what only this
 * device had, so the other one gets it on its next read. From then on this device syncs with that code.
 * A different code it had before stops being used here (its copy stays on the server until it expires).
 */
export async function joinCloud(code: Pick<CloudState, 'id' | 'secret'>, local: BackupData, onRemote: (remote: BackupData) => void, shown?: BackupData): Promise<CloudState> {
  // `shown`: the copy the player was shown before saying yes (the sync below reads it again anyway).
  const remote = shown ?? (await download({ id: code.id, secret: code.secret }));
  onRemote(remote);
  const at = Date.now();
  // sent 0: no copy from here is on the server yet, so the next read joins it in again before
  // sending (with what the store holds by then); seen keeps that read from importing it twice.
  // counts: no upload may send less than the copy holds, even before the imported items are saved.
  const next: CloudState = { id: code.id, secret: code.secret, lastAt: at, checkedAt: at, counts: countsOf(remote), sent: 0, seen: remote.exportedAt, shared: true, saved: true };
  await saveCloud(next);
  // Offline after the download: the next sync (on opening, on reconnect) sends it.
  return syncCloud(next, mergeBackups(local, remote, at)).catch(() => next);
}

export async function download(c: CloudState): Promise<BackupData> {
  await reach().catch(() => {
    throw new Error('network');
  });
  return get(c);
}

async function get(c: CloudState): Promise<BackupData> {
  const cr = await crypto();
  const { auth, enc } = cr.deriveKeys(c.secret);
  const res = await fetch(`${API}/api/backup/${c.id}`, { headers: { 'x-backup-key': auth }, signal: longSignal() });
  if (res.status === 404) throw new Error('not_found');
  if (res.status === 503) throw new Error('disabled');
  if (res.status === 429) throw new Error('rate_limited');
  // Reached but failing: not «Sem ligação».
  if (!res.ok) throw new Error(res.status >= 500 ? 'server' : 'network');
  // Encrypted with this code's key or nothing: never a plain copy someone put on the server.
  return parseBackup(await cr.unsealAsync(new Uint8Array(await res.arrayBuffer()), enc, undefined, true));
}

export async function removeRemote(c: CloudState): Promise<void> {
  const { auth } = (await crypto()).deriveKeys(c.secret);
  const res = await fetch(`${API}/api/backup/${c.id}`, { method: 'DELETE', headers: { 'x-backup-key': auth } }).catch(() => null);
  // 404: already gone. Anything else means the copy may still be on the server.
  if (!res || (!res.ok && res.status !== 404)) throw new Error(res?.status === 403 ? 'forbidden' : res?.status === 503 ? 'disabled' : res?.status === 429 ? 'rate_limited' : 'network');
}

/**
 * Deletes the server copy now or when the signal is back. Only the derived key goes in
 * the queue: it can delete the copy but not read it.
 */
export async function queueCloudDelete(c: CloudState): Promise<void> {
  // If it can't be saved, «Apagar tudo» stops and keeps the code (eraseInOrder).
  await queueOrThrow('cloud-delete', { id: c.id, auth: (await crypto()).deriveKeys(c.secret).auth }, c.id);
}

registerSender('cloud-delete', async (p) => {
  const { id, auth } = p as { id: string; auth: string };
  const res = await fetch(`${API}/api/backup/${id}`, { method: 'DELETE', headers: { 'x-backup-key': auth } }).catch(() => null);
  if (!res) return 'retry';
  return res.status === 404 ? 'done' : outcomeOf(res.status);
});
