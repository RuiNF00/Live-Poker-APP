// Table motion: board cards rise in, bets gather into the pot between streets, the pot slides
// to the winner. Everything is skipped when the phone asks for reduced motion.

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

import { ChipStack } from './ChipStack';

/** True while the system "Reduce Motion" setting is on. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** A board card rising onto the felt; `delay` staggers the three flop cards. */
export function RiseIn({ children, delay = 0, reduce }: { children: React.ReactNode; delay?: number; reduce: boolean }) {
  const [p] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce) return;
    Animated.timing(p, { toValue: 1, duration: 300, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [p, delay, reduce]);
  return (
    <Animated.View
      style={{
        opacity: p.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
        transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
      }}>
      {children}
    </Animated.View>
  );
}

export interface Flight {
  id: string;
  amount: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay?: number;
}

/** A chip stack sliding from one spot on the felt to another, then gone. */
export function FlyingChips({ f, size, onDone }: { f: Flight; size: number; onDone: (id: string) => void }) {
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: 420, delay: f.delay ?? 0, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => onDone(f.id));
  }, [p, f, onDone]);
  const box = size * 3;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: f.from.x - box / 2,
        top: f.from.y - box / 2,
        width: box,
        height: box,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4,
        opacity: p.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, f.to.x - f.from.x] }) },
          { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, f.to.y - f.from.y] }) },
        ],
      }}>
      <ChipStack amount={f.amount} size={size} />
    </Animated.View>
  );
}
