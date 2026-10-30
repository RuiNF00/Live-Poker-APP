// One trip: what's left after expenses, poker against costs, the expenses by
// kind, and the sessions that count towards it.

import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Sheet } from '@/components/BankrollSheets';
import { ExpenseForm, KIND, TripForm, tripDates } from '@/components/TripSheets';
import { headerRightWithBadge } from '@/components/NetStatus';
import { Button, Card, Chip, ChipRow, Divider, Empty, IconButton, ListGroup, ListItem, Row, Screen, Section, T } from '@/components/ui';
import { decimalComma, locale, t } from '@/i18n';
import { spanLabel } from '@/components/FestivalItem';
import { festivalSpan } from '@/poker/festivals';
import { minus, money, plus } from '@/poker/format';
import { planTotals, useFestivalPlan } from '@/store/festival-plan';
import { useFestivals } from '@/store/my-festivals';
import { playedMs, profit } from '@/store/session-math';
import { useStore, uid } from '@/store/store';
import { blankExpense, EXPENSE_KINDS, fxInUse, skippedLabel, skippedStuck, toTripCurrency, tripSessions, tripSummary } from '@/store/trip-math';
import type { Expense, ExpenseKind, Trip } from '@/store/types';
import { C, R, S } from '@/theme';

type SheetState = { type: 'trip' } | { type: 'expense'; x: Expense; isNew: boolean } | null;

const day = (ts: number) => new Date(ts).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

