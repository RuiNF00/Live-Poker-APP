// Início: how everything is going, on one screen. The month, the poker result with its verdict,
// the last hands and sessions, the table notes and the one card that needs attention. Each part
// opens its tab or screen; the tabs below are for doing the rest.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboarding, usePro, useWelcomeOffer } from '@/billing/pro';
import { Avatar } from '@/components/Avatar';
import { useBackupSuggestion, useBackupWarning } from '@/components/backup-hooks';
import { ChargeNotice, useChargeNotice } from '@/components/ChargeNotice';
import { HandRow } from '@/components/HandRow';
import { PlayingCard } from '@/components/PlayingCard';
import { ProMoment, useProMoment } from '@/components/ProMoment';
import { SharedHandsCard } from '@/components/SharedHandsCard';
import { StartChecklist, useStartChecklist } from '@/components/StartChecklist';
import { StreakStat } from '@/components/StreakStat';
import { SwapSettleCard, useSwapSettleCard } from '@/components/swaps/SwapSettleReminder';
import { useWhatsNewCard, WhatsNewCard } from '@/components/WhatsNewCard';
import { Amount, Banner, Button, Card, IconButton, ListGroup, ListItem, Row, ScreenHeader, Section, T, Wordmark } from '@/components/ui';
import { locale, t } from '@/i18n';
import { useSharedHands } from '@/lib/friend-hands';
import { duration, money, plus, shortDate } from '@/poker/format';
import type { Hand } from '@/poker/types';
import { lastResults, verdict } from '@/store/results-math';
import { mainCurrency, playedMs, profit, rateShown, totals } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, R, S, SHADOW, ff } from '@/theme';

// Only when there is something to say about the cloud copy: the copy code stays off the first frame.
const BackupHealthBanner = React.lazy(() => import('@/components/CloudBackup').then((m) => ({ default: m.BackupHealthBanner })));
const BackupSuggestion = React.lazy(() => import('@/components/CloudBackup').then((m) => ({ default: m.BackupSuggestion })));

