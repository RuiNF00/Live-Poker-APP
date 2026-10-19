// Reduce Motion (iOS) / Remove animations (Android): when it is on, nothing
// slides or moves across the screen. Sheets and screens fade instead.
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let reduce = false;
const listeners = new Set<(on: boolean) => void>();
let started = false;

function start() {
  if (started) return;
  started = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then(set)
    .catch(() => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', set);
}

function set(on: boolean) {
  if (on === reduce) return;
  reduce = on;
  listeners.forEach((l) => l(on));
}

function subscribe(l: (on: boolean) => void) {
  start();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** True while the system asks for less motion. Follows changes live. */
export function useReduceMotion() {
  return useSyncExternalStore(subscribe, () => reduce, () => false);
}

/** Last known value, for code outside React (an Animated duration, a scrollTo). */
export function reduceMotion() {
  start();
  return reduce;
}

/** Modal animationType for a bottom sheet: slides up, or fades with Reduce Motion. */
export function useSheetAnimation(): 'slide' | 'fade' {
  return useReduceMotion() ? 'fade' : 'slide';
}
