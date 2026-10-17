// Cash win rate with its margin of error. The headline (rate, 95% range, BB/h)
// is free; how many hours until it means something, and the split by game,
// stake, room and weekday, are Pro.

import { BlurView } from 'expo-blur';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { useLocked } from '@/components/ProGate';
import { Button, Card, Row, Section, Segmented, T } from '@/components/ui';
import { Interval, signed, SmallSample, WinRateCard } from '@/components/WinRate';
import { locale, t } from '@/i18n';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { cashDone, hoursToKnow, USEFUL_BB, winRate, winRateBy, type WinRate, type WinRateBy, type WinRateGroup } from '@/store/winrate-math';
import { C, R, S } from '@/theme';

const n0 = (n: number) => Math.round(n).toLocaleString(locale);
const bb1 = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 1 });

export default function WinRateScreen() {
  const { sessions, defaultBankroll, settings } = useStore();
  const { paywall } = usePro();
  const locked = useLocked('winrateDetail');
  const params = useLocalSearchParams<{ currency?: string }>();
  const cur = params.currency || defaultBankroll.currency;
  const hidden = !!settings.hideAmounts;
  const [by, setBy] = useState<WinRateBy>('stake');
  const cash = useMemo(() => cashDone(sessions, cur), [sessions, cur]);
  const w = useMemo(() => winRate(cash), [cash]);
  const groups = useMemo(() => winRateBy(cash, by, cur), [cash, by, cur]);

  const lock = (title: string, body: React.ReactNode) =>
    !locked ? (
      body
    ) : (
      <View style={{ borderRadius: R.lg, overflow: 'hidden' }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
          {body}
        </View>
        <BlurView intensity={28} tint="dark" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: S.lg, gap: S.sm }]}>
          <T v="h3" style={{ textAlign: 'center' }}>
            {title}
          </T>
          <Button size="md" icon="lock-closed" title={t('Ver com Pro')} onPress={() => paywall('winrateDetail')} />
        </BlurView>
      </View>
    );

  return (
    <>
      <Stack.Screen options={{ title: t('Win rate') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }}>
        {w ? (
          <>
            <WinRateCard w={w} cur={cur} hidden={hidden} />
            <Section title={t('Quantas horas até saberes')}>{lock(t('Vê quantas horas faltam para o teu win rate ser fiável'), <HoursCard w={w} />)}</Section>
            <Section title={t('Onde ganhas')} hint={t('Só grupos com 2 ou mais sessões. A barra é o intervalo de 95%; o traço é o win rate.')}>
              <Segmented
                options={[
                  { key: 'stake', label: t('Stake') },
                  { key: 'game', label: t('Jogo') },
                  { key: 'venue', label: t('Sala') },
                  { key: 'weekday', label: t('Dia') },
                ]}
                value={by}
                onChange={setBy}
                size="sm"
              />
              {lock(t('Vê o teu win rate por jogo, stake, sala e dia'), <Groups groups={groups} cur={cur} hidden={hidden || locked} />)}
            </Section>
          </>
        ) : (
          <Card tone="inset" style={{ gap: S.xs }}>
            <T v="h3">{t('Ainda poucas sessões de cash')}</T>
            <T v="small">{t('Com 3 sessões de cash terminadas em {currency} mostramos o teu win rate e a margem de erro.', { currency: cur })}</T>
            <T v="tiny">{t('Tens {n} em {currency}.', { n: cash.length, currency: cur })}</T>
          </Card>
        )}
      </ScrollView>
    </>
  );
}

function HoursCard({ w }: { w: WinRate }) {
  const k = hoursToKnow(w);
  const there = k.left === 0;
  return (
    <Card style={{ gap: S.sm }}>
      <T v="h3">
        {there
          ? t('Já tens horas suficientes: o teu win rate está a ±{m} BB/h.', { m: bb1(k.margin) })
          : t('Faltam cerca de {h} h, umas {n} sessões como as tuas.', { h: n0(k.left), n: k.sessions })}
      </T>
      <T v="small">
        {t('Para saberes o teu win rate com uma margem de ±{u} BB/h precisas de cerca de {need} h com a tua variância. Hoje tens {have} h e a margem é de ±{m} BB/h.', {
          u: USEFUL_BB,
          need: n0(k.needed),
          have: n0(w.hours),
          m: bb1(k.margin),
        })}
      </T>
      <View style={{ height: 6, borderRadius: R.pill, backgroundColor: C.surface3, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(2, Math.min(1, w.hours / Math.max(1, k.needed)) * 100)}%`, height: 6, borderRadius: R.pill, backgroundColor: there ? C.good : C.accent }} />
      </View>
      <T v="tiny">{t('±5 BB/h chega para decidir se sobes de stake ou que jogos escolher. Quanto mais variância tens, mais horas são precisas.')}</T>
    </Card>
  );
}

function Groups({ groups, cur, hidden }: { groups: WinRateGroup[]; cur: string; hidden: boolean }) {
  const fmt = (n: number) => (hidden ? '•••' : money(Math.round(n), cur));
  if (!groups.length) {
    return (
      <Card tone="inset">
        <T v="small">{t('Ainda não há grupos com 2 ou mais sessões aqui.')}</T>
      </Card>
    );
  }
  const span: [number, number] = [Math.min(0, ...groups.map((g) => g.w.lo)), Math.max(0, ...groups.map((g) => g.w.hi))];
  return (
    <Card style={{ gap: S.lg }}>
      {groups.map((g) => (
        <View key={g.label} style={{ gap: 4 }}>
          <Row>
            <T v="body" style={{ flex: 1 }} numberOfLines={1}>
              {g.label}
            </T>
            <T v="mono" color={g.w.hourly >= 0 ? C.good : C.bad}>
              {t('{amount}/h', { amount: signed(Math.round(g.w.hourly), fmt) })}
            </T>
          </Row>
          <Interval lo={g.w.lo} hi={g.w.hi} mid={g.w.hourly} span={span} />
          <T v="tiny">
            {[t('entre {lo} e {hi}', { lo: signed(Math.round(g.w.lo), fmt), hi: signed(Math.round(g.w.hi), fmt) }), t('{h} h em {n} sessões', { h: n0(g.w.hours), n: g.w.sessions })].join(' · ')}
          </T>
          {g.w.small ? <SmallSample compact /> : null}
        </View>
      ))}
    </Card>
  );
}
