// Table motion: board cards rise in, bets gather into the pot between streets, the pot slides
// to the winner. Everything is skipped when the phone asks for reduced motion.

import React, { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

export { useReduceMotion } from '@/lib/motion';

import { ChipStack } from './ChipStack';
import { MOTION } from './timeline';

const RISE = Easing.out(Easing.back(1.4));
const FLY = Easing.inOut(Easing.cubic);

/**
 * A board card rising onto the felt; `delay` staggers the three flop cards.
 * `p` (0–1) draws one still frame of the rise instead of playing it.
 */
export function RiseIn({ children, delay = 0, reduce, p: still }: { children: React.ReactNode; delay?: number; reduce: boolean; p?: number }) {
  const [p] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce || still != null) return;
    Animated.timing(p, { toValue: 1, duration: MOTION.rise, delay, easing: RISE, useNativeDriver: true }).start();
  }, [p, delay, reduce, still]);
  if (still != null) {
    const e = RISE(still);
    return <View style={{ opacity: Math.min(1, still / 0.4), transform: [{ translateY: 16 * (1 - e) }, { scale: 0.9 + 0.1 * e }] }}>{children}</View>;
  }
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
  dur?: number;
}

/** A chip stack sliding from one spot on the felt to another, then gone. `p` (0–1) draws one still frame. */
export function FlyingChips({ f, size, onDone, p: still }: { f: Flight; size: number; onDone?: (id: string) => void; p?: number }) {
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still != null) return;
    Animated.timing(p, { toValue: 1, duration: f.dur ?? MOTION.fly, delay: f.delay ?? 0, easing: FLY, useNativeDriver: true }).start(() => onDone?.(f.id));
  }, [p, f, onDone, still]);
  const box = size * 3;
  const at = {
    position: 'absolute' as const,
    left: f.from.x - box / 2,
    top: f.from.y - box / 2,
    width: box,
    height: box,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 4,
  };
  if (still != null) {
    if (still >= 1) return null;
    const e = FLY(still);
    return (
      <View pointerEvents="none" style={[at, { opacity: still < 0.8 ? 1 : (1 - still) / 0.2, transform: [{ translateX: e * (f.to.x - f.from.x) }, { translateY: e * (f.to.y - f.from.y) }] }]}>
        <ChipStack amount={f.amount} size={size} />
      </View>
    );
  }
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        at,
        {
          opacity: p.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, f.to.x - f.from.x] }) },
            { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, f.to.y - f.from.y] }) },
          ],
        },
      ]}>
      <ChipStack amount={f.amount} size={size} />
    </Animated.View>
  );
}