const DAY = 86400000;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const narrow = useWindowDimensions().width < 380;
  const { hands, sessions, players, activeSession, settings, draft, setDraft } = useStore();
  // Cloud copy failed or a week old: one quiet card with «Fazer cópia agora».
  const backup = useBackupWarning();
  // After an update: one card with the first thing that's new.
  const news = useWhatsNewCard();
  const { handsLeft, trialDays, paywall } = usePro();
  useWelcomeOffer(hands.length);
  useOnboarding();
  const shared = useSharedHands();
  const settle = useSwapSettleCard();
  const checklist = useStartChecklist();
  const moment = useProMoment();
  const chargeEnd = useChargeNotice();
  const [now] = useState(() => Date.now());
  const lastEnd = useMemo(() => Math.max(0, ...sessions.map((x) => x.endedAt ?? 0)), [sessions]);
  // Once there's something to lose: the first saved hand or closed session.
  const suggest = useBackupSuggestion(hands.length > 0 || lastEnd > 0);
  const idleDays = lastEnd ? Math.floor((now - lastEnd) / DAY) : 0;
  // Discarding a draft is one tap, so keep it for a few seconds behind an undo.
  const [discarded, setDiscarded] = useState<Hand | null>(null);
  useEffect(() => {
    if (!discarded) return;
    const id = setTimeout(() => setDiscarded(null), 6000);
    return () => clearTimeout(id);
  }, [discarded]);
  const hasDraft = !!draft && (draft.actions.length > 0 || !!draft.players[draft.hero].cards?.length);

  const recentHands = useMemo(() => [...hands].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3), [hands]);
  const done = useMemo(() => sessions.filter((x) => x.endedAt).sort((a, b) => b.endedAt! - a.endedAt!), [sessions]);
  const notes = useMemo(() => [...players].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3), [players]);
  const fresh = hands.length === 0 && sessions.length === 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.gutter, paddingBottom: 40, gap: S.lg }}>
      <View style={{ gap: S.md }}>
        <ScreenHeader
          title={<Wordmark size={narrow ? 25 : 30} />}
          right={
            // New comments also show here, so they aren't lost when another card wins the one-card slot below.
            <IconButton
              name="settings-outline"
              label={shared.newTotal ? `${t('Definições')}, ${shared.newTotal === 1 ? t('1 comentário novo') : t('{n} comentários novos', { n: shared.newTotal })}` : t('Definições')}
              badge={shared.newTotal > 0}
              onPress={() => router.push('/settings')}
            />
          }
        />
        <HomeSummary
          sessions={sessions}
          streak={hands.length > 0}
          handsLeft={hands.length > 0 ? handsLeft : null}
          // The trial is never offered at the table: there the free-hands cell only opens the paywall.
          cta={handsLeft === 0 && trialDays && !activeSession ? t('{days} dias grátis', { days: trialDays }) : t('Ver com Pro')}
          onPro={() => paywall(handsLeft === 0 ? (activeSession ? 'handsLive' : 'hands') : 'generic')}
        />
        {/* At most one context card. At the table only what's about the play (a hand to finish, a charge
            coming): news, the start checklist and Pro moments wait until the session ends. */}
        {hasDraft ? (
          <Banner
            tone="warn"
            icon="create-outline"
            title={t('Mão a meio')}
            body={t('Toca para continuar onde ficaste')}
            onPress={() => router.push('/hand/new')}
            onDismiss={() => {
              setDiscarded(draft);
              setDraft(null);
            }}
            dismissLabel={t('Descartar')}
          />
        ) : discarded ? (
          <Banner
            tone="info"
            icon="trash-outline"
            title={t('Mão descartada')}
            action={t('Anular')}
            onPress={() => {
              setDraft(discarded);
              setDiscarded(null);
            }}
          />
        ) : chargeEnd ? (
          <ChargeNotice end={chargeEnd} />
        ) : backup.health ? (
          <React.Suspense fallback={null}>
            <BackupHealthBanner health={backup.health} onSnooze={backup.snooze} />
          </React.Suspense>
        ) : !activeSession && settle ? (
          <SwapSettleCard {...settle} />
        ) : !activeSession && shared.newTotal > 0 ? (
          <SharedHandsCard n={shared.newTotal} fresh={shared.fresh} mine={shared.mine} />
        ) : !activeSession && news.item ? (
          <WhatsNewCard item={news.item} onDismiss={news.dismiss} />
        ) : !activeSession && suggest.show ? (
          <React.Suspense fallback={null}>
            <BackupSuggestion onDone={suggest.dismiss} />
          </React.Suspense>
        ) : !activeSession && checklist ? (
          <StartChecklist state={checklist} />
        ) : !activeSession && moment ? (
          <ProMoment state={moment} />
        ) : !activeSession && idleDays >= 7 ? (
          <Banner icon="timer-outline" title={t('Sem sessões há {n} dias', { n: idleDays })} action={t('Começar')} onPress={() => router.navigate('/session')} />
        ) : null}
      </View>

      {fresh ? <FirstRun /> : null}

      {done.length ? <ResultCard sessions={sessions} /> : null}

      {hands.length ? (
        <Section title={t('Últimas mãos')} action={t('Ver todas')} onAction={() => router.navigate('/hands')}>
          <View style={{ gap: S.sm }}>
            {recentHands.map((h) => (
              <HandRow key={h.id} hand={h} inBB={settings.inBB} />
            ))}
          </View>
        </Section>
      ) : null}

      {done.length ? (
        <Section title={t('Últimas sessões')} action={t('Ver todas')} onAction={() => router.navigate('/bankroll')}>
          <ListGroup>
            {done.slice(0, 3).map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {fresh ? null : <NotesSection notes={notes} total={players.length} />}

      <Section title={t('Atalhos')}>
        <Row gap={S.sm}>
          <Shortcut icon="calendar-outline" label={t('Festivais')} onPress={() => router.push('/festivals')} />
          <Shortcut icon="calculator-outline" label={t('Calculadora de equity')} onPress={() => router.push('/odds')} />
          <Shortcut icon="swap-horizontal-outline" label={t('Swaps')} onPress={() => router.push('/swaps')} />
        </Row>
      </Section>
    </ScrollView>
  );
}

/**
 * The poker result over everything, in the currency most sessions use, with the verdict and
 * the last five sessions as dots. Sessions in other currencies are left out and the card says so.
 */
function ResultCard({ sessions }: { sessions: Session[] }) {
  const tot = useMemo(() => totals(sessions), [sessions]);
  const cur = tot.currency;
  const v = useMemo(() => verdict(sessions, cur, (n) => money(n, cur)), [sessions, cur]);
  const last5 = useMemo(() => lastResults(sessions.filter((x) => x.currency === cur), 5), [sessions, cur]);
  if (!tot.sessions) return null;
  return (
    <Card onPress={() => router.navigate('/bankroll')} style={{ gap: S.sm }} accessibilityLabel={`${t('Resultado de póquer')}: ${plus(tot.profit) + money(tot.profit, cur)}. ${v.text}`}>
      <Row>
        <T v="label" style={{ flex: 1 }} numberOfLines={1}>
          {t('Resultado de póquer')}
        </T>
        <Dots results={last5} />
      </Row>
      <Amount value={tot.profit} text={money(tot.profit, cur)} v="monoL" fit />
      <T v={v.ready ? 'body' : 'small'} color={v.tone === 'good' ? C.good : v.tone === 'bad' ? C.bad : v.ready ? C.text : C.muted}>
        {v.text}
      </T>
      <T v="small">
        {[
          tot.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: tot.sessions }),
          t('{h} h a jogar', { h: tot.hours.toLocaleString(locale, { maximumFractionDigits: 1 }) }),
          rateShown(tot.hours) ? t('{amount}/h', { amount: money(Math.round(tot.hourly), cur) }) : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      </T>
      {tot.otherCurrencies.length ? <T v="tiny">{t('Sem as sessões em {list}: vê-as no Bankroll.', { list: tot.otherCurrencies.join(', ') })}</T> : null}
    </Card>
  );
}

/** Last sessions as green / red dots, oldest on the left (same as the Bankroll tab). */
function Dots({ results }: { results: number[] }) {
  if (results.length < 2) return null;
  return (
    <Row gap={4} style={{ alignItems: 'center' }} accessible accessibilityLabel={t('Últimas {n} sessões: {won} a ganhar, {lost} a perder.', { n: results.length, won: results.filter((r) => r > 0).length, lost: results.filter((r) => r < 0).length })}>
      <T v="tiny">{t('Últimas {n}', { n: results.length })}</T>
      {results.map((r, i) => (
        // A loss is a ring, not only a red dot: reads without telling red from green.
        <View key={i} style={{ width: 8, height: 8, borderRadius: 4, ...(r < 0 ? { borderWidth: 1.5, borderColor: C.bad } : { backgroundColor: r > 0 ? C.good : C.muted }) }} />
      ))}
    </Row>
  );
}

function SessionRow({ s }: { s: Session }) {
  const p = profit(s);
  const mtt = s.kind === 'mtt';
  return (
    <ListItem
      icon={mtt ? 'trophy-outline' : 'cash-outline'}
      iconColor={mtt ? C.warn : C.info}
      title={s.name || s.venue || (mtt ? t('Torneio') : 'Cash')}
      subtitle={[shortDate(s.startedAt), duration(playedMs(s)), s.name ? s.venue : ''].filter(Boolean).join(' · ')}
      right={
        <T v="mono" color={p > 0 ? C.good : p < 0 ? C.bad : C.textDim}>
          {plus(p) + money(p, s.currency)}
        </T>
      }
      chevron={false}
      onPress={() => router.navigate('/bankroll')}
    />
  );
}

/** The last notes about players at the table, with one tap to write a new one. */
function NotesSection({ notes, total }: { notes: ReturnType<typeof useStore>['players']; total: number }) {
  return (
    <Section title={t('Notas')} action={total > notes.length ? t('Ver todas') : undefined} onAction={() => router.push('/notes')}>
      {notes.length ? (
        <ListGroup>
          {notes.map((p) => (
            <ListItem
              key={p.id}
              left={<Avatar name={p.name || '?'} size={32} />}
              title={p.name || t('Sem nome')}
              subtitle={p.notes || p.look || (p.tags.length ? p.tags.map((x) => t(x)).join(' · ') : undefined)}
              numberOfLines={1}
              onPress={() => router.push({ pathname: '/notes', params: { id: p.id } })}
            />
          ))}
          <ListItem icon="add" iconColor={C.accent} title={t('Nova nota')} onPress={() => router.push({ pathname: '/notes', params: { id: 'new' } })} />
        </ListGroup>
      ) : (
        <Card style={{ gap: S.sm }}>
          <T v="small">{t('Quem é quem, como joga e as mãos que tiveste contra ele. Na próxima vez que o vires, já sabes.')}</T>
          <Button title={t('Nova nota')} icon="create-outline" kind="secondary" size="md" onPress={() => router.push({ pathname: '/notes', params: { id: 'new' } })} />
        </Card>
      )}
    </Section>
  );
}

function Shortcut({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [shortSt.tile, pressed && { backgroundColor: C.surface2 }]}>
      <Ionicons name={icon} size={22} color={C.accent} />
      <T v="small" numberOfLines={2} style={{ textAlign: 'center', color: C.text, fontFamily: ff(600) }}>
        {label}
      </T>
    </Pressable>
  );
}

