import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { t } from '@/i18n';
import { positions } from '@/poker/engine';
import { pct } from '@/poker/format';
import { icmCall, payoutPreset, pkoBountyChips, pkoRequiredEquity, riskPremiumMatrix, type PayoutPreset } from '@/poker/icm';
import type { Hand } from '@/poker/types';
import { C, F, R, ff } from '@/theme';

import { Chip, Field, tap } from '../ui';
import type { RpFacing } from './model';

const PRESETS: { key: PayoutPreset; label: string }[] = [
  { key: 'satellite', label: 'Satélite' },
  { key: 'flat', label: 'Flat' },
  { key: 'standard', label: 'Média' },
  { key: 'top', label: 'Top-heavy' },
];

/** Paid places at this table to start from: on the bubble one player misses out. */
function defaultPaid(hand: Hand, n: number): number {
  return hand.game.stage === 'bubble' ? Math.max(1, n - 1) : n;
}

/**
 * Tournament hands: what the prize money does to hero's decision. The call hero faces, priced
 * with ICM against the chips-only pot odds, and a risk-premium table for every pair at the table.
 * PKO: a bounty hero covers lowers the equity needed. Prizes are shares of the pool.
 */
export function IcmPanel({ hand, facing }: { hand: Hand; facing: RpFacing | null }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<PayoutPreset>('standard');
  const seated = useMemo(() => hand.players.map((p, i) => ({ i, stack: p.stack })).filter((p) => p.stack > 0), [hand.players]);
  const [paid, setPaid] = useState(() => defaultPaid(hand, seated.length));
  const [bounty, setBounty] = useState('');
  const [start, setStart] = useState('');
  const payouts = useMemo(() => payoutPreset(preset, Math.min(paid, seated.length)), [preset, paid, seated.length]);
  const pos = useMemo(() => positions(hand.players.length, hand.button), [hand.players.length, hand.button]);

  const call = useMemo(() => {
    if (!facing || facing.villain == null) return null;
    const h = hand.hero;
    const v = facing.villain;
    // What villain bet beyond what hero can match goes back to villain.
    const uncalled = Math.max(0, facing.bets[v] - (facing.bets[h] + facing.stacks[h]));
    const stacks = facing.stacks.slice();
    stacks[v] += uncalled;
    return {
      ...icmCall({ stacks, payouts, hero: h, villain: v, pot: facing.potAll - uncalled, call: facing.call }),
      covers: facing.stacks[h] + facing.bets[h] >= facing.stacks[v] + facing.bets[v],
      potAfter: facing.potAll - uncalled + facing.call,
    };
  }, [facing, hand.hero, payouts]);

  const matrix = useMemo(() => (open ? riskPremiumMatrix(seated.map((p) => p.stack), payouts) : null), [open, seated, payouts]);
  const buyIn = hand.game.buyIn ?? 0;
  const kappa = call?.covers ? pkoBountyChips(Number(bounty.replace(',', '.')) || 0, Number(start.replace(/\D/g, '')) || 0, buyIn) : 0;
  const pkoEq = call && kappa > 0 ? pkoRequiredEquity(facing!.call, call.potAfter, kappa) : null;
  const bigField = (hand.game.playersLeft ?? 0) > seated.length;

  const summary = call
    ? `${t('Precisas de')} ${pct(call.icmEq, 1)} · ${call.riskPremium >= 0 ? '+' : ''}${pct(call.riskPremium, 1)} ${t('pelo ICM')}`
    : t('Risk premium entre jogadores');

  return (
    <View style={{ borderRadius: R.md, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`ICM. ${summary}`}
        onPress={() => {
          tap('select');
          setOpen((o) => !o);
        }}
        style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, opacity: pressed ? 0.75 : 1 })}>
        <Ionicons name="trophy-outline" size={15} color={C.warn} />
        <Text style={{ color: C.text, fontFamily: ff(800), fontSize: 13, letterSpacing: 0.4 }}>ICM</Text>
        <Text numberOfLines={1} style={{ flex: 1, color: C.textDim, fontFamily: F.medium, fontSize: 12 }}>
          {summary}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.textDim} />
      </Pressable>

      {open ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map((p) => (
              <Chip key={p.key} label={t(p.label)} active={preset === p.key} onPress={() => setPreset(p.key)} style={{ minHeight: 30, paddingHorizontal: 10 }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ flex: 1, color: C.textDim, fontFamily: F.medium, fontSize: 12 }}>
              {t('Lugares pagos nesta mesa')}: <Text style={{ color: C.text, fontFamily: F.mono }}>{Math.min(paid, seated.length)}</Text>
            </Text>
            <Step icon="remove" label={t('Menos lugares pagos')} onPress={() => setPaid((x) => Math.max(1, Math.min(x, seated.length) - 1))} />
            <Step icon="add" label={t('Mais lugares pagos')} onPress={() => setPaid((x) => Math.min(seated.length, x + 1))} />
          </View>

          {call ? (
            <View style={{ gap: 4 }}>
              <Line label={t('Pot odds (fichas)')} value={pct(call.chipEq, 1)} color={C.info} />
              <Line label={t('Equity precisa com ICM')} value={pct(call.icmEq, 1)} color={C.warn} />
              <Line label="Risk premium" value={`${call.riskPremium >= 0 ? '+' : ''}${pct(call.riskPremium, 1)}`} color={C.accent} />
              {pkoEq != null ? <Line label={t('Com o bounty')} value={pct(pkoEq, 1)} color={C.good} /> : null}
            </View>
          ) : null}

          {call?.covers && buyIn > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.textDim, fontFamily: F.medium, fontSize: 12 }}>{t('PKO: cobres o vilão. Põe o bounty dele para ver a equity com o bounty.')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Field style={{ flex: 1 }} label={`${t('Bounty do vilão')} (${hand.game.currency})`} keyboardType="decimal-pad" value={bounty} onChangeText={setBounty} placeholder="0" />
                <Field style={{ flex: 1 }} label={t('Stack inicial')} keyboardType="number-pad" value={start} onChangeText={setStart} placeholder="20000" />
              </View>
            </View>
          ) : null}

          {matrix ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.textDim, fontFamily: F.medium, fontSize: 12 }}>
                {t('Risk premium: a linha paga o all-in da coluna, com os stacks do início da mão.')}
              </Text>
              <Matrix labels={seated.map((p) => pos[p.i])} heroRow={seated.findIndex((p) => p.i === hand.hero)} m={matrix} />
            </View>
          ) : null}
          <Text style={{ color: C.muted, fontFamily: F.regular, fontSize: 11, lineHeight: 15 }}>
            {bigField ? t('Conta só com os jogadores desta mesa, como se fosse a mesa final.') + ' ' : ''}
            {t('Prémios em percentagem do prize pool.')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Line({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={{ flex: 1, color: C.textDim, fontFamily: F.medium, fontSize: 13 }}>{label}</Text>
      <Text style={{ color, fontFamily: F.mono, fontSize: 14 }}>{value}</Text>
    </View>
  );
}

function Step({ icon, label, onPress }: { icon: 'add' | 'remove'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        tap('select');
        onPress();
      }}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={16} color={C.text} />
    </Pressable>
  );
}

