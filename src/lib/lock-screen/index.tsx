// The running session outside the app: iOS Live Activity / Android ongoing
// notification (installed build only) and the level-up reminder (works in
// Expo Go too). Mounted once at the root; follows the active session.

import { requireOptionalNativeModule } from 'expo';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { cancelFestivalReminders } from '@/lib/festival-reminders';
import { kindOn } from '@/lib/notify-policy';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';

import { liveProps } from './live-state';
import { onReminderTap, syncLevelReminder } from './reminder';

type Native = typeof import('./activity');

/**
 * The lock-screen views need the expo-widgets native module (and on iOS a
 * widget extension), which Expo Go doesn't have. Check before loading the
 * module, since importing it without the native side throws.
 */
export const lockScreenAvailable = Platform.OS !== 'web' && requireOptionalNativeModule('ExpoWidgets') != null;

let native: Native | null | undefined;
function lockScreen(): Native | null {
  if (native !== undefined) return native;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = lockScreenAvailable ? (require('./activity') as Native) : null;
  } catch (e) {
    console.warn('[lock-screen] unavailable', e);
    native = null;
  }
  return native;
}

async function show(s: Session, hideAmounts: boolean) {
  try {
    await lockScreen()?.showSession(liveProps(s, Date.now(), hideAmounts));
  } catch (e) {
    // Live Activities switched off in Settings, notifications denied: the app works as before.
    console.warn('[lock-screen] show', e);
  }
}

async function end() {
  try {
    await lockScreen()?.endSession();
  } catch (e) {
    console.warn('[lock-screen] end', e);
  }
}

export function SessionLockScreen() {
  const { activeSession, settings } = useStore();
  // Money stays off the lock screen unless the player turned on "Mostrar valores nas notificações" (notificacoes.md rule 5).
  const hide = !!settings.hideAmounts || !settings.notifyAmounts;
  const levelsOn = kindOn(settings, 'levels');
  const festivalOn = kindOn(settings, 'festival');

  useEffect(() => {
    const s = activeSession;
    if (!s) {
      void end();
      void syncLevelReminder(null);
      return;
    }
    void (async () => {
      // No system prompt here: the session screen asks with its own primer
      // first. Without permission Android simply shows no notification.
      await show(s, hide);
      await syncLevelReminder(levelsOn ? s : null);
    })();
  }, [activeSession, hide, levelsOn]);

  // "Torneios planeados" switched off in Settings: what was planned goes too (the planner reschedules when it's back on).
  useEffect(() => {
    if (!festivalOn) void cancelFestivalReminders();
  }, [festivalOn]);

  // Android can't run a clock in the notification: refresh the played time
  // every minute while the app is open, and once more on the way out.
  useEffect(() => {
    if (Platform.OS !== 'android' || !activeSession || !lockScreenAvailable) return;
    const s = activeSession;
    const id = setInterval(() => void show(s, hide), 60_000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') void show(s, hide);
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [activeSession, hide]);

  useEffect(() => onReminderTap((url) => void Linking.openURL(url).catch(() => {})), []);

  return null;
}
