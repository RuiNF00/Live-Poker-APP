import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * For a text box that saves on blur: Android back, a swipe to the next hand or the app going to the
 * background can take the screen away with no blur, and what was typed would be lost. `pending`
 * saves only when there is something new; it runs again then, with the latest values.
 */
export function useSaveOnLeave(pending: () => void) {
  const latest = useRef(pending);
  useEffect(() => {
    latest.current = pending;
  });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'background' && latest.current());
    return () => {
      sub.remove();
      latest.current();
    };
  }, []);
}
