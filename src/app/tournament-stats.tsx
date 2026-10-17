// Tournament results: one number and a verdict first, then where the money
// comes from (buy-in, festival, game), finishes, re-entries, bounties and the
// biggest scores. "O teu resultado" is after staking, swaps and expenses and
// matches the Bankroll tab; "Ação total" is the tournaments as played.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { SmallSample } from '@/components/SmallSample';
import { Button, Card, Chip, ChipRow, Divider, Empty, ListGroup, ListItem, Row, Section, Segmented, Stat, StatGrid, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { chips, compactMoney, decimal, money, shortDate } from '@/poker/format';
import { byCurrency } from '@/store/session-math';
import { useStore } from '@/store/store';
import { BANDS, bandOf, biggestScores, finishedTourneys, gameOf, groupBy, MIN_GROUP, MIN_SAMPLE, summarize, tripOf, type Group, type StatsView } from '@/store/tourney-stats';
import { C, S } from '@/theme';

const pct = (n: number | null, digits = 0) => (n === null ? '—' : `${n.toLocaleString(locale, { maximumFractionDigits: digits })}%`);
const signedPct = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString(locale) + '%';
const signedMoney = (n: number, cur: string) => (n > 0 ? '+' : '') + money(Math.round(n), cur);
/** "+23.1k€" / "+$23.1k" in a tile: a full amount doesn't fit a third of the screen. */
const compact = (n: number, cur: string, sign = true) => (Math.abs(n) < 10000 ? (sign ? signedMoney(n, cur) : money(Math.round(n), cur)) : (sign && n > 0 ? '+' : '') + compactMoney(n, cur));

export default function TournamentStatsScreen() {
  const { sessions, trips, settings } = useStore();
  const pro = usePro();
  const [view, setView] = useState<StatsView>('mine');
  const currencies = useMemo(() => byCurrency(sessions.filter((s) => s.kind === 'mtt' && s.endedAt)).map((g) => g.currency), [sessions]);
  const [cur, setCur] = useState<string | undefined>(undefined);
  const { currency, list } = useMemo(() => finishedTourneys(sessions, cur), [sessions, cur]);
  const sum = useMemo(() => summarize(list, view), [list, view]);
  const bands = useMemo(
    () =>
      groupBy(
        list,
        view,
        (s) => bandOf(s.buyIn),
        BANDS.map((b) => b.key),
      ),
    [list, view],
  );
  const festivals = useMemo(() => groupBy(list, view, (s) => tripOf(s, trips)?.name || t('Fora de festivais')), [list, view, trips]);
  const games = useMemo(() => groupBy(list, view, (s) => gameOf(s.name), ['NLH', 'PLO', 'Mix']), [list, view]);
  const scores = useMemo(() => biggestScores(list, 3), [list]);
  const hidden = !!settings.hideAmounts;
  const amt = (n: number) => (hidden ? '•••' : signedMoney(n, currency));

  if (!list.length) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: S.gutter, justifyContent: 'center' }}>
        <Stack.Screen options={{ title: t('Torneios') }} />
        <Empty icon="trophy-outline" title={t('Ainda sem torneios terminados')} body={t('Cada torneio que terminares entra aqui: ROI, ITM, buy-ins, festivais e os teus maiores resultados.')} />
      </View>
    );
  }

  const enough = sum.count >= MIN_SAMPLE;
  const verdict = !enough ? null : sum.roi === null ? t('Sem buy-ins nesta vista.') : sum.roi >= 0 ? t('Por cada 100 em buy-ins, voltaram {x}.', { x: Math.round(100 + sum.roi) }) : t('Por cada 100 em buy-ins, voltaram {x}. Em torneios, a variância é longa.', { x: Math.round(100 + sum.roi) });

  return (
    <>
      <Stack.Screen options={{ title: t('Torneios') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }}>
        <Segmented
          options={[
            { key: 'mine', label: t('O teu resultado') },
            { key: 'action', label: t('Ação total') },
          ]}
          value={view}
          onChange={setView}
        />
        {currencies.length > 1 ? (
          <ChipRow style={{ marginTop: -S.md }}>
            {currencies.map((c) => (
              <Chip key={c} label={c} active={c === currency} onPress={() => setCur(c)} />
            ))}
          </ChipRow>
        ) : null}

        <Card tone="raised" style={{ gap: S.sm }}>
          <T v="label">{enough ? 'ROI' : t('Resultado')}</T>
          <T v="monoXL" color={(enough ? (sum.roi ?? 0) : sum.net) >= 0 ? C.good : C.bad}>
            {enough && sum.roi !== null ? signedPct(sum.roi) : amt(sum.net)}
          </T>
          {verdict ? <T v="body">{verdict}</T> : <SmallSample n={sum.count} min={MIN_SAMPLE} variant="note" unit={t('torneios')} />}
          <T v="small">
            {t('{n} torneios · {e} entradas · {cur}', { n: sum.count, e: sum.entries, cur: currency })}
            {view === 'mine' ? ' · ' + t('depois de staking, swaps e despesas') : ' · ' + t('antes de staking e swaps')}
          </T>
        </Card>

        <StatGrid cols={3}>
          <Stat label={t('Resultado')} value={hidden ? '•••' : compact(sum.net, currency)} tone={hidden ? undefined : sum.net >= 0 ? 'good' : 'bad'} />
          <Stat label="ITM" value={pct(sum.itm)} sub={t('{n} cashes', { n: sum.cashes })} />
          <Stat label={t('Buy-ins')} value={hidden ? '•••' : compact(sum.invested, currency, false)} />
          <Stat label={t('Lugar')} value={sum.avgFinish ? Math.round(sum.avgFinish).toLocaleString(locale) : '—'} sub={sum.avgFieldPct !== null ? t('top {p}', { p: pct(sum.avgFieldPct) }) : sum.finishes ? t('médio em {n}', { n: sum.finishes }) : t('sem lugares')} />
          <Stat label="Re-entry" value={pct(sum.reentryRate)} sub={sum.reentriesPer !== null ? t('{x} por torneio', { x: sum.reentriesPer.toLocaleString(locale, { maximumFractionDigits: 1 }) }) : undefined} />
          <Stat label="Bounties" value={hidden ? '•••' : compact(sum.bounties, currency, false)} />
        </StatGrid>

        <Section title={t('Maiores resultados')}>
          {scores.length ? (
            <ListGroup>
              {scores.map((s) => (
                <ListItem key={s.id} icon="trophy-outline" iconColor={C.accent} title={s.name || t('Torneio')} subtitle={[s.finish ? (s.field ? t('{p}º de {n}', { p: s.finish, n: s.field.toLocaleString(locale) }) : `${s.finish}º`) : null, shortDate(s.at), `${s.multiple >= 10 ? Math.round(s.multiple) : decimal(s.multiple)}× ${t('o buy-in')}`].filter(Boolean).join(' · ')} value={hidden ? '•••' : money(s.prize, currency)} valueColor={C.good} onPress={() => router.push({ pathname: '/summary/[id]', params: { id: s.id } })} />
              ))}
            </ListGroup>
          ) : (
            <T v="small">{t('O primeiro cash está para vir.')}</T>
          )}
        </Section>

        {pro.isPro ? (
          <>
            <Breakdown title={t('Por buy-in')} rows={bands} currency={currency} hidden={hidden} />
            <Breakdown title={t('Por festival')} rows={festivals} currency={currency} hidden={hidden} />
            <Breakdown title={t('Por jogo')} rows={games} currency={currency} hidden={hidden} />
          </>
        ) : (
          <Card tone="accent" onPress={() => pro.paywall('stats')} style={{ gap: S.sm }}>
            <Row>
              <Ionicons name="lock-closed" size={16} color={C.accent} />
              <T v="h3" style={{ flex: 1 }}>
                {t('ROI e ITM por buy-in, festival e jogo')}
              </T>
              <Ionicons name="chevron-forward" size={16} color={C.muted} />
            </Row>
            <T v="small">{t('Vê onde ganhas e onde perdes, com Pro.')}</T>
          </Card>
        )}

        <Button title={t('Partilhar o meu currículo')} icon="share-outline" kind="secondary" onPress={() => router.push({ pathname: '/tournament-card', params: { cur: currency, view } })} />
      </ScrollView>
    </>
  );
}

