// "Onde ganhas e onde perdes": the player's own patterns as plain sentences,
// each with the bars and the sample behind it. Free players see the strongest
// one blurred, with the way to Pro.

import { BlurView } from 'expo-blur';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { locale, t } from '@/i18n';
import { money } from '@/poker/format';
import { insights, MIND_IDS, MIN_SESSIONS, type Insight, type MindId } from '@/store/insights-math';
import type { Session } from '@/store/types';
import { C, R, S } from '@/theme';

import { Button, Card, Row, Section, T } from './ui';

/** About how many sessions it takes before the first card can appear. */
const FIRST_AT = 4 * MIN_SESSIONS;

export function Insights({ list, cur, hidden, result, mind }: { list: Session[]; cur: string; hidden: boolean; result?: (s: Session) => number; /** The mental game journal's cards (its own screen); without it, every other card. */ mind?: boolean }) {
  const { isPro, paywall } = usePro();
  const fmt = useMemo(() => (n: number) => (hidden ? '•••' : money(n, cur)), [hidden, cur]);
  const all = useMemo(() => insights(list, (n) => fmt(Math.round(n)), { result }).filter((x) => !!mind === MIND_IDS.includes(x.id as MindId)), [list, fmt, result, mind]);
  const done = list.filter((s) => s.endedAt).length;

  if (!all.length && mind) {
    return (
      <Section title={t('O que o diário já diz')}>
        <Card tone="inset" style={{ gap: S.xs }}>
          <T v="small">{t('Mostramos como o sono, a energia, o foco e o tilt mexem no teu resultado quando houver pelo menos {n} sessões de cada lado.', { n: MIN_SESSIONS })}</T>
          <T v="tiny">{t('Ex.: 5 sessões depois de dormir menos de 6 h e 5 depois de dormir mais.')}</T>
        </Card>
      </Section>
    );
  }

  if (!all.length) {
    return (
      <Section title={t('Onde ganhas e onde perdes')}>
        <Card tone="inset" style={{ gap: S.xs }}>
          <T v="small">{t('Com mais sessões mostramos-te onde ganhas e onde perdes: horas, dias, salas, stakes e o que acontece depois de uma perda grande.')}</T>
          <T v="tiny">{done < FIRST_AT ? t('Tens {n} sessões. As primeiras conclusões aparecem por volta das {m}.', { n: done, m: FIRST_AT }) : t('Ainda não há diferenças com sessões suficientes de cada lado.')}</T>
        </Card>
      </Section>
    );
  }

  if (!isPro) {
    return (
      <Section title={mind ? t('O que o diário já diz') : t('Onde ganhas e onde perdes')}>
        <View style={{ borderRadius: R.lg, overflow: 'hidden' }}>
          <InsightCard x={all[0]} fmt={fmt} />
          <BlurView intensity={28} tint="dark" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: S.lg, gap: S.sm }]}>
            <T v="h3" style={{ textAlign: 'center' }}>
              {all.length === 1 ? t('Encontrámos 1 padrão nas tuas sessões') : t('Encontrámos {n} padrões nas tuas sessões', { n: all.length })}
            </T>
            <Button size="md" icon="lock-closed" title={t('Vê onde perdes dinheiro')} onPress={() => paywall('stats')} />
          </BlurView>
        </View>
      </Section>
    );
  }

  return (
    <Section title={mind ? t('O que o diário já diz') : t('Onde ganhas e onde perdes')} hint={t('Só mostramos uma diferença com pelo menos {n} sessões de cada lado.', { n: MIN_SESSIONS })}>
      <View style={{ gap: S.sm }}>
        {all.map((x) => (
          <InsightCard key={x.id} x={x} fmt={fmt} />
        ))}
      </View>
    </Section>
  );
}

function InsightCard({ x, fmt }: { x: Insight; fmt: (n: number) => string }) {
  const max = Math.max(...x.groups.map((g) => Math.abs(g.rate)), 1);
  // Rounded first, so a rate just above 0 doesn't read "+0"; masked amounts keep their sign.
  const signed = (n: number) => {
    const r = Math.round(n);
    return (r > 0 ? '+' : r < 0 && fmt(-1) === '•••' ? '−' : '') + unit(r);
  };
  const unit = (n: number) => (x.unit === 'hour' ? t('{amount}/h', { amount: fmt(Math.round(n)) }) : t('{amount}/sessão', { amount: fmt(Math.round(n)) }));
  return (
    <Card style={{ gap: S.md }}>
      <T v="h3">{x.title}</T>
      <View style={{ gap: 8 }}>
        {x.groups.map((g) => (
          <Row key={g.label} gap={S.sm}>
            <T v="small" numberOfLines={1} style={{ width: 104 }}>
              {g.label}
            </T>
            <View style={{ flex: 1, height: 8, borderRadius: R.pill, backgroundColor: C.surface3, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(3, (Math.abs(g.rate) / max) * 100)}%`, height: 8, borderRadius: R.pill, backgroundColor: g.rate >= 0 ? C.good : C.bad }} />
            </View>
            <T v="monoS" color={g.rate >= 0 ? C.good : C.bad} style={{ minWidth: 72, textAlign: 'right' }}>
              {signed(g.rate)}
            </T>
          </Row>
        ))}
      </View>
      <T v="tiny">
        {x.id === 'tilt' || x.id === 'tiltNext' ? x.detail + ' ' : ''}
        {t('Com base em {n} sessões e {h} h.', { n: x.sample.sessions, h: Math.round(x.sample.hours).toLocaleString(locale) })}
      </T>
    </Card>
  );
}
