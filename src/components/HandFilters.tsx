import React, { useMemo } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { RANKS } from '@/poker/cards';
import type { Hand } from '@/poker/types';
import { gameKey, gridCombo, heroPosition, NO_FILTER, STACK_BANDS, type HandFilter, type HandSort } from '@/store/hand-filters';
import { C, S, ff, F } from '@/theme';

import { Button, Chip, Row, SheetHeader, T, tap } from './ui';

const POS_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
export const SORTS: { key: HandSort; label: string }[] = [
  { key: 'recent', label: 'Mais recentes' },
  { key: 'won', label: 'Mais bb ganhas' },
  { key: 'lost', label: 'Mais bb perdidas' },
];

/** The removable pills for what is on, each with a way to clear just that. */
export function filterPills(f: HandFilter): { key: string; label: string; clear: Partial<HandFilter> }[] {
  const out: { key: string; label: string; clear: Partial<HandFilter> }[] = [];
  if (f.pos.length) out.push({ key: 'pos', label: f.pos.join(', '), clear: { pos: [] } });
  if (f.stack) out.push({ key: 'stack', label: STACK_BANDS.find((b) => b.key === f.stack)!.label, clear: { stack: null } });
  if (f.game) out.push({ key: 'game', label: f.game, clear: { game: null } });
  if (f.combos.length) out.push({ key: 'combos', label: f.combos.length > 3 ? `${f.combos.slice(0, 3).join(', ')} +${f.combos.length - 3}` : f.combos.join(', '), clear: { combos: [] } });
  if (f.sort !== 'recent') out.push({ key: 'sort', label: t(SORTS.find((s) => s.key === f.sort)!.label), clear: { sort: 'recent' } });
  return out;
}

/** "Filtrar mãos": position, stack, game, the 13×13 grid and sorting. */
export function HandFilterSheet({ visible, onClose, value, onChange, hands }: { visible: boolean; onClose: () => void; value: HandFilter; onChange: (f: HandFilter) => void; hands: Hand[] }) {
  // Only offer what the player's hands actually have.
  const { posList, games } = useMemo(() => {
    const p = new Set(hands.map(heroPosition));
    const g = new Map<string, number>();
    for (const h of hands) {
      const k = gameKey(h);
      if (k) g.set(k, (g.get(k) ?? 0) + 1);
    }
    return {
      posList: POS_ORDER.filter((x) => p.has(x)),
      games: [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k),
    };
  }, [hands]);
  const set = (p: Partial<HandFilter>) => onChange({ ...value, ...p });
  const toggleIn = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel={t('Fechar')} onPress={onClose} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '90%' }}>
            <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: S.xxl, gap: S.lg }}>
              <SheetHeader title={t('Filtrar mãos')} onClose={onClose} />

              <Group label={t('Ordenar')}>
                {SORTS.map((s) => (
                  <Chip key={s.key} label={t(s.label)} active={value.sort === s.key} onPress={() => set({ sort: s.key })} />
                ))}
              </Group>

              {posList.length > 1 ? (
                <Group label={t('A tua posição')}>
                  {posList.map((p) => (
                    <Chip key={p} label={p} active={value.pos.includes(p)} onPress={() => set({ pos: toggleIn(value.pos, p) })} />
                  ))}
                </Group>
              ) : null}

              <Group label={t('O teu stack no início')}>
                {STACK_BANDS.map((b) => (
                  <Chip key={b.key} label={b.label} active={value.stack === b.key} onPress={() => set({ stack: value.stack === b.key ? null : b.key })} />
                ))}
              </Group>

              {games.length > 1 ? (
                <Group label={t('Torneio ou jogo')}>
                  {games.map((g) => (
                    <Chip key={g} label={g} active={value.game === g} onPress={() => set({ game: value.game === g ? null : g })} />
                  ))}
                </Group>
              ) : null}

              <View style={{ gap: S.sm }}>
                <Row>
                  <T v="label" style={{ flex: 1 }}>
                    {t('As tuas cartas')}
                  </T>
                  {value.combos.length ? (
                    <Pressable onPress={() => set({ combos: [] })} hitSlop={8} accessibilityRole="button">
                      <T v="small" color={C.accent} style={{ fontFamily: ff(700) }}>
                        {t('Limpar')}
                      </T>
                    </Pressable>
                  ) : null}
                </Row>
                <ComboGrid picked={value.combos} onToggle={(c) => set({ combos: toggleIn(value.combos, c) })} />
                <T v="tiny">{t('Pares na diagonal, suited por cima, offsuit por baixo.')}</T>
              </View>

              <Row gap={S.sm}>
                <Button title={t('Limpar tudo')} kind="secondary" size="md" style={{ flex: 1 }} onPress={() => onChange(NO_FILTER)} />
                <Button title={t('Ver mãos')} size="md" style={{ flex: 1 }} onPress={onClose} />
              </Row>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: S.sm }}>
      <T v="label">{label}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>{children}</View>
    </View>
  );
}

const ComboGrid = React.memo(function ComboGrid({ picked, onToggle }: { picked: string[]; onToggle: (c: string) => void }) {
  const on = new Set(picked);
  return (
    <View style={grid.wrap}>
      {RANKS.map((_, r) => (
        <View key={r} style={grid.row}>
          {RANKS.map((__, c) => {
            const k = gridCombo(r, c);
            const sel = on.has(k);
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={k}
                accessibilityState={{ selected: sel }}
                onPress={() => {
                  tap('select');
                  onToggle(k);
                }}
                style={[grid.cell, r === c ? grid.pair : r < c ? grid.suited : null, sel && grid.sel]}>
                <Text allowFontScaling={false} style={[grid.txt, sel && grid.txtSel]}>
                  {k}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const grid = StyleSheet.create({
  wrap: { gap: 2 },
  row: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 4, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  pair: { backgroundColor: C.surface3 },
  suited: { backgroundColor: '#1A2622' },
  sel: { backgroundColor: C.accent },
  txt: { fontFamily: F.mono, fontSize: 9, letterSpacing: -0.4, color: C.textDim },
  txtSel: { color: C.bgDeep, fontFamily: F.mono },
});

