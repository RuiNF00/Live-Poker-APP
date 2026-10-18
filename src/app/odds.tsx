// Odds calculator: your two cards, the board so far and villain's cards or a range in,
// your equity out. Same maths as the replayer's equity, works offline.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { CardPicker } from '@/components/CardPicker';
import { RpCard } from '@/components/replayer/RpCard';
import { Card, Chip, ChipRow, Row, Section, Segmented, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { FULL_DECK } from '@/poker/cards';
import { equity } from '@/poker/equity';
import { pct } from '@/poker/format';
import { equityVsRange, topRange } from '@/poker/ranges';
import type { CardCode } from '@/poker/types';
import { C, R, S } from '@/theme';

// Slots 0-1 hero, 2-6 board, 7-8 villain.
const HERO = [0, 1];
const BOARD = [2, 3, 4, 5, 6];
const VILLAIN = [7, 8];
const RANGES = [4, 8, 20, 40, 100];

/** "AsKd" -> ["As", "Kd"], ignoring anything that isn't a real card. */
function parseCards(s: unknown): CardCode[] {
  if (typeof s !== 'string') return [];
  const out: CardCode[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) {
    const c = s[i].toUpperCase() + s[i + 1].toLowerCase();
    if (FULL_DECK.includes(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

export default function OddsScreen() {
  const params = useLocalSearchParams<{ hero?: string; board?: string }>();
  const [slots, setSlots] = useState<(CardCode | null)[]>(() => {
    const s: (CardCode | null)[] = Array(9).fill(null);
    parseCards(params.hero).slice(0, 2).forEach((c, i) => (s[HERO[i]] = c));
    parseCards(params.board)
      .filter((c) => !s.includes(c))
      .slice(0, 5)
      .forEach((c, i) => (s[BOARD[i]] = c));
    return s;
  });
  const [mode, setMode] = useState<'range' | 'cards'>('range');
  const [rangePct, setRangePct] = useState(20);
  // Fill order: your cards, villain's cards, then the board (optional), like dealing a hand.
  const order = (m: typeof mode) => [...HERO, ...(m === 'cards' ? VILLAIN : []), ...BOARD];
  const firstEmpty = (s: (CardCode | null)[], m = mode) => order(m).find((i) => !s[i]) ?? null;
  const [active, setActive] = useState<number | null>(() => firstEmpty(slots));

  const hero = HERO.map((i) => slots[i]).filter(Boolean) as CardCode[];
  const villain = VILLAIN.map((i) => slots[i]).filter(Boolean) as CardCode[];
  // The board counts only as dealt streets: flop, turn, river, in order.
  const boardAll = BOARD.map((i) => slots[i]);
  const boardLen = boardAll[0] && boardAll[1] && boardAll[2] ? (boardAll[3] ? (boardAll[4] ? 5 : 4) : 3) : 0;
  const board = boardAll.slice(0, boardLen) as CardCode[];
  const boardGap = boardAll.some((c, i) => c && i >= boardLen);

  const heroKey = hero.join('');
  const villainKey = villain.join('');
  const boardKey = board.join('');
  const result = useMemo(() => {
    if (hero.length < 2 || boardGap) return null;
    if (mode === 'cards') {
      if (villain.length < 2) return null;
      const [h, v] = equity([hero, villain], board);
      return { hero: h, villain: v };
    }
    const e = equityVsRange(hero, topRange(rangePct), board);
    return e == null ? null : { hero: e, villain: 1 - e };
  }, [heroKey, villainKey, boardKey, mode, rangePct, boardGap]); // eslint-disable-line react-hooks/exhaustive-deps

  const used = new Set(slots.filter(Boolean) as string[]);
  const pick = (c: CardCode) => {
    const next = slots.slice();
    const at = next.indexOf(c);
    if (at >= 0) {
      // Tapping a card already in use takes it back out.
      next[at] = null;
      setSlots(next);
      setActive(at);
      return;
    }
    const target = active ?? firstEmpty(next);
    if (target == null) return;
    next[target] = c;
    setSlots(next);
    setActive(firstEmpty(next));
  };
  const onSlot = (i: number) => {
    tap('select');
    if (slots[i]) {
      const next = slots.slice();
      next[i] = null;
      setSlots(next);
    }
    setActive(i);
  };
  const clear = () => {
    tap();
    setSlots(Array(9).fill(null));
    setActive(0);
  };
  const switchMode = (m: 'range' | 'cards') => {
    setMode(m);
    if (m === 'range') setSlots((s) => s.map((c, i) => (VILLAIN.includes(i) ? null : c)));
    if (m === 'cards') setActive(firstEmpty(slots, 'cards'));
    else setActive(firstEmpty(slots.map((c, i) => (VILLAIN.includes(i) ? null : c)), 'range'));
  };

  const pctLabel = (e: number) => pct(e, 1);
  const street = boardLen === 0 ? t('Pré-flop') : boardLen === 3 ? 'Flop' : boardLen === 4 ? 'Turn' : 'River';

  return (
    <>
      <Stack.Screen options={{ title: t('Calculadora de odds') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.lg, paddingBottom: 60 }}>
        <Card style={{ gap: S.md }}>
          {/* Wraps on narrow phones: two hole cards and five board cards don't fit one row at 320. */}
          <Row style={{ alignItems: 'flex-start', gap: S.lg, flexWrap: 'wrap', rowGap: S.sm }}>
            <SlotGroup label={t('Tu')} ids={HERO} slots={slots} active={active} onSlot={onSlot} />
            <SlotGroup label="Board" ids={BOARD} slots={slots} active={active} onSlot={onSlot} />
          </Row>
          {mode === 'cards' ? <SlotGroup label={t('Vilão')} ids={VILLAIN} slots={slots} active={active} onSlot={onSlot} /> : null}
          <Result
            result={result}
            missing={hero.length < 2 ? t('Escolhe as tuas duas cartas.') : boardGap ? t('Completa o flop (ou tira o turn e o river).') : t('Escolhe as duas cartas do vilão.')}
            label={mode === 'range' ? `vs top ${rangePct}%` : t('vs cartas do vilão')} street={street} fmt={pctLabel} />
        </Card>

        <Section title={t('Vilão')}>
          <Segmented
            options={[
              { key: 'range', label: 'Range' },
              { key: 'cards', label: t('Cartas') },
            ]}
            value={mode}
            onChange={switchMode}
          />
          {mode === 'range' ? (
            <ChipRow>
              {RANGES.map((p) => (
                <Chip key={p} label={p === 100 ? t('Qualquer') : `Top ${p}%`} active={rangePct === p} onPress={() => setRangePct(p)} />
              ))}
            </ChipRow>
          ) : null}
        </Section>

        <Section title={t('Escolhe as cartas')} action={used.size ? t('Limpar') : undefined} onAction={clear} hint={t('Toca num lugar para o mudar. Range: 4-bet ≈ top 4%, 3-bet ≈ top 8%, open ≈ top 20%, call ≈ top 40%.')}>
          <CardPicker used={used} selected={[]} onPick={pick} />
        </Section>
      </ScrollView>
    </>
  );
}

function SlotGroup({ label, ids, slots, active, onSlot }: { label: string; ids: number[]; slots: (CardCode | null)[]; active: number | null; onSlot: (i: number) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="label">{label}</T>
      <Row gap={5}>
        {ids.map((i) => {
          const c = slots[i];
          const on = active === i;
          return (
            <Pressable key={i} onPress={() => onSlot(i)} accessibilityRole="button" accessibilityLabel={c ? `${label} ${c}` : `${label} ${t('vazio')}`} hitSlop={3}>
              {c ? (
                <View style={{ borderRadius: R.xs + 1, borderWidth: 2, borderColor: on ? C.accent : 'transparent' }}>
                  <RpCard card={c} w={36} h={50} />
                </View>
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 54,
                    borderRadius: R.xs + 1,
                    borderWidth: on ? 2 : 1,
                    borderStyle: on ? 'solid' : 'dashed',
                    borderColor: on ? C.accent : C.borderStrong,
                    backgroundColor: on ? C.accentSoft : C.bgDeep,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}

function Result({ result, missing, label, street, fmt }: { result: { hero: number; villain: number } | null; missing: string; label: string; street: string; fmt: (e: number) => string }) {
  if (!result)
    return (
      <Row gap={8} style={{ paddingTop: S.xs }}>
        <Ionicons name="stats-chart-outline" size={16} color={C.muted} />
        <T v="small">{missing}</T>
      </Row>
    );
  return (
    <View style={{ gap: 8, paddingTop: S.xs }}>
      <Row style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <View>
          <T v="label">Equity · {street}</T>
          <T v="monoXL" color={C.good}>
            {fmt(result.hero)}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="tiny">{label}</T>
          <T v="mono" color={C.textDim}>
            {fmt(result.villain)}
          </T>
        </View>
      </Row>
      <View style={{ height: 8, borderRadius: R.pill, backgroundColor: C.surface3, overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ width: `${result.hero * 100}%`, backgroundColor: C.good }} />
      </View>
    </View>
  );
}
