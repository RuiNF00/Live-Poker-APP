// The running session outside the app: iOS Live Activity / Android ongoing
// notification (installed build only) and the level-up reminder (works in
// Expo Go too). Mounted once at the root; follows the active session.

import { requireOptionalNativeModule } from 'expo';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { usePro } from '@/billing/pro';
import { cancelFestivalReminders, syncFestivalReminders } from '@/lib/festival-reminders';
import { loadLock } from '@/lib/app-lock';
import { endLiveEverywhere, registerLiveToken } from '@/lib/live-end';
import { endedSince } from '@/lib/live-end-slot';
import { kindOn } from '@/lib/notify-policy';
import { useFestivalPlans } from '@/store/festival-plan';
import { dayKey, notOver, useFestivals } from '@/store/my-festivals';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';

import { caughtUp, liveProps, lockAction, lockActionPatch, parseTarget, sessionPLO } from './live-state';
import { onNotificationsAllowed, onReminderTap, syncLevelReminder } from './reminder';

type Native = typeof import('./activity');

/**
 * The lock-screen views need the expo-widgets native module (and on iOS a
 * widget extension), which Expo Go doesn't have. Check before loading the
 * module, since importing it without the native side throws. On iOS they also
 * need the App Group, which a build has only with EXPO_PUBLIC_APP_GROUP=1
 * (plugins/with-app-group-gate.js): without it the extension can't read the
 * session, so the app shows no Live Activity and no widget data.
 */
export const lockScreenAvailable =
  Platform.OS !== 'web' && (Platform.OS !== 'ios' || process.env.EXPO_PUBLIC_APP_GROUP === '1') && requireOptionalNativeModule('ExpoWidgets') != null;

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

async function show(s: Session, hideAmounts: boolean, inPlace: boolean, plo: boolean) {
  try {
    const now = Date.now();
    await lockScreen()?.showSession(liveProps(caughtUp(s, now), now, hideAmounts, inPlace, plo));
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
  const { activeSession, sessions, hands, settings, saveSession } = useStore();
  // Money stays off the lock screen unless the player turned on "Mostrar valores nas notificações" (notificacoes.md rule 5).
  const hide = !!settings.hideAmounts || !settings.notifyAmounts;
  const levelsOn = kindOn(settings, 'levels');
  const festivalOn = kindOn(settings, 'festival');
  // PLO on the lock screen: a boolean, so a new hand redraws the banner only when the game changes.
  const activeId = activeSession?.id;
  const plo = useMemo(() => !!activeId && sessionPLO(hands, activeId), [hands, activeId]);
  // Allowed after the session or a plan asked (the first level length set, the first pick): what
  // found no permission then goes out now, not only after the next change.
  const [allowed, setAllowed] = useState(0);
  useEffect(() => onNotificationsAllowed(() => setAllowed((n) => n + 1)), []);
  // Back after a while: the levels that came due meanwhile, on the lock screen and in the next reminder.
  const [resumed, setResumed] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && setResumed((n) => n + 1));
    return () => sub.remove();
  }, []);
  // The trial's notice before a charge too.
  const { refreshNudges } = usePro();
  useEffect(() => {
    if (allowed) refreshNudges();
  }, [allowed, refreshNudges]);

  // Lock-screen buttons act in place only when no app lock is on, as read from the keychain.
  // Until it's read, or if reading fails, they open the app (which asks for the lock): fails closed.
  const [noLock, setNoLock] = useState(false);
  useEffect(() => {
    const read = () => loadLock().then((c) => setNoLock(c === null), () => setNoLock(false));
    read();
    // The lock can be turned on in Settings: read again whenever the app comes back or goes away.
    const sub = AppState.addEventListener('change', read);
    return () => sub.remove();
  }, []);

  // Push-to-end (first update). This phone's Live Activity token goes to the server under an opaque
  // slot; a session that stops running here (ended, deleted, or ended on another phone and merged in)
  // asks the server to end its Live Activity on the other phones with the same recovery code.
  const runningId = useRef<string | null>(null);
  useEffect(() => {
    runningId.current = activeSession?.id ?? null;
  });
  useEffect(() => {
    if (!lockScreenAvailable) return;
    lockScreen()?.onLiveToken((token) => {
      if (runningId.current) void registerLiveToken(runningId.current, token);
    });
    return () => lockScreen()?.onLiveToken(null);
  }, []);
  const seen = useRef(sessions);
  useEffect(() => {
    for (const id of endedSince(seen.current, sessions)) void endLiveEverywhere(id);
    seen.current = sessions;
  }, [sessions]);

  // A button pressed on the lock screen with the app in the background. The lock is read again here,
  // not taken from the banner: one turned on since the banner was drawn wins.
  const latest = useRef({ s: activeSession, saveSession });
  useEffect(() => {
    latest.current = { s: activeSession, saveSession };
  });
  useEffect(() => {
    if (!lockScreenAvailable) return;
    return lockScreen()?.onLockButton((target) => {
      void (async () => {
        const lock = await loadLock().catch(() => undefined);
        if (lock !== null) return;
        const { s, saveSession: save } = latest.current;
        if (!s) return;
        const { what, id } = parseTarget(target);
        const a = lockAction(what, id, s);
        // Only pause and resume happen in place: a rebuy moves money and is done in the app, with «Anular».
        if (a === 'pause' || a === 'resume') save({ ...s, ...lockActionPatch(s, a) });
      })();
    });
  }, []);

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
      await show(s, hide, noLock, plo);
      await syncLevelReminder(levelsOn ? caughtUp(s) : null);
    })();
  }, [activeSession, hide, levelsOn, noLock, plo, allowed, resumed]);

  // "Torneios planeados" switched off in Settings: what was planned goes too. On (at launch, after a
  // restore brought plans in, back on in Settings), every plan still ahead gets its reminders, in the
  // language the app speaks now, not only the festival whose screen was last opened.
  const plans = useFestivalPlans();
  const festivals = useFestivals();
  useEffect(() => {
    if (!festivalOn) {
      void cancelFestivalReminders();
      return;
    }
    const today = dayKey(Date.now());
    for (const [id, plan] of Object.entries(plans)) {
      const f = plan.picked.length ? festivals.find((x) => x.id === id) : undefined;
      if (f && notOver(f, today)) void syncFestivalReminders(f, plan);
    }
  }, [festivalOn, plans, festivals, allowed]);

  // Android can't run a clock in the notification: refresh the played time
  // every minute while the app is open, and once more on the way out.
  useEffect(() => {
    if (Platform.OS !== 'android' || !activeSession || !lockScreenAvailable) return;
    const s = activeSession;
    const id = setInterval(() => void show(s, hide, noLock, plo), 60_000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') void show(s, hide, noLock, plo);
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [activeSession, hide, noLock, plo]);

  useEffect(() => onReminderTap((url) => void Linking.openURL(url).catch(() => {})), []);

  return null;
}
