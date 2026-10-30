// Noite (dark) or Dia (light): follows the phone unless the player picks one in
// Settings. Kept on this phone only (not in the backup): a bright card room on one
// phone says nothing about another.
//
// Colours are read when modules load (styles, constants), so the scheme is set
// before any of them: index.js imports this file first. A change takes effect at
// the next start; picking one in Settings restarts the app at once, which never
// happens mid-hand because Settings isn't open then.

import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { Appearance, DevSettings, Platform } from 'react-native';

import { applyScheme, C } from '@/theme';

export type AppearancePref = 'auto' | 'dark' | 'light';
const KEY = 'rl.appearance.v1';

export function resolveScheme(p: AppearancePref, system: string | null | undefined): 'dark' | 'light' {
  if (p !== 'auto') return p;
  return system === 'light' ? 'light' : 'dark';
}

/**
 * Synchronous on purpose: it runs before the first module that reads a colour.
 * Nothing chosen yet = Escuro, the look everyone already has; Automático is one tap away.
 */
export function appearancePref(): AppearancePref {
  try {
    const v = Platform.OS === 'web' ? localStorage.getItem(KEY) : SecureStore.getItem(KEY);
    return v === 'auto' || v === 'light' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

const pref = appearancePref();
applyScheme(resolveScheme(pref, Appearance.getColorScheme()));
// app.json lets the phone pick (Automático needs it), so the keyboard, alerts and the share sheet
// follow the app's look when one is picked: no white keyboard under the dark app on a phone in light mode.
if (Platform.OS !== 'web' && pref !== 'auto') Appearance.setColorScheme(pref);
// What shows behind screens while they slide or the keyboard opens.
if (Platform.OS !== 'web') SystemUI.setBackgroundColorAsync(C.bg).catch(() => {});

export async function setAppearance(next: AppearancePref): Promise<void> {
  try {
    if (Platform.OS === 'web') localStorage.setItem(KEY, next);
    else SecureStore.setItem(KEY, next);
  } catch {
    return;
  }
  if (Platform.OS === 'web') return void location.reload();
  if (__DEV__) return DevSettings.reload();
  const Updates = await import('expo-updates');
  await Updates.reloadAsync().catch(() => {});
}
