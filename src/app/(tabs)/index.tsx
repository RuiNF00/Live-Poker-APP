// Resumo: how it's going, in the order a player asks. First the month as one big number with the
// week under it (Oura, Yahoo Finance; Runna's week strip), then what matters right now (a live
// session, a hand to finish, one card), then four tiles that each open their tab (WHOOP, Fitbit),
// the last hand and the table notes. The tabs below are for doing the rest.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboarding, usePro, useWelcomeOffer } from '@/billing/pro';
import { useBackupSuggestion, useBackupWarning } from '@/components/backup-hooks';
import { ChargeNotice, useChargeNotice } from '@/components/ChargeNotice';
import { HandRow } from '@/components/HandRow';
import { LineChart } from '@/components/LineChart';
import { PlayingCard } from '@/components/PlayingCard';
import { ProMoment, useProMoment } from '@/components/ProMoment';
import { SharedHandsCard } from '@/components/SharedHandsCard';
import { StartChecklist, useStartChecklist } from '@/components/StartChecklist';
import { StreakStat } from '@/components/StreakStat';
import { SwapSettleCard, useSwapSettleCard } from '@/components/swaps/SwapSettleReminder';
import { useNowAlways } from '@/components/useNow';
import { useWhatsNewCard, WhatsNewCard } from '@/components/WhatsNewCard';
import { Amount, Banner, Button, Card, IconButton, Row, ScreenHeader, Section, T, tap, Wordmark } from '@/components/ui';
import { locale, t } from '@/i18n';
import { useCoach } from '@/lib/coach-api';
import { useSharedHands } from '@/lib/friend-hands';
import { duration, money, plus } from '@/poker/format';
import { useReduceMotion } from '@/lib/motion';
import { needsReview } from '@/poker/review';
import type { Hand } from '@/poker/types';
import { monthKey, monthName, monthRecap, prevKey } from '@/store/month-recap';
import { verdict } from '@/store/results-math';
import { curve, isPaused, playedMs, profit, rateShown, totals } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { PlayerNote, Session } from '@/store/types';
import { C, R, S, SHADOW, ff } from '@/theme';

// Only when there is something to say about the cloud copy: the copy code stays off the first frame.
const BackupHealthBanner = React.lazy(() => import('@/components/CloudBackup').then((m) => ({ default: m.BackupHealthBanner })));
const BackupSuggestion = React.lazy(() => import('@/components/CloudBackup').then((m) => ({ default: m.BackupSuggestion })));

