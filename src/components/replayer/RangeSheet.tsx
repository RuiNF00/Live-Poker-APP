// The villain's range as the 13×13 grid: tap hands in or out, or start from a top-X% preset,
// and hero's equity against it updates as you go.

import React, { useMemo, useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { t } from '@/i18n';
import { useSheetAnimation } from '@/lib/motion';
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

  return (
    <Modal visible={visible} transparent animationType={sheetAnim} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={onClose} accessibilityLabel={t('Fechar')} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderTopWidth: 1, borderColor: C.borderStrong, padding: S.gutter, paddingBottom: 34, gap: S.md }}>
        <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.borderStrong, marginTop: -4 }} />
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ gap: 2 }}>
            <T v="h2">{t('Range do vilão')}</T>
            <T v="monoS">
              {pct(rangePct(classes) / 100, 1)} · {combos} combos
            </T>
          </View>
          <View style={{ alignItems: 'flex-end' }} accessible accessibilityLabel={eq == null ? t('Sem mãos na range') : `Equity ${pct(eq)}`}>
            <T v="tiny" color={C.muted}>
              {t('A TUA EQUITY')}
            </T>
            <Text style={{ color: eq == null ? C.muted : C.good, fontFamily: F.mono, fontSize: 28, fontVariant: ['tabular-nums'] }}>{eq == null ? '–' : pct(eq)}</Text>
          </View>
        </Row>
        <Row gap={6}>
          <T v="tiny" color={C.muted}>
            TOP
          </T>
          {PRESETS.map((p) => (
            <Chip key={p} label={`${p}%`} onPress={() => preset(p)} />
          ))}
          <Chip label={t('Limpar')} onPress={() => setSel(new Set())} />
        </Row>
        <View style={{ gap: GAP, alignSelf: 'center' }}>
          {[...GRID_RANKS].map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: GAP }}>
              {[...GRID_RANKS].map((__, j) => {
                const c = gridClass(i, j);
                const on = sel.has(c);
                return (
                  <Pressable
                    key={c}
                    onPress={() => toggle(c)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={c}
                    style={{
                      width: cell,
                      height: cell,
                      borderRadius: 3,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? C.accent : i === j ? C.surface3 : C.surface2,
                    }}>
                    <Text style={{ color: on ? C.bgDeep : i === j ? C.text : C.textDim, fontFamily: ff(on ? 700 : 500), fontSize: cell < 26 ? 8 : 10 }}>{c.slice(0, 2) + (i === j ? '' : c[2])}</Text>
                  </Pressable>
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
