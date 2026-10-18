// Optional app lock: Face ID / Touch ID / the phone's own code, or a 4-digit app
// PIN on a phone with no lock of its own. The setting lives in the keychain, not
// in the store, so backups never carry it to another phone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { t } from '@/i18n';

import { lockIsThisInstalls, USED_INSTALL_KEYS, type LockConfig } from './app-lock-core';

export * from './app-lock-core';

const KEY = 'sweatbook.app-lock.v1';
const FAILS = 'sweatbook.app-lock.fails.v1';
// The keychain outlives the app on iOS; this marker in the app's own storage doesn't. A lock found
// without it belongs to a deleted install (nothing left to protect) and would only lock the player out.
const INSTALLED = 'sweatbook.app-lock.installed.v1';

/** No keychain on the web: the lock isn't offered there. */
export const lockSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export async function loadLock(): Promise<LockConfig | null> {
  if (!lockSupported) return null;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const [[, marker], ...used] = await AsyncStorage.multiGet([INSTALLED, ...USED_INSTALL_KEYS]);
    if (!lockIsThisInstalls(marker, used)) {
      await saveLock(null);
      return null;
    }
    // Set by a build from before the marker: mark it now, so it's kept from here on.
    if (!marker) await AsyncStorage.setItem(INSTALLED, '1').catch(() => {});
    return JSON.parse(raw) as LockConfig;
  } catch {
    return null;
  }
}

export async function saveLock(cfg: LockConfig | null): Promise<void> {
  if (cfg) {
    await SecureStore.setItemAsync(KEY, JSON.stringify(cfg));
    await AsyncStorage.setItem(INSTALLED, '1').catch(() => {});
  } else {
    await SecureStore.deleteItemAsync(KEY);
    await SecureStore.deleteItemAsync(FAILS).catch(() => {});
  }
}

/** True when the phone itself has a lock (code, Face ID or fingerprint) we can ask for. */
export async function deviceLockAvailable(): Promise<boolean> {
  if (!lockSupported) return false;
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) > LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Face ID, Touch ID or fingerprint, else the phone's code. */
export async function askDevice(): Promise<boolean> {
  return (await askDeviceResult()) === 'ok';
}

/** Like askDevice, and says when the phone no longer has a lock at all (code or biometrics removed in its settings). */
export async function askDeviceResult(): Promise<'ok' | 'no' | 'gone'> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: t('Desbloquear o Sweatbook'), cancelLabel: t('Cancelar') });
    if (r.success) return 'ok';
    if (r.error !== 'passcode_not_set' && r.error !== 'not_enrolled' && r.error !== 'not_available') return 'no';
    // Only the phone saying plainly it has no lock opens the app: a failed check stays locked.
    return (await LocalAuthentication.getEnrolledLevelAsync()) === LocalAuthentication.SecurityLevel.NONE ? 'gone' : 'no';
  } catch {
    return 'no';
  }
}

const hash = (salt: string, pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + pin);

export async function pinConfig(pin: string): Promise<LockConfig> {
  const salt = Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
  return { mode: 'pin', salt, pinHash: await hash(salt, pin) };
}

export async function checkPin(cfg: LockConfig, pin: string): Promise<boolean> {
  return !!cfg.salt && !!cfg.pinHash && (await hash(cfg.salt, pin)) === cfg.pinHash;
}

/** Wrong PINs so far and when the last one was typed; survives closing the app. */
export async function loadFails(): Promise<{ n: number; at: number }> {
  try {
    const v = JSON.parse((await SecureStore.getItemAsync(FAILS)) ?? 'null');
    return v && typeof v.n === 'number' ? v : { n: 0, at: 0 };
  } catch {
    return { n: 0, at: 0 };
  }
}

export async function saveFails(f: { n: number; at: number }): Promise<void> {
  await SecureStore.setItemAsync(FAILS, JSON.stringify(f)).catch(() => {});
}