const shortSt = StyleSheet.create({
  tile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 84, paddingVertical: 12, paddingHorizontal: 8, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border },
});

/** A brand-new install: what the app does, and the two ways to start. */
function FirstRun() {
  return (
    <Card style={{ gap: S.lg, paddingVertical: S.xl }}>
      <View style={{ alignItems: 'center', gap: S.md }}>
        <Row gap={0} style={{ marginBottom: 6 }}>
          <View style={{ transform: [{ rotate: '-8deg' }], ...SHADOW }}>
            <PlayingCard card="Ah" size="lg" />
          </View>
          <View style={{ marginLeft: -12, transform: [{ rotate: '7deg' }, { translateY: 4 }], ...SHADOW }}>
            <PlayingCard card="Ks" size="lg" />
          </View>
        </Row>
        <T v="h1" style={{ textAlign: 'center' }}>
          {t('O teu caderno de póquer live')}
        </T>
        <T v="callout" style={{ textAlign: 'center', maxWidth: 300 }}>
          {t('Aqui vês tudo de uma vez: o resultado, as últimas mãos e sessões e as notas da mesa.')}
        </T>
      </View>
      <View style={{ gap: S.sm }}>
        <Button title={t('Registar a primeira mão')} icon="add" onPress={() => router.push('/hand/new')} />
        <Button title={t('Começar uma sessão')} icon="timer-outline" kind="secondary" size="md" onPress={() => router.navigate('/session')} />
        <Button title={t('Ver uma mão de exemplo')} kind="ghost" size="md" onPress={() => router.push({ pathname: '/hand/[id]', params: { id: 'sample' } })} />
      </View>
    </Card>
  );
}