const DAY = 86400000;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const narrow = win.width < 380;
  // 200% text or a very small screen: one column, nothing side by side.
  const compact = win.fontScale >= 1.6 || win.width < 330;
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
  const coach = useCoach();
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

  const lastHand = useMemo(() => hands.reduce<Hand | null>((a, h) => (!a || h.createdAt > a.createdAt ? h : a), null), [hands]);
  const review = useMemo(() => {
    const sent = new Set(coach.links.flatMap((l) => l.handIds));
    return hands.filter((h) => needsReview(h, sent)).sort((a, b) => a.createdAt - b.createdAt);
  }, [hands, coach]);
  const toReview = review.length;
  const weekHands = useMemo(() => hands.filter((h) => h.createdAt >= weekStart(now)).length, [hands, now]);
  const lastNote = useMemo(() => players.reduce<PlayerNote | null>((a, p) => (!a || p.updatedAt > a.updatedAt ? p : a), null), [players]);
  const fresh = hands.length === 0 && sessions.length === 0;
  const played = sessions.some((x) => x.endedAt);
  // The trial is never offered at the table: there the free-hands line only opens the paywall.
  const cta = handsLeft === 0 && trialDays && !activeSession ? t('{days} dias grátis', { days: trialDays }) : t('Ver com Pro');
  const onPro = () => paywall(handsLeft === 0 ? (activeSession ? 'handsLive' : 'hands') : 'generic');

  // At most one card: the next thing to do (a live session shows above it). At the table only what's
  // about the play (a hand to finish, a charge coming): the rest waits until the session ends. Away from
  // the table: money to settle, comments, hands to review, then news and the first-week steps.
  // `Começar sessão · Já joguei` under it is always the last next step.
  const card = hasDraft ? (
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
  ) : activeSession ? null : settle ? (
    <SwapSettleCard {...settle} />
  ) : shared.newTotal > 0 ? (
    <SharedHandsCard n={shared.newTotal} fresh={shared.fresh} mine={shared.mine} />
  ) : toReview ? (
    <Banner
      icon="school-outline"
      title={toReview === 1 ? t('1 mão para rever') : t('{n} mãos para rever', { n: toReview })}
      body={t('Enquanto ainda te lembras de tudo.')}
      action={t('Rever')}
      onPress={() => router.push({ pathname: '/hand/[id]', params: { id: review[0].id } })}
    />
  ) : news.item ? (
    <WhatsNewCard item={news.item} onDismiss={news.dismiss} />
  ) : suggest.show ? (
    <React.Suspense fallback={null}>
      <BackupSuggestion onDone={suggest.dismiss} />
    </React.Suspense>
  ) : checklist && !fresh ? (
    <StartChecklist state={checklist} />
  ) : moment ? (
    <ProMoment state={moment} />
  ) : idleDays >= 7 ? (
    <Banner icon="timer-outline" title={t('Sem sessões há {n} dias', { n: idleDays })} action={t('Começar')} onPress={() => router.navigate('/session')} />
  ) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.gutter, paddingBottom: 40, gap: S.lg }}>
      <ScreenHeader
        title={<Wordmark size={narrow ? 25 : 30} />}
        right={
          // New comments also show here, so they aren't lost when another card wins the one-card slot.
          <IconButton
            name="settings-outline"
            label={shared.newTotal ? `${t('Definições')}, ${shared.newTotal === 1 ? t('1 comentário novo') : t('{n} comentários novos', { n: shared.newTotal })}` : t('Definições')}
            badge={shared.newTotal > 0}
            onPress={() => router.push('/settings')}
          />
        }
      />

      {fresh ? <FirstRun /> : <MonthHero sessions={sessions} hands={hands} now={now} streak={hands.length > 0} compact={compact} />}

      {activeSession ? <LiveCard s={activeSession} /> : null}
      {card}
      {!activeSession && !fresh ? (
        <FadeUp i={1} style={{ flexDirection: compact ? 'column' : 'row', gap: S.sm }}>
          <Button title={t('Começar sessão')} icon="play" onPress={() => router.navigate('/session')} style={compact ? null : { flex: 1.25, paddingHorizontal: narrow ? 12 : 20 }} />
          {/* Most installs happen away from the table: log the last session in 20 s instead of a timer. */}
          <Button title={t('Já joguei')} icon="time-outline" kind="secondary" onPress={() => router.navigate({ pathname: '/bankroll', params: { add: 'session' } })} style={compact ? null : { flex: 1, paddingHorizontal: narrow ? 12 : 20 }} />
        </FadeUp>
      ) : null}

      {fresh ? null : (
        <FadeUp i={2} style={{ gap: S.sm }}>
          <View style={[tileSt.row, compact && tileSt.col]}>
            {played ? <TotalTile sessions={sessions} /> : <Tile icon="stats-chart-outline" label="Bankroll" value="—" sub={t('Ainda sem sessões terminadas')} onPress={() => router.navigate('/bankroll')} />}
            <HandsTile week={weekHands} toReview={toReview} handsLeft={handsLeft} cta={cta} onPro={onPro} />
          </View>
          <View style={[tileSt.row, compact && tileSt.col]}>
            {played ? <RateTile sessions={sessions} /> : <Tile icon="calendar-outline" label={t('Festivais')} value="" sub={t('Calendário e plano')} onPress={() => router.push('/festivals')} />}
            <Tile
              icon="create-outline"
              label={t('Notas')}
              value={players.length ? String(players.length) : '+'}
              sub={lastNote ? lastNote.name || t('Sem nome') : t('Nova nota')}
              onPress={() => router.push(players.length ? '/notes' : { pathname: '/notes', params: { id: 'new' } })}
            />
          </View>
        </FadeUp>
      )}

      {lastHand ? (
        <FadeUp i={3}>
          <Section title={t('Última mão')} action={t('Ver todas')} onAction={() => router.navigate('/hands')}>
            <HandRow hand={lastHand} inBB={settings.inBB} />
          </Section>
        </FadeUp>
      ) : null}

      {fresh ? null : (
        <View style={[tileSt.row, compact && tileSt.col]}>
          <Shortcut icon="calendar-outline" label={t('Festivais')} onPress={() => router.push('/festivals')} />
          <Shortcut icon="calculator-outline" label={t('Calculadora')} onPress={() => router.push('/odds')} />
          <Shortcut icon="swap-horizontal-outline" label={t('Swaps')} onPress={() => router.push('/swaps')} />
        </View>
      )}
    </ScrollView>
  );
}

