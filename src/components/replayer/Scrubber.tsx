import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Text, View, type LayoutChangeEvent } from 'react-native';

import { t } from '@/i18n';
import { C, F } from '@/theme';

import { tap } from '../ui';
import type { TimelineItem } from './model';

/**
 * Drag through the hand like a video: a track from the first step to the last, a tick at each
 * street, the played part filled. Tap anywhere to jump there. Screen readers swipe up and down.
 */
export function Scrubber({ k, last, items, onSeek }: { k: number; last: number; items: TimelineItem[]; onSeek: (k: number) => void }) {
  const [w, setW] = useState(0);
  const at = useRef({ w: 0, last, k, onSeek });
  useEffect(() => {
    at.current = { w, last, k, onSeek };
  });
  const seekX = (x: number) => {
    const c = at.current;
    if (!c.w || c.last <= 0) return;
    const to = Math.round(Math.max(0, Math.min(1, (x - PAD) / (c.w - PAD * 2))) * c.last);
    if (to !== c.k) {
      tap('select');
      c.k = to;
      c.onSeek(to);
    }
  };
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => seekX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => seekX(e.nativeEvent.locationX),
    }),
  );
  const streets = items.filter((it) => it.kind !== 'action' && it.k > 0 && it.k <= last);
  const x = (s: number) => PAD + (last > 0 ? s / last : 0) * Math.max(0, w - PAD * 2);
  // Streets close together (an all-in run out) would print "FlopTurnRiverFim": label a tick only with room for it.
  const labeled = new Set<number>();
  let lastX = -Infinity;
  for (const s of streets) {
    if (x(s.k) - lastX < LABEL_GAP) continue;
    labeled.add(s.k);
    lastX = x(s.k);
  }
  const street = [...items].reverse().find((it) => it.kind !== 'action' && it.k <= k)?.label ?? '';
  return (
    <View
      {...pan.panHandlers}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t('Posição na mão')}
      accessibilityValue={{
        min: 0,
        max: last,
        now: k,
        text: `${t('Passo {n} de {total}', { n: k + 1, total: last + 1 })}, ${street.toLowerCase()}`,
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onSeek(Math.max(0, Math.min(last, k + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
      style={{ height: 44, justifyContent: 'center' }}
    >
      {w > 0 ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: PAD,
              right: PAD,
              top: 20,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#2A2620',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: PAD,
              width: x(k) - PAD,
              top: 20,
              height: 4,
              borderRadius: 2,
              backgroundColor: C.accent,
            }}
          />
          {streets.map((s) => (
            <React.Fragment key={s.k}>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: x(s.k) - 1,
                  top: 15,
                  width: 2,
                  height: 14,
                  borderRadius: 1,
                  backgroundColor: s.k <= k ? C.accent : C.muted,
                }}
              />
              {labeled.has(s.k) ? (
              <Text
                pointerEvents="none"
                numberOfLines={1}
                style={{
                  position: 'absolute',
                  left: x(s.k) - 30,
                  width: 60,
                  top: 31,
                  textAlign: 'center',
                  color: s.k <= k ? C.textDim : C.muted,
                  fontFamily: F.medium,
                  fontSize: 9,
                  letterSpacing: 0.4,
                }}
              >
                {s.kind === 'end' ? t('Fim') : s.label.slice(0, 1) + s.label.slice(1).toLowerCase()}
              </Text>
              ) : null}
            </React.Fragment>
          ))}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: x(k) - 9,
              top: 13,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: C.text,
              borderWidth: 3,
              borderColor: C.accent,
            }}
          />
        </>
      ) : null}
    </View>
  );
}

const PAD = 10;
/** Room one tick label needs, in px ("River" or "Turn" at 9 pt). */
const LABEL_GAP = 26;