/** Rows call, columns shove. Warmer cells cost more equity than the chips say. */
function Matrix({ labels, heroRow, m }: { labels: string[]; heroRow: number; m: number[][] }) {
  const cell = { flex: 1, height: 26, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        <View style={{ width: 44 }} />
        {labels.map((l, j) => (
          <View key={j} style={cell}>
            <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.medium, fontSize: 10 }}>
              {l}
            </Text>
          </View>
        ))}
      </View>
      {m.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 2 }}>
          <View style={{ width: 44, height: 26, justifyContent: 'center' }}>
            <Text numberOfLines={1} style={{ color: i === heroRow ? C.accent : C.textDim, fontFamily: ff(700), fontSize: 11 }}>
              {labels[i]}
            </Text>
          </View>
          {row.map((x, j) => {
            const heat = Number.isNaN(x) ? 0 : Math.max(0, Math.min(1, x / 0.25));
            return (
              <View key={j} style={[cell, { borderRadius: 4, backgroundColor: Number.isNaN(x) ? 'transparent' : `rgba(255,106,61,${0.06 + heat * 0.5})`, borderWidth: i === heroRow && !Number.isNaN(x) ? 1 : 0, borderColor: C.accentLine }]}>
                <Text numberOfLines={1} style={{ color: Number.isNaN(x) ? C.muted : C.text, fontFamily: F.mono, fontSize: 10 }}>
                  {Number.isNaN(x) ? '·' : Math.round(x * 100)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
