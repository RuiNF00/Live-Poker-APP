// Cloud backup without an account: a random recovery code (id + secret) the
// user keeps. The server only stores sha256(secret), so the code is the key.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { BackupData } from '@/store/backup';
import { parseBackup } from '@/store/backup';
import { BRAND } from '@/theme';

import { ALPHA, type CloudState } from './cloud-code';

export { formatCode, parseCode, type CloudState } from './cloud-code';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const KEY = 'rl.cloud.v1';


function randomB32(n: number): string {
  const bytes = Crypto.getRandomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHA[bytes[i] & 31];
  return out;
}

export async function loadCloud(): Promise<CloudState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CloudState) : null;
  } catch {
    return null;
  }
}

export async function saveCloud(c: CloudState | null): Promise<void> {
  if (c) await AsyncStorage.setItem(KEY, JSON.stringify(c));
  else await AsyncStorage.removeItem(KEY);
}

export function newCloud(): CloudState {
  return { id: randomB32(10), secret: randomB32(16) };
}

export async function upload(c: CloudState, data: BackupData): Promise<CloudState> {
  const res = await fetch(`${API}/api/backup/${c.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-backup-key': c.secret },
    body: JSON.stringify(data),
  });
  if (res.status === 413) throw new Error('too_big');
  if (!res.ok) throw new Error(res.status === 403 ? 'forbidden' : 'network');
  const next = { ...c, lastAt: Date.now() };
  await saveCloud(next);
  return next;
}

export async function download(c: CloudState): Promise<BackupData> {
  const res = await fetch(`${API}/api/backup/${c.id}`, { headers: { 'x-backup-key': c.secret } });
  if (res.status === 404) throw new Error('not_found');
  if (!res.ok) throw new Error('network');
  return parseBackup(await res.text());
}

export async function removeRemote(c: CloudState): Promise<void> {
  await fetch(`${API}/api/backup/${c.id}`, { method: 'DELETE', headers: { 'x-backup-key': c.secret } }).catch(() => {});
}
