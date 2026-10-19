import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { t } from '@/i18n';
import { C, R, S, SHADOW } from '@/theme';

import { Button, Row, T } from './ui';

export type ViewRef = React.ComponentRef<typeof View>;
export type CoachStep = { target: React.RefObject<ViewRef | null>; title: string; body: string };
type Box = { x: number; y: number; w: number; h: number };

const PAD = 6;

/**
 * A short guided tour over the real screen, shown once: the part being
 * explained stays lit, the rest dims, and every step can be skipped.
 */
export function CoachMarks({ id, steps }: { id: string; steps: CoachStep[] }) {
  const key = `rl.coach.${id}.v1`;
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(-1);
  const [box, setBox] = useState<Box | null>(null);
  // A screen pushed on top (the trial paywall at the first live session) wins:
  // the tour waits under it and comes back when it closes.
  const focused = useIsFocused();

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((v) => {
        // Let the screen settle before measuring what to light up.
        if (!v && alive) setTimeout(() => alive && setI(0), 700);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (i < 0 || i >= steps.length) return;
    const node = steps[i].target.current;
    if (!node) {
      // Not on screen: skip this step. Skipping past the last one still counts as seen.
      if (i + 1 >= steps.length) AsyncStorage.setItem(key, '1').catch(() => {});
      const id = requestAnimationFrame(() => setI((n) => n + 1));
      return () => cancelAnimationFrame(id);
    }
    node.measureInWindow((x, y, w, h) => setBox(w && h ? { x: x - PAD, y: y - PAD, w: w + 2 * PAD, h: h + 2 * PAD } : null));
  }, [i, steps, key]);

  const done = () => {
    setI(steps.length);
    AsyncStorage.setItem(key, '1').catch(() => {});
  };
  if (i < 0 || i >= steps.length || !box || !focused) return null;
  const step = steps[i];
  const last = i === steps.length - 1;
  // The tip goes on whichever side of the lit area has more room.
  const below = box.y + box.h / 2 < height / 2;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={done}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <View style={[st.dim, { left: 0, right: 0, top: 0, height: Math.max(0, box.y) }]} />
        <View style={[st.dim, { left: 0, right: 0, top: box.y + box.h, bottom: 0 }]} />
        <View style={[st.dim, { left: 0, width: Math.max(0, box.x), top: box.y, height: box.h }]} />
        <View style={[st.dim, { left: box.x + box.w, right: 0, top: box.y, height: box.h }]} />
        <View pointerEvents="none" style={[st.ring, { left: box.x, top: box.y, width: box.w, height: box.h }]} />
        <View style={[st.tip, { width: width - 2 * S.gutter }, below ? { top: box.y + box.h + S.md } : { bottom: height - box.y + S.md }]}>
          <Row gap={S.sm}>
            <T v="h2" style={{ flex: 1 }}>
              {step.title}
            </T>
            <T v="monoS">
              {i + 1}/{steps.length}
            </T>
          </Row>
          <T v="body" style={{ color: C.textDim }}>
            {step.body}
          </T>
          <Row gap={S.sm} style={{ marginTop: S.xs }}>
            {last ? null : (
              <Pressable onPress={done} hitSlop={8} accessibilityRole="button" style={{ paddingVertical: 10, paddingRight: S.md }}>
                <T v="callout">{t('Saltar')}</T>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Button size="md" title={last ? t('Percebi') : t('Seguinte')} onPress={() => (last ? done() : setI(i + 1))} />
          </Row>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(5,9,8,0.78)' },
  ring: { position: 'absolute', borderRadius: R.lg + 2, borderWidth: 2, borderColor: C.accent },
  tip: { position: 'absolute', left: S.gutter, backgroundColor: C.surface, borderRadius: R.xl, borderWidth: 1, borderColor: C.borderStrong, padding: S.lg, gap: S.sm, ...SHADOW },
});
