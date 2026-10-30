// Reduce Motion (iOS) / Remove animations (Android): when it is on, nothing
// slides or moves across the screen. Sheets and screens fade instead.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

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

/**
 * A number that glides from its last value to the new one (a stack update reads as a change, not a
 * swap). The first value and Reduce Motion show the target at once; screen readers get the target
 * from the caller's label, never the frames.
 */
export function useTween(target: number, ms = 420): number {
  const reduce = useReduceMotion();
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    from.current = target;
    if (reduce || start === target) {
      setV(target);
      return;
    }
    const a = new Animated.Value(0);
    const id = a.addListener(({ value }) => setV(Math.round(start + (target - start) * value)));
    Animated.timing(a, { toValue: 1, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => setV(target));
    return () => {
      a.removeListener(id);
      a.stopAnimation();
    };
  }, [target, ms, reduce]);
  return v;
}

/** Opacity that dips and comes back when `key` changes: a new step reads as new. Off with Reduce Motion. */
export function useFadeOnChange(key: string, ms = 160): Animated.Value {
  const reduce = useReduceMotion();
  const [a] = useState(() => new Animated.Value(1));
  const first = useRef(true);
  useEffect(() => {
    if (first.current || reduce) {
      first.current = false;
      return;
    }
    a.setValue(0.35);
    Animated.timing(a, { toValue: 1, duration: ms, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [key, a, ms, reduce]);
  return a;
}