function confirm(title: string, body: string, yes: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${body}`)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: t('Cancelar'), style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, sessions, settings, saveTrip, deleteTrip } = useStore();
  const [sheet, setSheet] = useState<SheetState>(null);
  const trip = trips.find((x) => x.id === id);
  if (!trip) {
    return (
      <>
        <Stack.Screen options={{ title: t('Viagem') }} />
        <Screen contentStyle={{ paddingTop: S.lg }}>
          <Empty icon="airplane-outline" title={t('Esta viagem já não existe')} />
        </Screen>
      </>
    );
  }
  const hidden = !!settings.hideAmounts;
  const cur = trip.currency;
  const fmt = (n: number, c = cur) => (hidden ? '•••' : money(n, c));
  const signed = (n: number, c = cur) => (hidden ? '•••' : plus(n) + money(n, c));
  const s = tripSummary(trip, sessions);
  const list = tripSessions(trip, sessions).reverse();
  const expenses = [...trip.expenses].sort((a, b) => b.at - a.at);
  const other = trip.fx && trip.fx.currency !== cur ? trip.fx : null;
  // Left out and no way to bring it in from «Editar viagem»: say so instead of sending the player there.
  const stuck = skippedStuck(trip, s.skipped, sessions);
  // Running now and started during the trip: not counted until it ends, which the list would otherwise leave unsaid.
  const live = sessions.find((x) => !x.endedAt && x.startedAt >= trip.from && x.startedAt <= trip.to);

  const saveExpense = (x: Expense) => {
    saveTrip({ ...trip, expenses: [x, ...trip.expenses.filter((e) => e.id !== x.id)] });
    setSheet(null);
  };
  // A new expense is paid like the last one of its kind on this trip (the hotel in dollars stays in dollars).
  const lastPaid = (kind: ExpenseKind) => expenses.find((e) => e.kind === kind && (e.currency === cur || e.currency === other?.currency))?.currency;
  const newExpense = (kind: ExpenseKind) => setSheet({ type: 'expense', x: blankExpense(uid('e_'), kind, lastPaid(kind) ?? (kind === 'flight' && other ? other.currency : cur)), isNew: true });

  return (
    <>
      <Stack.Screen
        options={{
          title: trip.name,
          headerBackTitle: t('Voltar'),
          headerRight: headerRightWithBadge(() => <IconButton name="ellipsis-horizontal" label={t('Editar viagem')} onPress={() => setSheet({ type: 'trip' })} />),
        }}
      />
      <Screen contentStyle={{ paddingTop: S.lg, gap: S.lg }}>
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <T v="label">{[tripDates(trip), trip.venue].filter(Boolean).join(' · ')}</T>
        </View>

        <Card tone="raised" style={{ gap: S.md }}>
          <View style={{ gap: 2 }}>
            <T v="label">{t('Resultado depois das despesas')}</T>
            <T v="monoXL" color={s.net >= 0 ? C.good : C.bad} numberOfLines={1} adjustsFontSizeToFit>
              {signed(s.net)}
            </T>
            {s.converted ? <T v="mono" color={C.textDim}>{`≈ ${signed(s.converted.net, s.converted.currency)}`}</T> : null}
            <T v="small">
              {[s.played === 1 ? t('1 sessão') : t('{n} sessões', { n: s.played }), `${Math.round(s.hours)} h`, s.days === 1 ? t('1 dia de viagem') : t('{n} dias de viagem', { n: s.days })].join(' · ')}
            </T>
          </View>
          <Divider />
          <PokerVsCosts poker={s.poker} expenses={s.expenses} byKind={s.byKind} fmt={fmt} signed={signed} />
          {other && !(other.rate > 0) ? (
            <T v="tiny" color={C.warn} onPress={() => setSheet({ type: 'trip' })} accessibilityRole="button">
              {t('Define o câmbio {a} → {b} para converter o resultado e as despesas em {b}.', { a: cur, b: other.currency })}
            </T>
          ) : null}
          {s.skipped.length ? (
            <T v="tiny" onPress={stuck ? undefined : () => setSheet({ type: 'trip' })} accessibilityRole={stuck ? undefined : 'button'}>
              {[t('Fora das contas (sem câmbio): {list}.', { list: skippedLabel(s.skipped) }), stuck ? t('Uma viagem converte só a sua moeda e mais uma.') : ''].filter(Boolean).join(' ')}
            </T>
          ) : null}
        </Card>

        {s.played ? <ShareRecap trip={trip} /> : null}

        {trip.festivalId ? <FestivalPlanCard trip={trip} fmt={fmt} /> : null}

        <Section title={t('Despesas')} action={t('+ Despesa')} onAction={() => newExpense('other')}>
          <ChipRow>
            {EXPENSE_KINDS.map((k) => (
              <Chip key={k} label={KIND[k].label} icon={KIND[k].icon} onPress={() => newExpense(k)} />
            ))}
          </ChipRow>
          {expenses.length ? (
            <ListGroup>
              {expenses.map((x) => {
                const inTrip = toTripCurrency(x.amount, x.currency, trip);
                return (
                  <ListItem
                    key={x.id}
                    icon={KIND[x.kind]?.icon ?? 'ellipsis-horizontal'}
                    iconColor={KIND[x.kind]?.color}
                    title={x.note || KIND[x.kind]?.label || x.kind}
                    subtitle={[x.note ? KIND[x.kind]?.label : '', day(x.at), x.currency === cur ? '' : inTrip !== null ? `≈ ${fmt(inTrip)}` : t('fora das contas')].filter(Boolean).join(' · ')}
                    value={hidden ? '•••' : minus() + money(x.amount, x.currency)}
                    onPress={() => setSheet({ type: 'expense', x, isNew: false })}
                  />
                );
              })}
            </ListGroup>
          ) : (
            <T v="tiny" style={{ paddingHorizontal: 4 }}>
              {t('Toca num tipo para juntar a primeira despesa.')}
            </T>
          )}
        </Section>

        <Section
          title={t('Sessões')}
          hint={live ? t('A sessão em curso entra quando a terminares.') : list.length ? undefined : t('As sessões que jogares entre {from} e {to} entram aqui sozinhas.', { from: day(trip.from), to: day(trip.to) })}
        >
          {list.length ? (
            <ListGroup>
              {list.map((x) => {
                const p = toTripCurrency(profit(x), x.currency, trip);
                return (
                  <ListItem
                    key={x.id}
                    icon={x.kind === 'mtt' ? 'trophy-outline' : 'cash-outline'}
                    title={x.name || x.venue || t('Sessão')}
                    subtitle={[day(x.startedAt), `${(playedMs(x) / 3600000).toFixed(1).replace('.', decimalComma ? ',' : '.')} h`, p === null ? t('fora das contas') : ''].filter(Boolean).join(' · ')}
                    value={p === null ? signed(profit(x), x.currency) : signed(p)}
                    valueColor={profit(x) >= 0 ? C.good : C.bad}
                  />
                );
              })}
            </ListGroup>
          ) : null}
        </Section>
      </Screen>

      <Sheet visible={sheet?.type === 'trip'} title={t('Editar viagem')} onClose={() => setSheet(null)}>
        {sheet?.type === 'trip' ? (
          <TripForm
            initial={trip}
            home={settings.currency}
            isNew={false}
            fxLocked={fxInUse(trip, sessions)}
            onSave={(x) => {
              saveTrip(x);
              setSheet(null);
            }}
            onDelete={() =>
              confirm(t('Apagar viagem?'), t('As despesas desta viagem são apagadas. As sessões ficam no Bankroll.'), t('Apagar'), () => {
                setSheet(null);
                deleteTrip(trip.id);
                router.back();
              })
            }
          />
        ) : null}
      </Sheet>
      <Sheet visible={sheet?.type === 'expense'} title={sheet?.type === 'expense' && !sheet.isNew ? t('Despesa') : t('Nova despesa')} onClose={() => setSheet(null)}>
        {sheet?.type === 'expense' ? (
          <ExpenseForm
            initial={sheet.x}
            trip={trip}
            onSave={saveExpense}
            onDelete={
              sheet.isNew
                ? undefined
                : () => {
                    saveTrip({ ...trip, expenses: trip.expenses.filter((e) => e.id !== sheet.x.id) });
                    setSheet(null);
                  }
            }
          />
        ) : null}
      </Sheet>
    </>
  );
}

/** The festival recap story: offered up front once the trip is over, a quiet row while it's on. */
function ShareRecap({ trip }: { trip: Trip }) {
  const [over] = useState(() => Date.now() > trip.to);
  const open = () => router.push({ pathname: '/festival-card/[id]', params: { id: trip.id } });
  if (!over) {
    return (
      <ListGroup>
        <ListItem icon="logo-instagram" title={trip.festivalId ? t('Partilhar resumo do festival') : t('Partilhar resumo da viagem')} subtitle={t('Uma story com os dias, eventos e a melhor mão')} onPress={open} />
      </ListGroup>
    );
  }
  return (
    <Card tone="accent" style={{ gap: S.sm }}>
      <T v="h3">{trip.festivalId ? t('O festival acabou') : t('A viagem acabou')}</T>
      <T v="small">{t('Fica com uma story dos dias, dos eventos e da melhor mão. Sem valores, a não ser que os queiras mostrar.')}</T>
      <Button title={trip.festivalId ? t('Criar story do festival') : t('Criar story da viagem')} icon="logo-instagram" onPress={open} />
    </Card>
  );
}

/** Poker result and costs side by side, the costs as one bar split by kind. */
function PokerVsCosts({
  poker,
  expenses,
  byKind,
  fmt,
  signed,
}: {
  poker: number;
  expenses: number;
  byKind: Record<ExpenseKind, number>;
  fmt: (n: number) => string;
  signed: (n: number) => string;
}) {
  const kinds = EXPENSE_KINDS.filter((k) => byKind[k] > 0);
  return (
    <View style={{ gap: S.sm }}>
      <Row accessible accessibilityLabel={`${t('Póquer')}: ${signed(poker)}`}>
        <T v="small" style={{ flex: 1 }}>
          {t('Póquer')}
        </T>
        <T v="mono" color={poker >= 0 ? C.good : C.bad}>
          {signed(poker)}
        </T>
      </Row>
      <Row accessible accessibilityLabel={`${t('Despesas')}: ${expenses ? minus() + fmt(expenses) : fmt(0)}`}>
        <T v="small" style={{ flex: 1 }}>
          {t('Despesas')}
        </T>
        <T v="mono" color={expenses ? C.text : C.muted}>
          {expenses ? minus() + fmt(expenses) : fmt(0)}
        </T>
      </Row>
      {kinds.length ? (
        <>
          {/* The legend below reads each kind; the bar is only its picture. */}
          <View style={{ flexDirection: 'row', height: 8, borderRadius: R.pill, overflow: 'hidden', backgroundColor: C.surface3, gap: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {kinds.map((k) => (
              <View key={k} style={{ flex: byKind[k], backgroundColor: KIND[k].color }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: S.md, rowGap: 4 }}>
            {kinds.map((k) => (
              <Row key={k} gap={6}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: KIND[k].color }} />
                <T v="tiny" color={C.textDim}>{`${KIND[k].label} ${fmt(byKind[k])}`}</T>
              </Row>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Buy-ins of the festival plan the trip came from, so the player sees what's still ahead. */
function FestivalPlanCard({ trip, fmt }: { trip: Trip; fmt: (n: number) => string }) {
  // The player's own festivals too, not only the shipped ones.
  const f = useFestivals().find((x) => x.id === trip.festivalId);
  const plan = useFestivalPlan(trip.festivalId ?? '');
  if (!f) return null;
  const tot = planTotals(f, plan);
  const span = festivalSpan(f);
  return (
    <Card tone="inset" style={{ gap: S.xs }}>
      <Row>
        <T v="h3" style={{ flex: 1 }}>
          {t('Plano do festival')}
        </T>
        <T v="small" color={C.accent} onPress={() => router.push({ pathname: '/festival', params: { id: f.id } })} accessibilityRole="link">
          {t('Abrir')}
        </T>
      </Row>
      <T v="small">
        {!f.events.length
          ? span
            ? spanLabel(span.from, span.to)
            : t('Datas a confirmar')
          : tot.events
          ? t(tot.events === 1 ? '1 evento marcado · {amount} em buy-ins' : '{n} eventos marcados · {amount} em buy-ins', { n: tot.events, amount: f.currency === trip.currency ? fmt(tot.buyIns) : money(tot.buyIns, f.currency) })
          : t('Ainda não marcaste eventos. Marca-os no plano para veres os buy-ins aqui.')}
      </T>
    </Card>
  );
}
