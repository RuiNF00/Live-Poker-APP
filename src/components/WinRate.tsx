// Cash win rate with its margin of error: "+42 €/h, provavelmente entre −10 e
// +94". The headline is free; the breakdowns and "how many hours until you
// know" live on /winrate behind Pro.

import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View } from 'react-native';

import { locale, t } from '@/i18n';
import { money, plus } from '@/poker/format';
import { SMALL, type WinRate } from '@/store/winrate-math';
import { C, R, S } from '@/theme';

import { SmallSample } from './SmallSample';
import { Card, Row, T } from './ui';

export const signed = (n: number, fmt: (n: number) => string) => plus(n, true) + fmt(Math.abs(n));
// A rate, not an amount: the sign stays in privacy mode, as a real minus sign (−1,8, not -1,8).
const bb = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: Math.abs(n) < 10 ? 1 : 0 }).replace('-', '−');

/** The headline: rate, 95% range, BB/h and the sample behind it. */
export function WinRateCard({ w, cur, hidden, onPress }: { w: WinRate; cur: string; hidden: boolean; onPress?: () => void }) {
  const fmt = (n: number) => (hidden ? '•••' : money(Math.round(n), cur));
  return (
    <Card
      onPress={onPress}
      style={{ gap: S.sm }}
      accessibilityLabel={[
        `${t('Win rate em cash')}: ${t('{amount}/h', { amount: signed(Math.round(w.hourly), fmt) })}`,
        t('Provavelmente entre {lo} e {hi} por hora.', { lo: signed(Math.round(w.lo), fmt), hi: signed(Math.round(w.hi), fmt) }).replace(/\.$/, ''),
        w.sessions === 1 ? t('{h} h em 1 sessão', { h: Math.round(w.hours).toLocaleString(locale) }) : t('{h} h em {n} sessões', { h: Math.round(w.hours).toLocaleString(locale), n: w.sessions }),
      ].join('. ')}>
      <Row>
        <T v="label" style={{ flex: 1 }}>
          {t('Win rate em cash')}
        </T>
        {onPress ? <Ionicons name="chevron-forward" size={17} color={C.muted} /> : null}
      </Row>
      <T v="monoL" color={w.hourly >= 0 ? C.good : C.bad}>
        {t('{amount}/h', { amount: signed(Math.round(w.hourly), fmt) })}
      </T>
      <T v="body">{t('Provavelmente entre {lo} e {hi} por hora.', { lo: signed(Math.round(w.lo), fmt), hi: signed(Math.round(w.hi), fmt) })}</T>
      <Interval lo={w.lo} hi={w.hi} mid={w.hourly} />
      <T v="small">
        {[
          t('{bb} BB/h (entre {lo} e {hi})', { bb: (w.bbHourly > 0 ? '+' : '') + bb(w.bbHourly), lo: bb(w.bbLo), hi: bb(w.bbHi) }),
          t('desvio padrão {sd}/h', { sd: fmt(w.sd) }),
          w.sessions === 1 ? t('{h} h em 1 sessão', { h: Math.round(w.hours).toLocaleString(locale) }) : t('{h} h em {n} sessões', { h: Math.round(w.hours).toLocaleString(locale), n: w.sessions }),
        ].join(' · ')}
      </T>
      {w.small ? <WinRateSample w={w} /> : null}
      <T v="tiny">{t('Intervalo de 95%: com estes resultados, o teu win rate verdadeiro está quase de certeza aqui dentro. Estreita com mais horas.')}</T>
    </Card>
  );
}

/** The shared low-sample note or pill, on whichever falls short: sessions first, then hours. */
export function WinRateSample({ w, pill }: { w: WinRate; pill?: boolean }) {
  const variant = pill ? 'pill' : 'note';
  const el =
    w.sessions < SMALL.sessions ? (
      <SmallSample n={w.sessions} min={SMALL.sessions} variant={variant} unit={t('sessões')} />
    ) : (
      <SmallSample n={Math.floor(w.hours)} min={SMALL.hours} variant={variant} unit="h" />
    );
  return pill ? <View style={{ alignSelf: 'flex-start' }}>{el}</View> : el;
}

/**
 * The 95% range as a bar on a scale that always shows zero: green when it
 * stays above zero, red when below, grey when it straddles it.
 */
export function Interval({ lo, hi, mid, span }: { lo: number; hi: number; mid: number; span?: [number, number] }) {
  const [a, b] = span ?? [Math.min(lo, 0), Math.max(hi, 0)];
  const w = b - a || 1;
  const at = (v: number) => `${((v - a) / w) * 100}%` as const;
  const col = lo > 0 ? C.good : hi < 0 ? C.bad : C.textDim;
  return (
    <View style={{ height: 18, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: R.pill, backgroundColor: C.surface3 }} />
      <View style={{ position: 'absolute', left: at(lo), width: `${((hi - lo) / w) * 100}%`, height: 6, borderRadius: R.pill, backgroundColor: col, opacity: 0.6 }} />
      <View style={{ position: 'absolute', left: at(0), width: 1, top: 0, bottom: 0, backgroundColor: C.textDim }} />
      <View style={{ position: 'absolute', left: at(mid), marginLeft: -2, width: 4, height: 14, borderRadius: 2, backgroundColor: C.text }} />
    </View>
  );
}