/**
 * The home verdict as one row of numbers: this month, the weekly streak and
 * the free hands left today. Each cell opens where the number comes from.
 */
function HomeSummary({ sessions, streak, handsLeft, cta, onPro }: { sessions: Session[]; streak: boolean; handsLeft: number | null; cta: string; onPro: () => void }) {
  const [now] = useState(() => Date.now());
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const done = sessions.filter((x) => x.endedAt);
  const cur = mainCurrency(done, '€');
  const month = done.filter((x) => (x.endedAt ?? 0) >= start.getTime() && x.currency === cur);
  const net = month.reduce((a, x) => a + profit(x), 0);
  const cells: React.ReactNode[] = [];
  if (done.length) {
    cells.push(
      <Pressable
        key="month"
        accessibilityRole="button"
        accessibilityLabel={month.length ? `${t('Este mês')}: ${money(net, cur)}, ${month.length === 1 ? t('em 1 sessão') : t('em {n} sessões', { n: month.length })}` : t('Ainda sem sessões este mês')}
        onPress={() => router.navigate('/bankroll')}
        hitSlop={6}
        style={({ pressed }) => [sumSt.cell, { opacity: pressed ? 0.7 : 1 }]}>
        {/* Three cells in a row: at large text the caption stops at 130% and shrinks, or it read "ESTE M…". */}
        <T v="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.3}>
          {t('Este mês')}
        </T>
        {month.length ? <Amount value={net} text={money(net, cur)} v="mono" fit /> : <T v="mono" color={C.muted}>—</T>}
      </Pressable>,
    );
  }
  if (streak)
    cells.push(
      <View key="streak" style={sumSt.cell}>
        <StreakStat />
      </View>,
    );
  if (handsLeft !== null) {
    const total = 3;
    cells.push(
      <Pressable
        key="free"
        accessibilityRole="button"
        accessibilityLabel={`${handsLeft === 0 ? t('Mãos grátis de hoje esgotadas') : handsLeft === 1 ? t('Falta 1 mão grátis hoje') : t('Faltam {n} mãos grátis hoje', { n: handsLeft })}. ${cta}`}
        onPress={onPro}
        hitSlop={6}
        style={({ pressed }) => [sumSt.cell, { opacity: pressed ? 0.7 : 1 }]}>
        <T v="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.3} color={handsLeft === 0 ? C.accent : undefined}>
          {/* Out of free hands, the caption says so: next to "3 dias grátis" it read like an offer. */}
          {handsLeft === 0 ? t('Esgotadas hoje') : t('Grátis hoje')}
        </T>
        {handsLeft === 0 ? (
          <T v="small" numberOfLines={1} color={C.accent} style={{ fontFamily: ff(800), lineHeight: 20 }}>
            {cta}
          </T>
        ) : (
          <Row gap={6}>
            <Row gap={3}>
              {Array.from({ length: total }, (_, i) => (
                <View key={i} style={[sumSt.dot, { backgroundColor: i < total - handsLeft ? C.accent : C.surface3 }]} />
              ))}
            </Row>
            <T v="mono">{handsLeft}</T>
          </Row>
        )}
      </Pressable>,
    );
  }
  if (!cells.length) return null;
  return (
    <View style={[sumSt.wrap, handsLeft === 0 && { borderColor: C.accentLine }]}>
      {cells.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={sumSt.divider} /> : null}
          {c}
        </React.Fragment>
      ))}
    </View>
  );
}

const sumSt = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  cell: { flex: 1, gap: 2 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: C.border },
  dot: { width: 10, height: 5, borderRadius: 3 },
});
