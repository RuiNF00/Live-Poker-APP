// Downswings: how far below its best the profit curve is now, the biggest
// fall so far (in money and buy-ins), and whether a fall like that is normal
// for the player's own results. The read replays their sessions in random
// order; it is Pro, the numbers above it are not.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { ProBlur, useLocked } from '@/components/ProGate';
import { Card, Row, Section, Stat, StatGrid, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { minus, money } from '@/poker/format';
import { DOWNSWING_MIN, downswingOdds, downswings, usualBuyIn, type Downswing } from '@/store/results-math';
import { profit } from '@/store/session-math';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

const DAY = 86400000;
const date = (ts: number) => new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

export default function DownswingScreen() {
  const { sessions, defaultBankroll, settings } = useStore();
  const locked = useLocked('downswingRead');
  const params = useLocalSearchParams<{ currency?: string }>();
  const cur = params.currency || defaultBankroll.currency;
  const hidden = !!settings.hideAmounts;
  const fmt = (n: number) => (hidden ? '•••' : money(n, cur));
  const done = useMemo(() => sessions.filter((s) => s.endedAt && s.currency === cur).sort((a, b) => a.endedAt! - b.endedAt!), [sessions, cur]);
  const d = useMemo(() => downswings(done, cur), [done, cur]);
  const odds = useMemo(() => downswingOdds(done.map(profit)), [done]);
  const bi = usualBuyIn(done, cur);
  const inBi = (n: number) => (bi > 0 ? t('{n} buy-ins', { n: (n / bi).toLocaleString(locale, { maximumFractionDigits: 1 }) }) : '');
  const cu = d.current;
  const big = d.biggest;

  return (
    <>
      <Stack.Screen options={{ title: t('Downswings') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }}>
        <Card tone="raised" style={{ gap: S.sm }}>
          <T v="label">{t('Agora')}</T>
          {cu ? (
            <>
              <T v="monoXL" color={C.bad} numberOfLines={1} adjustsFontSizeToFit>
                −{fmt(cu.depth)}
              </T>
              <T v="small">
                {[inBi(cu.depth), cu.sessions === 1 ? t('1 sessão desde o pico') : t('{n} sessões desde o pico', { n: cu.sessions }), t('pico a {date}', { date: date(cu.from) })].filter(Boolean).join(' · ')}
              </T>
            </>
          ) : (
            <>
              <T v="monoXL" color={C.good}>
                {done.length ? t('No pico') : '—'}
              </T>
              <T v="small">{done.length ? t('O teu resultado acumulado está no ponto mais alto.') : t('Sem sessões terminadas em {currency}.', { currency: cur })}</T>
            </>
          )}
          {done.length > 1 ? (
            <View style={{ marginTop: S.sm }}>
              <Underwater values={d.underwater} label={
                  cu
                    ? t('Gráfico das quedas: agora −{now} abaixo do pico, no máximo −{max}.', { now: fmt(cu.depth), max: fmt(big?.depth ?? 0) })
                    : t('Gráfico das quedas: agora no pico, no máximo −{max}.', { max: fmt(big?.depth ?? 0) })
                } />
              <T v="tiny">{t('Quanto estavas abaixo do teu melhor resultado acumulado, sessão a sessão. Zero é um pico.')}</T>
            </View>
          ) : null}
        </Card>

        {big ? (
          <Section title={t('O maior até hoje')}>
            <StatGrid cols={2}>
              <Stat label={t('Queda')} sub={inBi(big.depth) || undefined} value={minus() + fmt(big.depth)} tone="bad" />
              <Stat label={t('Duração')} sub={t('Do pico ao fundo')} value={big.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: big.sessions })} />
              <Stat label={t('Começou')} sub={t('No pico')} value={date(big.from)} />
              {/* Counted from the bottom, like the year card: how long it took to climb back. */}
              <Stat label={t('Recuperado')} sub={big.recovered ? t('Em {n} dias', { n: Math.max(1, Math.round((big.recovered - big.to) / DAY)) }) : t('Ainda não')} value={big.recovered ? date(big.recovered) : '—'} tone={big.recovered ? 'good' : 'bad'} />
            </StatGrid>
            {bi > 0 ? <T v="tiny">{t('Buy-in: o valor de entrada mais habitual nas tuas sessões, {amount}.', { amount: fmt(bi) })}</T> : null}
          </Section>
        ) : null}

        <Section title={t('É normal?')}>
          {odds ? (
            !locked ? (
              <Read odds={odds} big={big} cu={cu} fmt={fmt} cur={cur} />
            ) : (
              <ProBlur feature="downswingRead" locked title={t('Vê se este downswing é azar ou sinal')}>
                <Read odds={odds} big={big} cu={cu} fmt={() => '•••'} cur={cur} />
              </ProBlur>
            )
          ) : (
            <Card tone="inset" style={{ gap: S.xs }}>
              <T v="small">{t('Com {n} sessões terminadas dizemos se um downswing destes é normal para os teus resultados.', { n: DOWNSWING_MIN })}</T>
              <T v="tiny">{t('Tens {n} em {currency}.', { n: done.length, currency: cur })}</T>
            </Card>
          )}
        </Section>
      </ScrollView>
    </>
  );
}