/** Monday 00:00 of this week, local time. */
function weekStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/**
 * The month as one big number with a short line under it, the month before for scale, and the
 * week as seven dots (Runna). The verdict on everything shows here once there's enough to judge.
 */
function MonthHero({ sessions, hands, now, streak, compact }: { sessions: Session[]; hands: Hand[]; now: number; streak: boolean; compact: boolean }) {
  const key = monthKey(now);
  const m = useMemo(() => monthRecap(sessions, key), [sessions, key]);
  const cur = m.currency;
  const prev = useMemo(() => monthRecap(sessions, prevKey(key), cur), [sessions, key, cur]);
  const v = useMemo(() => verdict(sessions, cur, (n) => money(n, cur)), [sessions, cur]);
  const shown = useCountUp(m.profit);
  const line = m.sessions
    ? [m.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: m.sessions }), t('{h} h', { h: m.hours.toLocaleString(locale, { maximumFractionDigits: 1 }) }), rateShown(m.hours) ? t('{amount}/h', { amount: money(Math.round(m.hourly), cur) }) : ''].filter(Boolean).join(' · ')
    : t('Ainda sem sessões em {month}', { month: monthName(key).toLowerCase() });
  return (
    <View style={heroSt.wrap}>
      <View style={{ flexDirection: compact ? 'column' : 'row', alignItems: 'flex-start', gap: S.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${monthName(key)}: ${m.sessions ? plus(m.profit) + money(m.profit, cur) : '—'}. ${line}`}
          onPress={() => router.push({ pathname: '/month', params: { m: key, c: cur } })}
          style={({ pressed }) => ({ flex: compact ? undefined : 1, alignSelf: 'stretch', gap: 2, opacity: pressed ? 0.7 : 1 })}>
          <T v="label">{monthName(key)}</T>
          {m.sessions ? <Amount value={m.profit} text={money(shown, cur)} v="monoXL" fit /> : <T v="monoXL" color={C.muted}>—</T>}
          <T v="small">{line}</T>
          {prev.sessions ? (
            <T v="tiny">
              {t('{month}: {amount}', { month: monthName(prev.key), amount: plus(prev.profit) + money(prev.profit, cur) })}
            </T>
          ) : null}
        </Pressable>
        {streak ? (
          <View style={compact ? null : { width: 92 }}>
            <StreakStat />
          </View>
        ) : null}
      </View>
      <WeekStrip sessions={sessions} hands={hands} now={now} />
      {v.ready ? (
        <T v="callout" color={v.tone === 'good' ? C.good : v.tone === 'bad' ? C.bad : C.text}>
          {v.text}
        </T>
      ) : null}
    </View>
  );
}

/** This week, Monday to Sunday: a dot per day by its result, a ring for a loss, grey for hands only. */
function WeekStrip({ sessions, hands, now }: { sessions: Session[]; hands: Hand[]; now: number }) {
  const start = weekStart(now);
  const days = useMemo(() => {
    const out = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return { at: d.getTime(), net: 0, played: false, hands: 0 };
    });
    // By calendar day (a day can be 23 or 25 hours long), and nothing from next week.
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const idx = (ts: number) => {
      if (ts >= end.getTime()) return -1;
      for (let i = 6; i >= 0; i--) if (ts >= out[i].at) return i;
      return -1;
    };
    for (const s of sessions) {
      if (!s.endedAt || s.startedAt < start) continue;
      const i = idx(s.startedAt);
      if (i < 0) continue;
      out[i].played = true;
      out[i].net += profit(s);
    }
    for (const h of hands) {
      if (h.createdAt < start) continue;
      const i = idx(h.createdAt);
      if (i >= 0) out[i].hands++;
    }
    return out;
  }, [sessions, hands, start]);
  const today = days.findIndex((d, i) => now >= d.at && (i === 6 || now < days[i + 1].at));
  const names = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    return days.map((d) => f.format(d.at));
  }, [days]);
  return (
    <View style={heroSt.week} accessible accessibilityLabel={[
        t('Dias com sessões esta semana: {n}.', { n: days.filter((d) => d.played).length }),
        t('Dias a ganhar: {n}.', { n: days.filter((d) => d.played && d.net > 0).length }),
        t('Dias a perder: {n}.', { n: days.filter((d) => d.played && d.net < 0).length }),
      ].join(' ')}>
      {days.map((d, i) => (
        <View key={i} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
          <T v="tiny" color={i === today ? C.text : C.muted} style={i === today ? { fontFamily: ff(800) } : null}>
            {names[i]}
          </T>
          <Dot i={i}
            style={[
              heroSt.day,
              i === today && { borderWidth: 1.5, borderColor: C.borderStrong },
              d.played && d.net > 0 && { backgroundColor: C.good, borderWidth: 0 },
              d.played && d.net < 0 && { backgroundColor: 'transparent', borderWidth: 2, borderColor: C.bad },
              d.played && d.net === 0 && { backgroundColor: C.textDim, borderWidth: 0 },
              // Hands but no finished session: a small grey dot, never a ring (a ring is a loss).
              !d.played && d.hands > 0 && { backgroundColor: C.text, width: 6, height: 6, margin: 4 },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Motion, once, when the app opens: the month counts up, the week's days light up one after another
 * and the rest rises into place (Oura, WHOOP). Nothing moves with Reduce Motion, and the screen reads
 * the same without it: the final value is there for VoiceOver from the start.
 */
function useCountUp(target: number, ms = 650) {
  const reduce = useReduceMotion();
  const [v, setV] = useState(reduce ? target : 0);
  const done = useRef(reduce);
  useEffect(() => {
    if (done.current || target === 0) {
      setV(target);
      return;
    }
    done.current = true;
    const a = new Animated.Value(0);
    const id = a.addListener(({ value }) => setV(Math.round(target * value)));
    Animated.timing(a, { toValue: 1, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => setV(target));
    return () => {
      a.removeListener(id);
      a.stopAnimation();
    };
  }, [target, ms]);
  return v;
}

/** Fades and rises 8 pt into place, in order (`i`), the first time it shows. */
function FadeUp({ i, style, children }: { i: number; style?: React.ComponentProps<typeof View>['style']; children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const [a] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 320, delay: 60 + i * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, i]);
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>;
}

/** A day of the week strip: pops in after the one before it. */
function Dot({ i, style }: { i: number; style: React.ComponentProps<typeof View>['style'] }) {
  const reduce = useReduceMotion();
  const [a] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    Animated.spring(a, { toValue: 1, delay: 200 + i * 45, friction: 6, tension: 140, useNativeDriver: true }).start();
  }, [a, i]);
  return <Animated.View style={[style, { transform: [{ scale: a }] }]} />;
}

const heroSt = StyleSheet.create({
  wrap: { gap: S.md, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: S.lg, ...SHADOW },
  week: { flexDirection: 'row', paddingTop: S.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  day: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.surface3 },
});

/** The session at the table, big, with its clock: one tap back to it. */
function LiveCard({ s }: { s: Session }) {
  const now = useNowAlways(30000);
  const paused = isPaused(s);
  const col = paused ? C.warn : C.good;
  return (
    <Card
      tone="good"
      onPress={() => {
        tap();
        router.navigate('/session');
      }}
      accessibilityLabel={paused ? t('Sessão em pausa · {time}', { time: duration(playedMs(s, now)) }) : t('Sessão em curso · {time}', { time: duration(playedMs(s, now)) })}
      style={{ gap: S.xs }}>
      <Row>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} />
        <T v="label" color={col} style={{ flex: 1 }}>
          {paused ? t('Em pausa') : t('A decorrer')}
        </T>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </Row>
      <T v="h2" numberOfLines={1}>
        {s.name || s.venue || (s.kind === 'mtt' ? t('Torneio') : 'Cash')}
      </T>
      <T v="monoL">{duration(playedMs(s, now))}</T>
    </Card>
  );
}

/** A tile in the 2×2 grid: a label, one number, one line, and where it opens. */
function Tile({ icon, label, value, sub, subColor, onPress, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: React.ReactNode; sub?: React.ReactNode; subColor?: string; onPress: () => void; children?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [tileSt.tile, pressed && { backgroundColor: C.surface2 }]}>
      <Row gap={6}>
        <Ionicons name={icon} size={15} color={C.accent} />
        <T v="label" numberOfLines={1} style={{ flex: 1 }} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.3}>
          {label}
        </T>
      </Row>
      {typeof value === 'string' ? (
        value ? (
          <T v="monoL" numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </T>
        ) : null
      ) : (
        value
      )}
      {children}
      {sub ? (
        typeof sub === 'string' ? (
          <T v="small" numberOfLines={1} color={subColor}>
            {sub}
          </T>
        ) : (
          sub
        )
      ) : null}
    </Pressable>
  );
}

const tileSt = StyleSheet.create({
  row: { flexDirection: 'row', gap: S.sm, alignItems: 'stretch' },
  col: { flexDirection: 'column' },
  tile: { flex: 1, gap: 4, minHeight: 112, padding: 14, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border },
});

/** Everything played, in the main currency, with the curve as a sparkline. Other currencies are left out, and it says so. */
function TotalTile({ sessions }: { sessions: Session[] }) {
  const tot = useMemo(() => totals(sessions), [sessions]);
  const pts = useMemo(() => curve(sessions, tot.currency).map((p) => p.v), [sessions, tot.currency]);
  return (
    <Tile
      icon="stats-chart-outline"
      label={t('Total')}
      value={<Amount value={tot.profit} text={money(tot.profit, tot.currency)} v="monoL" fit />}
      sub={tot.otherCurrencies.length ? t('Sem {list}', { list: tot.otherCurrencies.join(', ') }) : undefined}
      onPress={() => router.navigate('/bankroll')}>
      {pts.length > 2 ? <LineChart values={pts} height={34} zeroLine={false} /> : null}
    </Tile>
  );
}

function RateTile({ sessions }: { sessions: Session[] }) {
  const tot = useMemo(() => totals(sessions), [sessions]);
  const shown = rateShown(tot.hours);
  return (
    <Tile
      icon="time-outline"
      label={t('Por hora')}
      value={shown ? <Amount value={tot.hourly} text={t('{amount}/h', { amount: money(Math.round(tot.hourly), tot.currency) })} v="monoL" fit /> : '—'}
      sub={t('{h} h a jogar', { h: tot.hours.toLocaleString(locale, { maximumFractionDigits: 0 }) })}
      onPress={() => router.navigate('/bankroll')}
    />
  );
}

/** Hands this week, what waits for review, and on the free plan today's free hands (the paywall's way in). */
function HandsTile({ week, toReview, handsLeft, cta, onPro }: { week: number; toReview: number; handsLeft: number | null; cta: string; onPro: () => void }) {
  const out = handsLeft === 0;
  return (
    <Tile
      icon="albums-outline"
      label={t('Mãos')}
      value={
        <Row gap={6} style={{ alignItems: 'baseline' }}>
          <T v="monoL">{week}</T>
          <T v="tiny">{t('esta semana')}</T>
        </Row>
      }
      onPress={out ? onPro : () => router.navigate('/hands')}
      sub={
        out ? (
          <T v="small" numberOfLines={1} color={C.accent} style={{ fontFamily: ff(800) }}>
            {cta}
          </T>
        ) : handsLeft !== null ? (
          <Row gap={6} accessible accessibilityLabel={handsLeft === 1 ? t('Falta 1 mão grátis hoje') : t('Faltam {n} mãos grátis hoje', { n: handsLeft })}>
            <T v="small">{t('Grátis hoje')}</T>
            <Row gap={3}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ width: 10, height: 5, borderRadius: 3, backgroundColor: i < handsLeft ? C.accent : C.surface3 }} />
              ))}
            </Row>
            <T v="tiny" style={{ fontFamily: ff(700) }}>{`${handsLeft}/3`}</T>
          </Row>
        ) : toReview ? (
          t('{n} por rever', { n: toReview })
        ) : undefined
      }
    />
  );
}

function Shortcut({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [shortSt.chip, pressed && { backgroundColor: C.surface2 }]}>
      <Ionicons name={icon} size={16} color={C.accent} />
      <T v="small" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: C.text, fontFamily: ff(600), flexShrink: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}

const shortSt = StyleSheet.create({
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 10, backgroundColor: C.surface, borderRadius: R.pill, borderWidth: 1, borderColor: C.border },
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
        <Button title={t('Já jogaste? Regista a última sessão')} icon="time-outline" kind="secondary" size="md" onPress={() => router.navigate({ pathname: '/bankroll', params: { add: 'session' } })} />
        <Button title={t('Ver uma mão de exemplo')} kind="ghost" size="md" onPress={() => router.push({ pathname: '/hand/[id]', params: { id: 'sample' } })} />
      </View>
    </Card>
  );
}
