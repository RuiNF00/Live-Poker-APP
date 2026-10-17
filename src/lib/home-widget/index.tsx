// Keeps the home-screen widget in step with the app: the running session, or
// this week's result and streak. Installed build only (expo-widgets native
// module plus the widget entry in app.json); in Expo Go and on web it does
// nothing. Mounted once at the root.

import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { useStore } from '@/store/store';

import { lockScreenAvailable } from '../lock-screen';
import { widgetProps, type WidgetProps } from './widget-state';

type Native = typeof import('./widget');

let native: Native | null | undefined;
function widget(): Native | null {
  if (native !== undefined) return native;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = lockScreenAvailable ? (require('./widget') as Native) : null;
  } catch (e) {
    console.warn('[home-widget] unavailable', e);
    native = null;
  }
  return native;
}

function push(props: WidgetProps) {
  try {
    widget()?.updateWidget(props);
  } catch (e) {
    // No widget entry in this build, or the widget extension isn't there yet.
    console.warn('[home-widget] update', e);
  }
}

export function HomeWidgetSync() {
  const { activeSession, sessions, hands, players, settings, defaultBankroll } = useStore();
  const input = useMemo(
    () => ({
      activeSession,
      sessions,
      hands,
      players,
      currency: defaultBankroll.currency,
      hideAmounts: !!settings.hideAmounts,
      streakPauses: settings.streakPauses ?? [],
    }),
    [activeSession, sessions, hands, players, defaultBankroll.currency, settings.hideAmounts, settings.streakPauses],
  );

  useEffect(() => {
    if (!lockScreenAvailable) return;
    push(widgetProps(input));
    // The week and the played time move on by themselves: refresh on the way out.
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') push(widgetProps(input));
    });
    return () => sub.remove();
  }, [input]);

  return null;
}
