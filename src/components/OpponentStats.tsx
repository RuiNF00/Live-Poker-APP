// VPIP / PFR / 3-bet for a known opponent, from the hands entered against them.
// Shown when you tap their seat during hand entry and on their profile.

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { GLOSSARY, type TermKey } from '@/data/glossary';
import { t } from '@/i18n';
import { type OpponentStats } from '@/store/queries';
import { C, R, S } from '@/theme';

import type { PlayerNote } from '@/store/types';

import { Pill, Row, T } from './ui';
import { isSmallSample, sampleColor, SmallSample } from './SmallSample';

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}` : '—');

export function OpponentStatsRow({ stats }: { stats: OpponentStats | undefined }) {
  // Tapping a number explains it in one line under the row.
  const [term, setTerm] = useState<TermKey | null>(null);
  if (!stats?.hands) {
    return (
      <T v="tiny" color={C.textDim}>
        {t('Sem mãos com ação pré-flop contra este jogador.')}
      </T>
    );
  }
  const small = isSmallSample(stats.hands);
  const cells: { label: TermKey; value: string }[] = [
    { label: 'VPIP', value: pct(stats.vpip, stats.hands) },
    { label: 'PFR', value: pct(stats.pfr, stats.hands) },
    { label: '3-bet', value: pct(stats.threeBet, stats.threeBetOpp) },
  ];
  return (
    <View style={{ gap: 6 }}>
      <Row gap={S.sm}>
        {cells.map((c) => (
          <Pressable
            key={c.label}
            accessibilityRole="button"
            accessibilityLabel={`${c.label} ${c.value}`}
            accessibilityHint={t(GLOSSARY[c.label].line)}
            accessibilityState={{ expanded: term === c.label }}
            onPress={() => setTerm(term === c.label ? null : c.label)}
            style={{ flex: 1, backgroundColor: C.surface2, borderRadius: R.md, borderWidth: 1, borderColor: term === c.label ? C.borderStrong : C.border, paddingVertical: 8, alignItems: 'center', gap: 2 }}>
            <T v="label">{c.label}</T>
            <T v="monoL" color={sampleColor(stats.hands, C.text)}>
              {c.value}
            </T>
          </Pressable>
        ))}
      </Row>
      {term ? (
        <T v="small" color={C.text}>
          <T v="small" color={C.text} style={{ fontWeight: '700' }}>
            {term + ': '}
          </T>
          {t(GLOSSARY[term].line)}
        </T>
      ) : null}
      {small ? (
        <SmallSample n={stats.hands} variant="note" />
      ) : (
        <T v="tiny" color={C.textDim}>
          {t('{n} mãos', { n: stats.hands }) + ' · ' + t('Toca num número para o explicar')}
        </T>
      )}
    </View>
  );
}

/** Weak spots in green, danger in red, the rest neutral: what to exploit at a glance. */
export function tagColor(tag: string): string | undefined {
  if (['Fish', 'Calling station', 'Tilt', 'Passivo'].includes(tag)) return C.good;
  if (['Reg', 'LAG', 'Agressivo', 'Bluffer'].includes(tag)) return C.bad;
  if (['Nit', 'Tight'].includes(tag)) return C.info;
  return undefined;
}

/**
 * Who this is, in one glance when you seat them: their type tags, the first
 * line of your notes and how many sessions you've played with them.
 */
export function PlayerRead({ player, sessions }: { player: PlayerNote; sessions: number }) {
  const read = player.notes.split('\n').map((l) => l.trim()).find(Boolean);
  if (!player.tags.length && !read && !sessions) return null;
  return (
    <View style={{ gap: 6, backgroundColor: C.surface2, borderRadius: R.md, padding: S.sm }}>
      {player.tags.length ? (
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {player.tags.map((tg) => (
            <Pill key={tg} label={t(tg)} color={tagColor(tg)} />
          ))}
        </Row>
      ) : null}
      {read ? (
        <T v="small" color={C.text} numberOfLines={1}>
          {read}
        </T>
      ) : null}
      {sessions ? <T v="tiny">{sessions === 1 ? t('Visto em 1 sessão') : t('Visto em {n} sessões', { n: sessions })}</T> : null}
    </View>
  );
}