function Read({ odds, big, cu, fmt, cur }: { odds: NonNullable<ReturnType<typeof downswingOdds>>; big: Downswing | null; cu: Downswing | null; fmt: (n: number) => string; cur: string }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const label = (p: number) => (p >= 0.2 ? { text: t('Normal'), color: C.good } : p >= 0.05 ? { text: t('Pouco comum'), color: C.warn } : { text: t('Raro'), color: C.bad });
  const losing = odds.mean <= 0;
  const line = (title: string, depth: number) => {
    const p = odds.atLeast(depth);
    const l = label(p);
    return (
      // Wraps at large text sizes: the reading drops below instead of squeezing the text.
      <Row style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 150, gap: 2 }}>
          <T v="body">{title}</T>
          <T v="small">{t('{pct} das simulações têm uma queda destas ou maior.', { pct: pct(p) })}</T>
        </View>
        <T v="h3" color={l.color}>
          {l.text}
        </T>
      </Row>
    );
  };
  const worst = big ? odds.atLeast(big.depth) : 1;
  return (
    <Card style={{ gap: S.md }}>
      <T v="small">
        {t('Baralhámos as tuas {n} sessões 1000 vezes, com o resultado médio que tens tido ({amount} por sessão), e medimos a maior queda de cada vez.', { n: odds.sessions, amount: fmt(odds.mean) })}
      </T>
      <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
        <Mini label={t('Queda típica')} value={minus() + fmt(Math.round(odds.typical))} />
        <Mini label={t('1 vez em 20')} value={minus() + fmt(Math.round(odds.bad))} />
      </Row>
      {big ? line(t('O teu maior: −{amount}', { amount: fmt(big.depth) }), big.depth) : null}
      {cu && cu !== big && cu.depth !== big?.depth ? line(t('O atual: −{amount}', { amount: fmt(cu.depth) }), cu.depth) : null}
      <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'flex-start' }}>
        <Ionicons name="information-circle-outline" size={16} color={C.muted} style={{ marginTop: 2 }} />
        <T v="tiny" style={{ flex: 1 }}>
          {losing
            ? t('Com um resultado médio negativo, as quedas são de esperar e não se recuperam sozinhas: o problema não é a variância.')
            : worst < 0.05
              ? t('Uma queda tão rara pode ser azar a sério, ou o teu resultado real ser mais baixo do que parece. Vale a pena rever as mãos dessas sessões.')
              : t('Uma queda destas cabe na variância dos teus resultados: não quer dizer que jogas pior.')}{' '}
          {t('Em {currency}, com {n} sessões: mais sessões, leitura mais firme.', { currency: cur, n: odds.sessions })}
        </T>
      </View>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    // minWidth: at large text sizes the two tiles stack instead of breaking words.
    <View style={{ flex: 1, minWidth: 128, gap: 2, padding: S.md, borderRadius: R.md, backgroundColor: C.surface2 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <T v="label">{label}</T>
      <T v="mono" color={C.bad} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
    </View>
  );
}

/** The curve below its running peak: 0 at a peak, red area below. */
function Underwater({ values, height = 110, label }: { values: number[]; height?: number; label: string }) {
  const [w, setW] = useState(0);
  const min = Math.min(-1, ...values);
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (v: number) => 2 + (v / min) * (height - 4);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height, marginBottom: S.xs }} accessible accessibilityRole="image" accessibilityLabel={label}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Path d={`${d} L${w},${y(0)} L0,${y(0)} Z`} fill={C.bad} fillOpacity={0.22} />
          <Path d={d} stroke={C.bad} strokeWidth={1.5} fill="none" />
          <Line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={C.border} />
        </Svg>
      ) : null}
    </View>
  );
}
