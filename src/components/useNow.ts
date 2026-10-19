// A clock for the screen: the current time, refreshed every `ms` while the
// screen is focused and the app is in front. Nothing ticks behind other tabs
// or in the background, and coming back redraws at once with the real time
// (every caller works from timestamps, so a locked phone loses nothing).

import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

function useInFront(): boolean {
  const [front, setFront] = useState(() => AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setFront(st === 'active'));
    return () => sub.remove();
  }, []);
  return front;
}

/** For something always on screen (outside a route), like the session bar. */
export function useNowAlways(ms: number): number {
  return useTicking(ms, true);
}

/** For a route's own content: stops while another screen covers it. */
export function useNow(ms: number): number {
  return useTicking(ms, useIsFocused());
}

function useTicking(ms: number, on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  const front = useInFront();
  useEffect(() => {
    if (!on || !front) return;
    // Back in front (or on this screen again): the real time at once, not on the next tick.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- that redraw is the point
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, on, front]);
  return now;
}
