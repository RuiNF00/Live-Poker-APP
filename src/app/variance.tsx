// Variance calculator: what a win rate and a standard deviation mean over the
// next N hours (cash) or N tournaments. Works with typed numbers for anyone;
// filling them from your own sessions is Pro.

import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { Button, Card, Chip, ChipRow, Divider, NumField, Row, Section, Segmented, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { money } from '@/poker/format';
import { cashStats, mttStats, project } from '@/store/results-math';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

type Mode = 'cash' | 'mtt';
const COUNTS = [50, 100, 250, 500, 1000];

export default function VarianceScreen() {
  const { sessions, defaultBankroll } = useStore();
  const { isPro, paywall } = usePro();
  const params = useLocalSearchParams<{ currency?: string }>();
  const cur = params.currency || defaultBankroll.currency;
  const cash = cashStats(sessions, cur);
  const mtt = mttStats(sessions, cur);
  const [mode, setMode] = useState<Mode>(mtt && (!cash || mtt.tournaments > cash.sessions) ? 'mtt' : 'cash');
  const [hourly, setHourly] = useState(15);
  const [sdHour, setSdHour] = useState(100);
  const [hours, setHours] = useState(100);
  const [buyIn, setBuyIn] = useState(150);
  const [roi, setRoi] = useState(20);
  const [sdBi, setSdBi] = useState(6);
  const [count, setCount] = useState(100);

  const mine = mode === 'cash' ? cash : mtt;
  const useMine = () => {
    if (!isPro) return paywall('stats');
    if (mode === 'cash' && cash) {
      setHourly(Math.round(cash.hourly));
      setSdHour(Math.round(cash.sdHour));
    } else if (mode === 'mtt' && mtt) {
      setBuyIn(Math.round(mtt.avgBuyIn));
      setRoi(Math.round(mtt.roi));
      setSdBi(Math.max(1, Math.round(mtt.sdBuyIns)));
    }
  };

  const p = mode === 'cash' ? project(hourly, sdHour, hours) : project((roi / 100) * buyIn, sdBi * buyIn, count);
  const n = mode === 'cash' ? hours : count;
  const unit = (k: number) => (mode === 'cash' ? t('{n} h', { n: k.toLocaleString(locale) }) : k === 1 ? t('1 torneio') : t('{n} torneios', { n: k.toLocaleString(locale) }));
  const signed = (v: number) => (v > 0 ? '+' : '') + money(Math.round(v), cur);
  const pct = (x: number) => `${(x * 100).toLocaleString(locale, { maximumFractionDigits: x < 0.1 ? 1 : 0 })}%`;

  return (
    <>
      <Stack.Screen options={{ title: t('Variância') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Segmented
          options={[
            { key: 'cash', label: 'Cash' },
            { key: 'mtt', label: t('Torneios') },
          ]}
          value={mode}
          onChange={setMode}
        />

        <Card tone={mine ? 'accent' : 'inset'} style={{ gap: S.sm }}>
          <Row>
            <Ionicons name="person-circle-outline" size={20} color={mine ? C.accent : C.muted} />
            <T v="h3" style={{ flex: 1 }}>
              {t('Os teus números')}
            </T>
          </Row>
          <T v="small">
            {mode === 'cash'
              ? cash
                ? t('{n} sessões de cash, {h} h: {rate}/h com desvio padrão de {sd}/h.', { n: cash.sessions, h: Math.round(cash.hours), rate: money(Math.round(cash.hourly), cur), sd: money(Math.round(cash.sdHour), cur) })
                : t('Com 3 sessões de cash terminadas calculamos o teu win rate e desvio padrão.')
              : mtt
                ? t('{n} torneios: ROI {roi}, buy-in médio {bi}, desvio padrão de {sd} buy-ins.', { n: mtt.tournaments, roi: `${Math.round(mtt.roi)}%`, bi: money(Math.round(mtt.avgBuyIn), cur), sd: mtt.sdBuyIns.toFixed(1) })
                : t('Com 5 torneios terminados calculamos o teu ROI e desvio padrão.')}
          </T>
          {mine ? <Button size="sm" kind={isPro ? 'secondary' : 'outline'} icon={isPro ? 'download-outline' : 'lock-closed'} title={isPro ? t('Usar os meus números') : t('Usar os meus números com Pro')} onPress={useMine} style={{ alignSelf: 'flex-start' }} /> : null}
        </Card>

        <Section title={t('Pressupostos ({currency})', { currency: cur })} hint={
            t('Win rate: o que ganhas em média por hora (em torneios, o ROI). Desvio padrão: quanto um resultado costuma fugir dessa média; quanto maior, mais longas as fases boas e más.') +
            ' ' +
            (mode === 'cash' ? t('Em cash live, o desvio padrão costuma andar entre 30 e 60 big blinds por hora. Ex.: em 1/2, 60 a 120 por hora.') : t('Em torneios, o desvio padrão costuma ser de 3 a 6 buy-ins em campos pequenos e mais em campos grandes.'))
          }>
          <Card style={{ gap: S.md }}>
            {mode === 'cash' ? (
              <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
                <NumField label={t('Win rate /h')} value={hourly} onChange={setHourly} />
                <NumField label={t('Desvio padrão /h')} value={sdHour} onChange={setSdHour} />
              </Row>
            ) : (
              <>
                <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
                  <NumField label={t('Buy-in médio')} value={buyIn} onChange={setBuyIn} />
                  <NumField label="ROI %" value={roi} onChange={setRoi} />
                </Row>
                <Row>
                  <NumField label={t('Desvio padrão (buy-ins)')} value={sdBi} onChange={setSdBi} />
                </Row>
              </>
            )}
          </Card>
        </Section>

        <Section title={mode === 'cash' ? t('Horas a jogar') : t('Torneios a jogar')}>
          <ChipRow>
            {COUNTS.map((k) => (
              <Chip key={k} label={k.toLocaleString(locale)} active={n === k} onPress={() => (mode === 'cash' ? setHours(k) : setCount(k))} style={{ minWidth: 56 }} />
            ))}
          </ChipRow>
          <Row>
            <NumField label={t('Outro valor')} value={n} onChange={(v) => (mode === 'cash' ? setHours(Math.min(100000, v)) : setCount(Math.min(100000, v)))} />
          </Row>
        </Section>

        {n > 0 ? (
          <Card tone="raised" style={{ gap: S.md }}>
            <View style={{ gap: 2 }}>
              <T v="label">{t('Resultado esperado em {n}', { n: unit(n) })}</T>
              <T v="monoXL" color={p.mean >= 0 ? C.good : C.bad} numberOfLines={1} adjustsFontSizeToFit>
                {signed(p.mean)}
              </T>
            </View>
            <RangeBar lo95={p.lo95} lo68={p.lo68} mean={p.mean} hi68={p.hi68} hi95={p.hi95} />
            <Divider />
            <Line label={t('2 em cada 3 vezes')} value={`${signed(p.lo68)}  a  ${signed(p.hi68)}`} />
            <Line label={t('19 em cada 20 vezes')} value={`${signed(p.lo95)}  a  ${signed(p.hi95)}`} />
            <Line label={t('Probabilidade de acabar a perder')} value={pct(p.pLoss)} color={p.pLoss > 0.25 ? C.bad : undefined} />
            {p.unitsFor95 !== null ? <Line label={t('Para teres 95% de certeza de ganhar')} value={unit(p.unitsFor95)} /> : null}
          </Card>
        ) : null}

        <T v="tiny" style={{ textAlign: 'center' }}>
          {t('Aproximação normal: com poucas horas ou torneios os extremos são mais prováveis do que parece.')}
        </T>
      </ScrollView>
    </>
  );
}

function Line({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Row>
      <T v="small" style={{ flex: 1 }}>
        {label}
      </T>
      <T v="mono" color={color ?? C.text} style={{ fontSize: 15, lineHeight: 20 }}>
        {value}
      </T>
    </Row>
  );
}

/** 95% range as a track, 68% as a band, a tick for the expected result and one for zero. */
function RangeBar({ lo95, lo68, mean, hi68, hi95 }: { lo95: number; lo68: number; mean: number; hi68: number; hi95: number }) {
  const lo = Math.min(lo95, 0);
  const hi = Math.max(hi95, 0);
  const span = hi - lo || 1;
  const at = (v: number) => `${((v - lo) / span) * 100}%` as const;
  return (
    <View style={{ height: 34, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: at(lo95), right: `${100 - ((hi95 - lo) / span) * 100}%`, height: 8, borderRadius: R.pill, backgroundColor: C.surface3 }} />
      <View style={{ position: 'absolute', left: at(lo68), right: `${100 - ((hi68 - lo) / span) * 100}%`, height: 8, borderRadius: R.pill, backgroundColor: mean >= 0 ? C.good : C.bad, opacity: 0.55 }} />
      <View style={{ position: 'absolute', left: at(0), width: 1, top: 2, bottom: 2, backgroundColor: C.textDim }} />
      <View style={{ position: 'absolute', left: at(mean), marginLeft: -2, width: 4, height: 22, borderRadius: 2, backgroundColor: C.text }} />
    </View>
  );
}