function Breakdown({ title, rows, currency, hidden }: { title: string; rows: Group[]; currency: string; hidden: boolean }) {
  if (rows.length < 2) return null;
  return (
    <Section title={title} hint={t('O ROI aparece a partir de {n} torneios.', { n: MIN_GROUP })}>
      <Card padded={false}>
        <Row style={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.sm }}>
          <T v="label" style={{ flex: 1.4 }} />
          <T v="label" style={{ flex: 0.6, textAlign: 'right' }}>
            ROI
          </T>
          <T v="label" style={{ flex: 0.6, textAlign: 'right' }}>
            ITM
          </T>
          <T v="label" style={{ flex: 1, textAlign: 'right' }}>
            {t('Resultado')}
          </T>
        </Row>
        {rows.map((g) => {
          const ok = g.count >= MIN_GROUP && g.roi !== null;
          return (
            <View key={g.key}>
              <Divider inset={S.lg} />
              <Row style={{ paddingHorizontal: S.lg, paddingVertical: 11 }}>
                <View style={{ flex: 1.4 }}>
                  <T v="h3" numberOfLines={1}>
                    {g.key}
                  </T>
                  <T v="tiny">{g.count === 1 ? t('1 torneio') : t('{n} torneios', { n: g.count })}</T>
                </View>
                <T v="mono" color={!ok ? C.muted : g.roi! >= 0 ? C.good : C.bad} style={{ flex: 0.6, textAlign: 'right' }}>
                  {ok ? signedPct(g.roi!) : '—'}
                </T>
                <T v="mono" color={ok ? C.text : C.muted} style={{ flex: 0.6, textAlign: 'right' }}>
                  {ok ? pct(g.itm) : '—'}
                </T>
                <T v="mono" color={hidden ? C.muted : g.net >= 0 ? C.good : C.bad} style={{ flex: 1, textAlign: 'right' }} numberOfLines={1} adjustsFontSizeToFit>
                  {hidden ? '•••' : signedMoney(g.net, currency)}
                </T>
              </Row>
            </View>
          );
        })}
      </Card>
    </Section>
  );
}
