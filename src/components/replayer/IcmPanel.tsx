import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { t } from '@/i18n';
import { positions } from '@/poker/engine';
import { pct } from '@/poker/format';
import { icmCall, payoutPreset, pkoBountyChips, pkoRequiredEquity, riskPremiumMatrix, tablePaidPlaces } from '@/poker/icm';
import type { Hand } from '@/poker/types';
import { C, F, R, ff } from '@/theme';

import { Field, tap } from '../ui';
import type { RpFacing } from './model';

/**
 * Tournament hands, when the player turns it on in Settings: what the prize money does to hero's
 * decision, as an estimate. The only input is "100 players left of 300"; the call hero faces is
 * priced with ICM against the chips-only pot odds, with a risk-premium table for every pair.
 * PKO: a bounty hero covers lowers the equity needed. Prizes are shares of the pool.
 */
export function IcmPanel({ hand, facing }: { hand: Hand; facing: RpFacing | null }) {
  const [open, setOpen] = useState(false);
  const seated = useMemo(() => hand.players.map((p, i) => ({ i, stack: p.stack })).filter((p) => p.stack > 0), [hand.players]);
  const [left, setLeft] = useState(hand.game.playersLeft ? String(hand.game.playersLeft) : '');
  const [entrants, setEntrants] = useState('');
  const paid = tablePaidPlaces(seated.length, Number(left) || 0, Number(entrants) || 0, hand.game.stage === 'bubble' ? seated.length - 1 : seated.length);
  const [bounty, setBounty] = useState('');
  const [start, setStart] = useState('');
  const payouts = useMemo(() => payoutPreset('standard', paid), [paid]);
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
        <Text style={{ color: C.muted, fontFamily: F.medium, fontSize: 11 }}>{t('estimativa')}</Text>
        <Text numberOfLines={1} style={{ flex: 1, color: C.textDim, fontFamily: F.medium, fontSize: 12 }}>
          {summary}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.textDim} />
      </Pressable>

      {open ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field style={{ flex: 1 }} label={t('Jogadores restantes')} keyboardType="number-pad" value={left} onChangeText={(v) => setLeft(v.replace(/\D/g, ''))} placeholder="100" />
            <Field style={{ flex: 1 }} label={t('Inscritos')} keyboardType="number-pad" value={entrants} onChangeText={(v) => setEntrants(v.replace(/\D/g, ''))} placeholder="300" />
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
            {t('Estimativa: conta só com os stacks desta mesa e paga cerca de 15% do field. Serve de referência, não de resposta certa.')}
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
