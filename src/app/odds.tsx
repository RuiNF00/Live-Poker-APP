// Odds calculator: your two cards (four in PLO), the board so far and villain's cards or a
// range in, your equity out. Same maths as the replayer's equity, works offline.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { CardPicker } from '@/components/CardPicker';
import { RpCard } from '@/components/replayer/RpCard';
import { Card, Chip, ChipRow, Row, Section, Segmented, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { FULL_DECK } from '@/poker/cards';
import { pct } from '@/poker/format';
import { oddsEquity, oddsHole, type OddsGame } from '@/poker/odds';
import type { CardCode } from '@/poker/types';
import { C, R, S } from '@/theme';

// Slots 0-3 hero, 4-8 board, 9-12 villain; hold'em uses the first two of each hand.
const HERO_ALL = [0, 1, 2, 3];
const BOARD = [4, 5, 6, 7, 8];
const VILLAIN_ALL = [9, 10, 11, 12];
const SLOTS = 13;
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
  // Four hero cards in the link open the PLO calculator.
  const [game, setGame] = useState<OddsGame>(() => (parseCards(params.hero).length >= 4 ? 'plo' : 'nlhe'));
  const n = oddsHole(game);
  const HERO = HERO_ALL.slice(0, n);
  const VILLAIN = VILLAIN_ALL.slice(0, n);
  const [slots, setSlots] = useState<(CardCode | null)[]>(() => {
    const s: (CardCode | null)[] = Array(SLOTS).fill(null);
    parseCards(params.hero).slice(0, n).forEach((c, i) => (s[HERO_ALL[i]] = c));
    parseCards(params.board)
      .filter((c) => !s.includes(c))
      .slice(0, 5)
      .forEach((c, i) => (s[BOARD[i]] = c));
    return s;
  });
  const [mode, setMode] = useState<'range' | 'cards'>(() => (n === 4 ? 'cards' : 'range'));
  const [rangePct, setRangePct] = useState(20);
  // Fill order: your cards, villain's cards, then the board (optional), like dealing a hand.
  const order = (m: typeof mode, k = n) => [...HERO_ALL.slice(0, k), ...(m === 'cards' ? VILLAIN_ALL.slice(0, k) : []), ...BOARD];
  const firstEmpty = (s: (CardCode | null)[], m = mode, k = n) => order(m, k).find((i) => !s[i]) ?? null;
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
  const result = useMemo(
    () => (boardGap ? null : oddsEquity(game, hero, villain, board, mode, rangePct)),
    [game, heroKey, villainKey, boardKey, mode, rangePct, boardGap], // eslint-disable-line react-hooks/exhaustive-deps
  );

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
    setSlots(Array(SLOTS).fill(null));
    setActive(0);
  };
  const switchMode = (m: 'range' | 'cards') => {
    setMode(m);
    if (m === 'range') setSlots((s) => s.map((c, i) => (VILLAIN_ALL.includes(i) ? null : c)));
    if (m === 'cards') setActive(firstEmpty(slots, 'cards'));
    else setActive(firstEmpty(slots.map((c, i) => (VILLAIN_ALL.includes(i) ? null : c)), 'range'));
  };
  // PLO is cards against cards (the ranges are hold'em hands); back to hold'em drops the extra two.
  const switchGame = (g: OddsGame) => {
    if (g === game) return;
    const k = oddsHole(g);
    const next = slots.map((c, i) => (g === 'nlhe' && (HERO_ALL.indexOf(i) >= 2 || VILLAIN_ALL.indexOf(i) >= 2) ? null : c));
    const m = g === 'plo' ? 'cards' : mode;
    setGame(g);
    setMode(m);
    setSlots(next);
    setActive(firstEmpty(next, m, k));
  };

  const pctLabel = (e: number) => pct(e, 1);
  const street = boardLen === 0 ? t('Pré-flop') : boardLen === 3 ? 'Flop' : boardLen === 4 ? 'Turn' : 'River';

  return (
    <>
      <Stack.Screen options={{ title: t('Calculadora de equity') }} />
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
            missing={
              hero.length < n
                ? n === 4 ? t('Escolhe as tuas quatro cartas.') : t('Escolhe as tuas duas cartas.')
                : boardGap
                  ? t('Completa o flop (ou tira o turn e o river).')
                  : n === 4 ? t('Escolhe as quatro cartas do vilão.') : t('Escolhe as duas cartas do vilão.')
            }
            label={mode === 'range' ? `vs top ${rangePct}%` : t('vs cartas do vilão')} street={street} fmt={pctLabel} />
        </Card>

        <Section title={t('Jogo')}>
          <Segmented
            options={[
              { key: 'nlhe', label: "Hold'em" },
              { key: 'plo', label: 'PLO' },
            ]}
            value={game}
            onChange={switchGame}
          />
        </Section>

        {/* PLO has no range choice: villain's four cards are picked on the card above. */}
        {game === 'nlhe' ? (
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
        ) : null}

        <Section title={t('Escolhe as cartas')} action={used.size ? t('Limpar') : undefined} onAction={clear} hint={game === 'plo' ? t('Toca num lugar para o mudar.') : t('Toca num lugar para o mudar. Range: 4-bet ≈ top 4%, 3-bet ≈ top 8%, open ≈ top 20%, call ≈ top 40%.')}>
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
