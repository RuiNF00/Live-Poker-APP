// The villain's range as the 13×13 grid: tap or drag across hands to paint them in or out, or
// start from a top-X% preset, and hero's equity against it updates as you go.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, Text, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';

import { t } from '@/i18n';
import { useSheetAnimation } from '@/lib/motion';
import { handClassName } from '@/poker/card-name';
import { pct } from '@/poker/format';
import { combosOf, GRID_RANKS, gridClass, HAND_ORDER, rangePct, topClasses } from '@/poker/ranges';
import type { CardCode } from '@/poker/types';
import { C, F, R, S, ff } from '@/theme';

import { Button, Chip, Row, T, tap } from '../ui';
import { cachedRangeEquity } from './model';

const PRESETS = [5, 10, 20, 40];
const GAP = 2;

export function RangeSheet({
  visible,
  initial,
  hero,
  board,
  onClose,
  onApply,
}: {
  visible: boolean;
  /** The classes the sheet opens with (the current range). */
  initial: string[];
  hero: CardCode[];
  board: CardCode[];
  onClose: () => void;
  /** `null` goes back to the range read from villain's preflop raises. */
  onApply: (classes: string[] | null) => void;
}) {
  const sheetAnim = useSheetAnimation();
  const { width } = useWindowDimensions();
  const [sel, setSel] = useState(() => new Set(initial));
  const [opened, setOpened] = useState(initial);
  // Opened again on another spot: start from that spot's range.
  if (opened !== initial) {
    setOpened(initial);
    setSel(new Set(initial));
  }
  const classes = useMemo(() => HAND_ORDER.filter((c) => sel.has(c)), [sel]);
  const eq = useMemo(() => (classes.length ? cachedRangeEquity(hero, board, classes) : null), [hero, board, classes]);
  const combos = classes.reduce((n, c) => n + combosOf(c).length, 0);
  const cell = Math.floor((Math.min(width, 480) - S.gutter * 2 - GAP * 12) / 13);

  const toggle = (c: string) => {
    tap('select');
    setSel((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };
  const preset = (p: number) => {
    tap('select');
    setSel(new Set(topClasses(p)));
  };
  const activePreset = PRESETS.find((p) => {
    const top = topClasses(p);
    return top.length === sel.size && top.every((c) => sel.has(c));
  });

  // Paint: the first cell's new state goes to every cell the finger crosses.
  const live = useRef({ sel, cell, origin: { x: 0, y: 0 }, paint: null as null | { on: boolean; seen: Set<string> } });
  useEffect(() => {
    live.current.sel = sel;
    live.current.cell = cell;
  }, [sel, cell]);
  const grid = useRef<React.ComponentRef<typeof View>>(null);
  const [pan] = useState(() => {
    const at = (e: GestureResponderEvent) => {
      const { cell: size, origin } = live.current;
      const step = size + GAP;
      const i = Math.floor((e.nativeEvent.pageY - origin.y) / step);
      const j = Math.floor((e.nativeEvent.pageX - origin.x) / step);
      return i >= 0 && i < 13 && j >= 0 && j < 13 ? gridClass(i, j) : null;
    };
    const paintAt = (e: GestureResponderEvent) => {
      const p = live.current.paint;
      const c = at(e);
      if (!p || !c || p.seen.has(c)) return;
      p.seen.add(c);
      tap('select');
      setSel((s) => {
        const n = new Set(s);
        if (p.on) n.add(c);
        else n.delete(c);
        return n;
      });
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const ev = { nativeEvent: { pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY } } as GestureResponderEvent;
        grid.current?.measureInWindow((x, y) => {
          live.current.origin = { x, y };
          const c = at(ev);
          if (!c) return;
          live.current.paint = { on: !live.current.sel.has(c), seen: new Set() };
          paintAt(ev);
        });
      },
      onPanResponderMove: paintAt,
      onPanResponderRelease: () => (live.current.paint = null),
      onPanResponderTerminate: () => (live.current.paint = null),
    });
  });

  return (
    <Modal visible={visible} transparent animationType={sheetAnim} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={onClose} accessibilityLabel={t('Fechar')} />
      <View accessibilityViewIsModal style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderTopWidth: 1, borderColor: C.borderStrong, padding: S.gutter, paddingBottom: 34, gap: S.md }}>
        <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.borderStrong, marginTop: -4 }} />
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ gap: 2 }}>
            <T v="h2">{t('Range do vilão')}</T>
            <T v="monoS" maxFontSizeMultiplier={1.3}>
              {pct(rangePct(classes) / 100, 1)} · {combos} combos
            </T>
          </View>
          <View style={{ alignItems: 'flex-end' }} accessible accessibilityLabel={eq == null ? t('Sem mãos na range') : `Equity ${pct(eq)}`}>
            <T v="tiny" color={C.muted}>
              {t('A TUA EQUITY')}
            </T>
            <Text maxFontSizeMultiplier={1.3} style={{ color: eq == null ? C.muted : C.good, fontFamily: F.mono, fontSize: 28, fontVariant: ['tabular-nums'] }}>{eq == null ? '–' : pct(eq)}</Text>
          </View>
        </Row>
        <Row gap={6}>
          <T v="tiny" color={C.muted}>
            TOP
          </T>
          {PRESETS.map((p) => (
            <Chip key={p} label={`${p}%`} active={p === activePreset} onPress={() => preset(p)} />
          ))}
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSel(new Set())} style={{ marginLeft: 'auto', paddingHorizontal: 4, minHeight: 32, justifyContent: 'center' }}>
            <T v="small" color={C.textDim}>
              {t('Limpar')}
            </T>
          </Pressable>
        </Row>
        <View ref={grid} {...pan.panHandlers} style={{ gap: GAP, alignSelf: 'center' }}>
          {[...GRID_RANKS].map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: GAP }}>
              {[...GRID_RANKS].map((__, j) => {
                const c = gridClass(i, j);
                const on = sel.has(c);
                return (
                  <View
                    key={c}
                    accessible
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={handClassName(c)}
                    accessibilityActions={[{ name: 'activate' }]}
                    onAccessibilityAction={() => toggle(c)}
                    style={{
                      width: cell,
                      height: cell,
                      borderRadius: 3,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? C.accent : i === j ? C.surface3 : C.surface2,
                    }}>
                    <Text allowFontScaling={false} style={{ color: on ? C.bgDeep : i === j ? C.text : C.textDim, fontFamily: ff(on ? 700 : 500), fontSize: cell < 26 ? 8 : 10 }}>{c.slice(0, 2) + (i === j ? '' : c[2])}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <Row gap={S.sm}>
          <Button kind="secondary" title={t('Repor')} style={{ flex: 1 }} onPress={() => onApply(null)} />
          <Button title={t('Aplicar')} style={{ flex: 2 }} disabled={!classes.length} onPress={() => onApply(classes)} />
        </Row>
      </View>
    </Modal>
  );
}
