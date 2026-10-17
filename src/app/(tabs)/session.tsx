// Live session: the clock, your stack, blinds, rebuys and cash-out, all in one
// screen you can update between hands. Hands recorded while a session is open
// are linked to it and keep its stack up to date.

import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AmountPad } from '@/components/AmountPad';
import { Avatar } from '@/components/Avatar';
import { useAfterFirstFrame } from '@/components/Deferred';
import { StopLossBanner } from '@/components/BankrollRules';
import { LineChart } from '@/components/LineChart';
import { blankSession, firstSession, SessionForm } from '@/components/SessionForm';
import { canReadReceipts } from '@/lib/receipt-ocr';
import { BackerLiveCard } from '@/components/staking/BackerLive';
import { SwapLiveRow } from '@/components/swaps/SwapLiveRow';
import { MindAfter, MindBefore } from '@/components/MindCheckIn';
import { useNotifySoftAsk } from '@/components/NotifySoftAsk';
import { StakeFields } from '@/components/StakeFields';
import { CoachMarks, type CoachStep, type ViewRef } from '@/components/CoachMarks';
import { FestivalItem, PlannedNow } from '@/components/FestivalItem';
import { sessionFromEvent, sessionName } from '@/components/useStartEvent';
import { Banner, Button, Card, Chip, ChipRow, Field, IconButton, ListGroup, ListItem, NumField, Pill, Row, Screen, Section, SheetHeader, T, tap, useSheetPad } from '@/components/ui';
import { t } from '@/i18n';
import { LEVEL_LENGTHS, levelAfter, levelsDue, levelUpMessage, nextLevelAt } from '@/lib/lock-screen/live-state';
import { bbs, chips, duration, money, shortDate, timeOf } from '@/poker/format';
import { STAGES } from '@/poker/types';
import { bagDay, dayOf, isBagged, resumeDay } from '@/store/multi-day';
import { liveResult } from '@/store/rules-math';
import { cost, isPaused, owedToBackers, playedMs, profit } from '@/store/session-math';
import { eventDay } from '@/poker/festivals';
import { updatePlan } from '@/store/festival-plan';
import { dayKey, notOver, soon, useFestivals } from '@/store/my-festivals';
import { track } from '@/lib/events';
import { ONBOARDING_KEY } from '@/billing/onboarding';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, S } from '@/theme';
import { useSheetAnimation } from '@/lib/motion';

/**
 * Re-renders every `ms` while this tab is on screen and returns the time of
 * the tick. Tabs stay mounted, so an always-on interval kept redrawing the
 * whole session screen every second behind hand entry and the hands list.
 */
function useTick(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const id = setInterval(() => setNow(Date.now()), ms);
      return () => clearInterval(id);
    }, [ms]),
  );
  return now;
}

// The parts of the live screen that change with time each keep their own tick,
// so the clock redraws one line a second instead of the whole screen (chart,
// table reads, money) behind it.

function PlayClock({ s, paused }: { s: Session; paused: boolean }) {
  const now = useTick(1000);
  return (
    <T v="monoXL" style={{ fontSize: 52, lineHeight: 58 }} color={paused ? C.warn : C.text}>
      {clock(playedMs(s, now))}
    </T>
  );
}

function LevelAlarm({ s, onDue }: { s: Session; onDue: () => void }) {
  const now = useTick(1000);
  const nextAt = nextLevelAt(s, now);
  const levelDue = !!nextAt && nextAt <= now;
  // A tournament's level goes up by itself when the clock runs out (see levelsDue); cash just shows it.
  useEffect(() => {
    if (levelDue && s.kind === 'mtt') onDue();
  }, [levelDue, s.kind, onDue]);
  const color = levelDue ? C.accent : s.levelMinutes ? C.textDim : C.muted;
  return (
    <Row gap={4} style={{ marginTop: 2 }}>
      <Ionicons name="alarm-outline" size={13} color={color} />
      <T v="monoS" color={color}>
        {!nextAt ? t('Aviso de nível') : levelDue ? t('{min} min · subir nível', { min: s.levelMinutes! }) : t('{min} min · sobe em {time}', { min: s.levelMinutes!, time: mmss(nextAt - now) })}
      </T>
    </Row>
  );
}

function SinceStart({ s }: { s: Session }) {
  // Hours and minutes: a 30 s tick is enough.
  const now = useTick(30000);
  return (
    <T v="tiny" style={{ textAlign: 'center' }}>
      {t('{date} · {total} desde o início · resultado atual {profit}', { date: shortDate(s.startedAt), total: duration(now - s.startedAt), profit: money(s.kind === 'cash' ? liveResult(s) : profit(s), s.currency) })}
    </T>
  );
}

/**
 * Height of the pinned thumb bar, so the scroll content ends above it. At the
 * largest text sizes the bar grows, and a fixed padding left inputs under it.
 */
function useBarHeight(): [number, (e: LayoutChangeEvent) => void] {
  const [h, setH] = useState(80);
  return [h, (e) => setH(Math.ceil(e.nativeEvent.layout.height))];
}

/** One-tap stack updates: what an orbit of blinds costs, and the usual swings. */
function stackQuick(s: Session): { label: string; value: number }[] {
  const unit = Math.max(1, s.sb || 1);
  const round = (v: number) => Math.max(0, Math.round(v / unit) * unit);
  const antes = s.anteType === 'none' ? 0 : s.anteType === 'all' ? s.ante * s.tableSize : s.ante;
  const orbit = s.sb + s.bb + antes;
  return [
    { label: t('−1 órbita'), value: round(s.stack - orbit) },
    { label: '−10%', value: round(s.stack * 0.9) },
    { label: '+10%', value: round(s.stack * 1.1) },
    { label: '×2', value: s.stack * 2 },
  ];
}

export default function SessionScreen() {
  const { activeSession, sessions, saveSession, settings, setSettings, bankrolls, defaultBankroll } = useStore();
  const recentNames = useMemo(() => [...new Set(sessions.map((s) => s.name).filter(Boolean))].slice(0, 8), [sessions]);
  const recentVenues = useMemo(() => [...new Set(sessions.map((s) => s.venue).filter(Boolean))].slice(0, 8), [sessions]);
  const bagged = useMemo(() => sessions.filter(isBagged), [sessions]);
  const festivals = useFestivals();
  const [today] = useState(() => dayKey(Date.now()));
  const coming = useMemo(() => festivals.filter((f) => notOver(f, today)), [festivals, today]);
  // The tab is for starting a session: one festival row only when it's on or a week away (design/simplificar.md).
  const near = coming.find((f) => soon(f, today));
  const next = coming.find((f) => f !== near);
  // Today's festival tournaments, for the form's chips (Day 2s carry on from "Por continuar").
  const todays = useMemo(
    () =>
      coming
        .flatMap((f) => f.events.filter((e) => !e.day2 && eventDay(e) === today).map((e) => ({ f, e })))
        .sort((a, b) => a.e.start.localeCompare(b.e.start))
        .slice(0, 8),
    [coming, today],
  );

  const startRef = useRef<(() => void) | null>(null);
  const [bar, onBarLayout] = useBarHeight();
  // "Como chegas?" between Começar agora and the clock, unless turned off.
  const [arriving, setArriving] = useState<Session | null>(null);
  // Once a day is enough (answered or skipped): a second flight or a cash game after the tournament starts straight away.
  // The very first session doesn't ask either: the trial offer already follows it.
  const askedToday = !sessions.length || sessions.some((x) => dayKey(x.startedAt) === today);
  // First session ever: game and stakes from the first-run answers, so nothing needs typing.
  const [plays, setPlays] = useState<string | null>(null);
  useEffect(() => {
    if (sessions.length) return;
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((raw) => setPlays(raw ? ((JSON.parse(raw) as { plays?: string | null }).plays ?? null) : null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const begin = (s: Session) => {
    tap('success');
    saveSession(s);
    // Started from a today chip: the festival plan knows, for re-entries and Day 2.
    const hit = todays.find(({ e }) => sessionName(e) === s.name && e.buyIn === s.buyIn);
    if (hit) updatePlan(hit.f.id, (p) => ({ ...p, picked: p.picked.includes(hit.e.id) ? p.picked : [...p.picked, hit.e.id], sessions: { ...p.sessions, [hit.e.id]: s.id } }));
    track('session_started', { kind: s.kind });
    // The next session goes to the same bankroll.
    if (s.bankrollId && s.bankrollId !== settings.bankrollId) setSettings({ bankrollId: s.bankrollId });
  };
  if (activeSession) return <Live s={activeSession} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen title={t('Sessão')} contentStyle={{ paddingBottom: bar + S.lg }}>
        <T v="small" style={{ marginTop: -S.md }}>{t('Cada mão que registares já vem com o torneio, as blinds e o teu stack.')}</T>
        <ListGroup>
          {/* A tournament planned for now comes first: one tap and it's running, filled in. */}
          <PlannedNow festivals={coming} />
          {near ? <FestivalItem f={near} /> : null}
          <ListItem
            icon="calendar-outline"
            iconColor={near ? C.textDim : C.accent}
            title={t('Festivais')}
            subtitle={next ? t('Próximo: {name}', { name: t(next.name) }) : t('Os do calendário e os que adicionares')}
            chevron
            onPress={() => router.push('/festivals')}
          />
        </ListGroup>
        {bagged.length ? (
          <Section title={t('Por continuar')}>
            <ListGroup>
              {bagged.map((b) => (
                <ListItem
                  key={b.id}
                  icon="bag-handle-outline"
                  iconColor={C.accent}
                  title={b.name || t('Torneio')}
                  subtitle={t('Dia {n} · {chips} no saco', { n: dayOf(b), chips: chips(b.bag!.stack) })}
                  onPress={() => router.push({ pathname: '/session-card/[id]', params: { id: b.id, stack: '1' } })}
                  right={
                    <Button
                      size="sm"
                      title={t('Dia {n}', { n: dayOf(b) + 1 })}
                      icon="play"
                      onPress={() => {
                        tap('success');
                        saveSession(resumeDay(b));
                      }}
                    />
                  }
                />
              ))}
            </ListGroup>
          </Section>
        ) : null}
        {/* Paper ticket from registration: the phone reads it and fills the tournament in. */}
        <ListGroup>
          {canReadReceipts ? (
            <ListItem icon="receipt-outline" iconColor={C.accent} title={t('Fotografa o recibo do buy-in')} subtitle={t('Torneio, buy-in, mesa e lugar preenchidos por ti')} onPress={() => router.push('/receipt')} chevron />
          ) : (
            // Expo Go and the web have no text recognition: say so, nothing to tap.
            <ListItem icon="receipt-outline" iconColor={C.textDim} title={t('Fotografa o recibo do buy-in')} subtitle={t('Disponível na versão da loja')} chevron={false} />
          )}
        </ListGroup>
        <SessionForm
          key={plays ?? ''}
          initial={{
            ...((!sessions.length && firstSession(plays, defaultBankroll.currency, settings.defaultTableSize)) ||
              blankSession(sessions[0]?.kind ?? 'mtt', defaultBankroll.currency, settings.defaultTableSize)),
            format: sessions[0]?.format,
            bankrollId: defaultBankroll.id,
          }}
          bankrolls={bankrolls}
          recentNames={recentNames}
          recentVenues={recentVenues}
          today={todays.map(({ f, e }) => {
            const { name, venue, currency, buyIn, stack, levelMinutes, levelStartedAt, tourney } = sessionFromEvent(f, e, settings.defaultTableSize, undefined);
            const bankroll = bankrolls.find((b) => b.currency === f.currency);
            return { key: f.id + e.id, label: `${e.start.slice(11)} ${name}`, fill: { name, venue, currency, buyIn, stack, levelMinutes, levelStartedAt, tourney, ...(bankroll ? { bankrollId: bankroll.id } : {}) } };
          })}
          submitLabel={t('Começar agora')}
          submitRef={startRef}
          onSubmit={(s) => (settings.mindAsk === false || askedToday ? begin(s) : setArriving(s))}
        />
      </Screen>
      {/* Pinned above the tab bar: the form is longer than the screen, starting should not need a scroll. */}
      <View style={styles.thumbBar} onLayout={onBarLayout}>
        {/* A bagged day waiting comes first: one tap on the big button must not buy in a second time. */}
        {bagged[0] ? (
          <>
            <Button title={t('Nova sessão')} kind="secondary" haptic={false} onPress={() => startRef.current?.()} style={{ flex: 1 }} />
            <Button
              title={t('Dia {n}', { n: dayOf(bagged[0]) + 1 }) + ' · ' + (bagged[0].name || t('Torneio'))}
              icon="play"
              onPress={() => {
                tap('success');
                saveSession(resumeDay(bagged[0]));
              }}
              style={{ flex: 1.6 }}
            />
          </>
        ) : (
          <Button title={t('Começar agora')} icon="play" haptic={false} onPress={() => startRef.current?.()} style={{ flex: 1 }} />
        )}
      </View>
      <ArrivalSheet
        s={arriving}
        onClose={() => setArriving(null)}
        onStart={(s) => {
          setArriving(null);
          begin(s);
        }}
        onNever={(s) => {
          setArriving(null);
          setSettings({ mindAsk: false });
          begin(s);
        }}
      />
    </View>
  );
}

/**
 * "Como chegas?" in one screen between Começar agora and the clock. Every
 * answer is optional: Saltar starts straight away, and "Não perguntar mais"
 * turns the journal off (Definições turns it back on).
 */
function ArrivalSheet({ s, onClose, onStart, onNever }: { s: Session | null; onClose: () => void; onStart: (s: Session) => void; onNever: (s: Session) => void }) {
  const sheetAnim = useSheetAnimation();
  const [mind, setMind] = useState<Session['mind']>(undefined);
  const [shownFor, setShownFor] = useState<Session | null>(s);
  if (s !== shownFor) {
    setShownFor(s);
    if (s) setMind(s.mind);
  }
  const sheetPad = useSheetPad(S.xxl);
  return (
    <Modal visible={!!s} transparent animationType={sheetAnim} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: sheetPad, gap: S.md, maxHeight: '92%' }}>
          <SheetHeader title={t('Antes de começar')} onClose={onClose} />
          <ScrollView contentContainerStyle={{ gap: S.md }} keyboardShouldPersistTaps="handled">
            <MindBefore value={mind} onChange={setMind} />
          </ScrollView>
          <Row gap={S.sm}>
            <Button kind="secondary" size="md" title={t('Saltar')} haptic={false} style={{ flex: 1 }} onPress={() => s && onStart(s)} />
            <Button size="md" icon="play" title={t('Começar')} haptic={false} style={{ flex: 1.6 }} onPress={() => s && onStart({ ...s, mind })} />
          </Row>
          <Button kind="plain" size="sm" title={t('Não perguntar mais')} haptic={false} onPress={() => s && onNever(s)} />
        </View>
      </View>
    </Modal>
  );
}

function Live({ s }: { s: Session }) {
  // A browser may refuse the wake lock; ending the session must not throw because of it.
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  const { saveSession, hands, settings } = useStore();
  const [pad, setPad] = useState<null | 'stack' | 'cashout' | 'bag'>(null);
  const [ending, setEnding] = useState(false);
  // The clock and stack first; the chart, money and staking a frame later.
  const full = useAfterFirstFrame();
  const [noteOpen, setNoteOpen] = useState(false);
  const [finish, setFinish] = useState({ cashOut: 0, place: 0, field: 0 });
  const [more, setMore] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollToEnd = useRef(false);
  // What tournament mode already knows fills the form: players left is your place, its payout plus bounties the prize.
  const startEnding = () => {
    if (mtt) {
      const tr = s.tourney;
      const place = tr?.left || 0;
      const prize = (place && tr?.payouts?.[place - 1]) || 0;
      setFinish({ cashOut: prize + (tr?.bounties || 0), place, field: tr?.entries || 0 });
    } else {
      // Cash: the cash-out starts at the live stack, so the result matches what the session showed.
      setFinish((f) => ({ ...f, cashOut: s.stack }));
    }
    setEnding(true);
    // The form opens at the bottom of a long screen: bring it up once it's laid out.
    scrollToEnd.current = true;
  };
  const [moods, setMoods] = useState<string[]>([]);
  const [softAsk, askNotify] = useNotifySoftAsk();
  const paused = isPaused(s);
  const mtt = s.kind === 'mtt';
  // Memoised: hands can be thousands.
  const nHands = useMemo(() => hands.filter((h) => h.sessionId === s.id).length, [hands, s.id]);
  const save = (p: Partial<Session>) => saveSession({ ...s, ...p });
  const first = s.stackLog[0]?.stack ?? s.stack;
  // Cash: against what went in, so a rebuy's chips don't read as a win. Tournament: chips since the start.
  const delta = mtt ? s.stack - first : s.stack - cost(s);

  const bumpLevel = (dir: 1 | -1) => {
    tap();
    save(levelAfter(s, dir));
  };
  // Level length cycles Off → 15 → 20 → 30 → 40 → 60 → Off; the clock restarts on set (see withLevelClock).
  const cycleLevelLength = () => {
    tap();
    const i = LEVEL_LENGTHS.indexOf((s.levelMinutes ?? 0) as (typeof LEVEL_LENGTHS)[number]);
    const levelMinutes = i + 1 < LEVEL_LENGTHS.length ? LEVEL_LENGTHS[i + 1] : undefined;
    if (levelMinutes && !s.levelMinutes) {
      void askNotify({ where: 'session', title: t('Avisamos-te quando o nível sobe'), preview: levelUpMessage(s) });
    }
    save({ levelMinutes, levelStartedAt: undefined });
  };
  const levelUp = () => {
    const p = levelsDue(s);
    if (p) save(p);
  };
  const togglePause = () => {
    tap();
    const now = Date.now();
    if (paused) save({ breaks: s.breaks.map((b, i) => (i === s.breaks.length - 1 ? { ...b, end: now } : b)) });
    else save({ breaks: [...s.breaks, { start: now }] });
  };

  // No "Are you sure?": it happens at once with "Anular" for a few seconds, which is quicker at the table and as safe.
  const [undo, setUndo] = useState<{ title: string; prev: Partial<Session> } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(timer);
  }, [undo]);
  const undoable = (title: string, next: Partial<Session>) => {
    tap('success');
    const prev = Object.fromEntries(Object.keys(next).map((k) => [k, s[k as keyof Session]])) as Partial<Session>;
    setUndo({ title, prev });
    save(next);
  };
  // The new chips go on the stack too (cash: the buy-in; tournament: a fresh starting stack), so nobody has to type it.
  const rebuy = () => {
    const stack = mtt ? s.tourney?.startStack || first : s.stack + s.buyIn;
    undoable(`${mtt ? 'Re-entry' : 'Rebuy'} · ${money(s.buyIn, s.currency)}`, {
      entries: s.entries + 1,
      stack,
      stackLog: [...s.stackLog, { t: Date.now(), stack, level: s.level }],
    });
  };

  const [bar, onBarLayout] = useBarHeight();
  // First live session: a three-step tour of what matters between hands.
  const stackRef = useRef<ViewRef>(null);
  const barRef = useRef<ViewRef>(null);
  const handRef = useRef<ViewRef>(null);
  const tour = useMemo<CoachStep[]>(
    () => [
      { target: stackRef, title: t('O teu stack'), body: t('Toca para o atualizar entre mãos. As bb e o gráfico acompanham sozinhos.') },
      { target: barRef, title: t('Tudo ao alcance do polegar'), body: t('Pausa, rebuy e uma nota da sessão sem saíres deste ecrã.') },
      {
        target: handRef,
        title: t('Regista uma mão'),
        body: mtt ? t('Já vem com o torneio, as blinds e o teu stack. Se fores chamado, fica guardada a meio.') : t('Já vem com o jogo, as blinds e o teu stack. Se fores chamado, fica guardada a meio.'),
      },
    ],
    [mtt],
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {softAsk}
      <Screen scrollRef={scrollRef} title={s.name || t('Sessão')} eyebrow={(mtt ? t('Torneio') : 'Cash') + (s.day ? ' · ' + t('Dia {n}', { n: s.day }) : '') + (s.venue ? ' · ' + s.venue : '')} contentStyle={{ gap: S.lg, paddingBottom: bar + S.lg }}>
        <Card tone="raised" style={{ alignItems: 'center', gap: S.md, paddingVertical: S.xl }}>
          <Pill label={paused ? t('Em pausa') : t('A jogar')} color={paused ? C.warn : C.good} icon={paused ? 'pause' : 'ellipse'} />
          <PlayClock s={s} paused={paused} />
          <T v="small">{t('Começou às {time} · {n}', { time: timeOf(s.startedAt), n: nHands === 1 ? t('1 mão') : t('{n} mãos', { n: nHands }) })}</T>
        </Card>

        <StopLossBanner s={s} />

        <Row gap={S.sm} style={{ alignItems: 'stretch' }}>
          <View ref={stackRef} collapsable={false} style={{ flex: 1 }}>
          <Card onPress={() => setPad('stack')} style={{ flex: 1, gap: 4 }} accessibilityLabel={t('Atualizar stack')}>
            <Row>
              <T v="label" style={{ flex: 1 }}>
                Stack
              </T>
              {mtt ? (
                // The chip-count post of a festival day: card + text, chips only.
                <Pressable onPress={() => router.push({ pathname: '/session-card/[id]', params: { id: s.id, stack: '1' } })} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Partilhar stack')} style={{ marginRight: 10 }}>
                  <Ionicons name="share-outline" size={15} color={C.accent} />
                </Pressable>
              ) : null}
              <Ionicons name="pencil" size={13} color={C.accent} />
            </Row>
            <T v="monoL" numberOfLines={1} adjustsFontSizeToFit>
              {chips(s.stack)}
            </T>
            <Row gap={6}>
              <T v="monoS">{bbs(s.stack, s.bb)}</T>
              {delta ? (
                <T v="monoS" color={delta > 0 ? C.good : C.bad}>
                  {(delta > 0 ? '+' : '') + chips(delta)}
                </T>
              ) : null}
            </Row>
          </Card>
          </View>
          <Card style={{ flex: 1, gap: 4 }}>
            <T v="label">{s.level ? t('Nível {n}', { n: s.level }) : 'Blinds'}</T>
            <T v="monoL" numberOfLines={1} adjustsFontSizeToFit>
              {chips(s.sb)}/{chips(s.bb)}
            </T>
            <Row gap={S.sm} style={{ marginTop: 2 }}>
              <IconButton name="remove" size={32} label={t('Descer nível')} onPress={() => bumpLevel(-1)} />
              <IconButton name="add" size={32} label={t('Subir nível')} onPress={() => bumpLevel(1)} color={C.accent} />
            </Row>
            <Pressable onPress={cycleLevelLength} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Duração do nível')}>
              <LevelAlarm s={s} onDue={levelUp} />
            </Pressable>
          </Card>
        </Row>

        {mtt ? (
          <ListGroup>
            <ListItem icon="trophy-outline" iconColor={C.accent} title={t('Modo torneio')} subtitle={t('Estrutura, relógio sincronizado, prémios e deal')} onPress={() => router.push('/tournament')} chevron />
          </ListGroup>
        ) : null}

        {full ? (
          <>
          {s.stackLog.length > 1 && (
            <Section title={t('Stack ao longo da sessão')}>
              <Card style={{ paddingHorizontal: S.md }}>
                <LineChart
                  values={s.stackLog.map((x) => x.stack)}
                  height={120}
                  zeroLine={false}
                  label={t('Stack de {from} para {to}; o mais alto foi {max}.', { from: chips(s.stackLog[0].stack), to: chips(s.stack), max: chips(Math.max(...s.stackLog.map((x) => x.stack))) })}
                />
              </Card>
            </Section>
          )}

          <TableReads roster={s.roster} />

          {mtt && (
            <Section title={t('Fase do torneio')}>
              <ChipRow>
                {STAGES.map((st) => (
                  <Chip key={st.id} label={st.label} active={s.stage === st.id} onPress={() => save({ stage: st.id })} />
                ))}
              </ChipRow>
            </Section>
          )}

          <Section title={t('Dinheiro')}>
            <ListGroup>
              <ListItem icon="wallet-outline" title={t('Buy-ins')} value={money(cost(s), s.currency)} />
              <ListItem
                icon="add-circle-outline"
                iconColor={C.accent}
                title={mtt ? 'Re-entry' : 'Rebuy'}
                subtitle={money(s.buyIn, s.currency)}
                onPress={rebuy}
              />
              {mtt ? <ListItem icon="layers-outline" iconColor={C.accent} title="Add-on" subtitle={money(s.buyIn, s.currency)} onPress={() => undoable(`Add-on · ${money(s.buyIn, s.currency)}`, { addOn: (s.addOn || 0) + s.buyIn })} /> : null}
              {mtt ? <ListItem icon="pie-chart-outline" iconColor={C.info} title={t('Calculadora de deal (ICM)')} onPress={() => router.push('/chop')} /> : null}
              {mtt ? <SwapLiveRow s={s} /> : null}
            </ListGroup>
          </Section>

          <Section title="Staking" action={t('Backers')} onAction={() => router.push('/staking')}>
            <BackerLiveCard s={s} />
            <StakeFields s={s} onChange={save} expenses={false} />
          </Section>

          {!ending ? (
            <View style={{ gap: S.sm }}>
              {mtt ? <Button title={t('Ensacar fichas (fim do dia {n})', { n: dayOf(s) })} kind="secondary" size="md" icon="bag-handle-outline" onPress={() => setPad('bag')} /> : null}
              <Button title={t('Terminar sessão')} kind="danger" size="md" icon="flag-outline" onPress={startEnding} />
            </View>
          ) : (
            <View
              key="ending"
              onLayout={(e) => {
                if (!scrollToEnd.current) return;
                scrollToEnd.current = false;
                const y = Math.max(0, e.nativeEvent.layout.y - S.lg);
                // A frame later, once the taller content is in the scroll view.
                requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: true }));
              }}
            >
            <Section title={t('Terminar sessão')}>
              <Card style={{ gap: S.md }}>
                <Row gap={S.sm}>
                  <NumField label={mtt ? t('Prémio ({currency})', { currency: s.currency }) : `Cash-out (${s.currency})`} value={finish.cashOut} onChange={(cashOut) => setFinish((f) => ({ ...f, cashOut }))} />
                  {mtt ? <NumField label={t('Lugar')} value={finish.place} onChange={(place) => setFinish((f) => ({ ...f, place }))} /> : null}
                  {mtt ? <NumField label={t('Inscritos')} value={finish.field} onChange={(field) => setFinish((f) => ({ ...f, field }))} /> : null}
                </Row>
                <View style={{ gap: S.sm }}>
                  <T v="label">{t('Como correu')}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
                    {SESSION_TAGS.map((tg) => (
                      <Chip key={tg} label={t(tg)} active={moods.includes(tg)} onPress={() => setMoods((m) => (m.includes(tg) ? m.filter((x) => x !== tg) : [...m, tg]))} />
                    ))}
                  </View>
                </View>
                {(() => {
                  const end = { ...s, cashOut: finish.cashOut };
                  const owed = owedToBackers(end);
                  const p = profit(end);
                  return (
                    <View style={{ gap: 6, paddingTop: S.xs }}>
                      {owed > 0 ? (
                        <Row style={{ justifyContent: 'space-between' }}>
                          <T v="small">{t('A pagar aos backers')}</T>
                          <T v="mono">{money(owed, s.currency)}</T>
                        </Row>
                      ) : null}
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T v="h3">{s.stakes?.length || s.staking?.sold || s.expenses ? t('O teu resultado') : t('Resultado')}</T>
                        <T v="monoL" color={p >= 0 ? C.good : C.bad}>
                          {(p > 0 ? '+' : '') + money(p, s.currency)}
                        </T>
                      </Row>
                    </View>
                  );
                })()}
                <Row gap={S.sm}>
                  <Button kind="ghost" size="md" title={t('Voltar')} style={{ flex: 1 }} onPress={() => setEnding(false)} />
                  <Button
                    size="md"
                    title={t('Guardar')}
                    style={{ flex: 1 }}
                    haptic={false}
                    onPress={() => {
                      tap('success');
                      const now = Date.now();
                      saveSession({
                        ...s,
                        cashOut: finish.cashOut,
                        finish: finish.place || undefined,
                        field: finish.field || undefined,
                        endedAt: now,
                      tags: moods.length ? moods : undefined,
                        breaks: s.breaks.map((b) => (b.end ? b : { ...b, end: now })),
                      });
                      // No money in events: kind, hands saved in it and a duration bucket.
                      const h = playedMs(s, now) / 3_600_000;
                      track('session_closed', { kind: s.kind, hands: hands.filter((x) => x.sessionId === s.id).length, minutes_bucket: h < 1 ? '<1h' : h < 3 ? '1-3h' : h < 6 ? '3-6h' : '6h+' });
                      router.push({ pathname: '/summary/[id]', params: { id: s.id } });
                    }}
                  />
                </Row>
                {/* Rarely needed at the table: out of the way of Guardar. */}
                <Button kind="plain" size="sm" title={more ? t('Menos detalhes') : t('Mais detalhes')} iconRight={more ? 'chevron-up' : 'chevron-down'} haptic={false} onPress={() => setMore((m) => !m)} />
                {more ? (
                  <View style={{ gap: S.md }}>
                    <Row gap={S.sm}>
                      <NumField label={t('Gorjetas ({currency})', { currency: s.currency })} value={s.tips ?? 0} onChange={(tips) => save({ tips: tips || undefined })} />
                      <NumField label={t('Mãos jogadas')} value={s.handsDealt ?? 0} onChange={(handsDealt) => save({ handsDealt: handsDealt || undefined })} />
                    </Row>
                    {settings.mindAsk === false ? null : <MindAfter value={s.mind} onChange={(mind) => save({ mind })} />}
                    <StakeFields s={s} onChange={save} />
                  </View>
                ) : null}
              </Card>
            </Section>
            </View>
          )}
          </>
        ) : (
          <View style={{ height: 900 }} />
        )}

        <AmountPad
          visible={pad === 'bag'}
          title={t('Fichas no saco')}
          bb={s.bb}
          onClose={() => setPad(null)}
          onDone={(v) => {
            setPad(null);
            tap('success');
            saveSession(bagDay(s, v));
          }}
        />
        <AmountPad
          visible={pad === 'stack'}
          title={t('Stack atual')}
          bb={s.bb}
          initial={s.stack}
          quick={stackQuick(s)}
          onClose={() => setPad(null)}
          onDone={(v) => {
            setPad(null);
            save({ stack: v, stackLog: [...s.stackLog, { t: Date.now(), stack: v, level: s.level }] });
          }}
        />
        <SinceStart s={s} />
      </Screen>
      {undo ? (
        <View style={{ position: 'absolute', left: S.gutter, right: S.gutter, bottom: bar + S.sm }}>
          <Banner
            tone="info"
            icon="checkmark-circle-outline"
            title={undo.title}
            action={t('Anular')}
            onPress={() => {
              save(undo.prev);
              setUndo(null);
            }}
          />
        </View>
      ) : null}
      {/* Everything you do between hands, within reach of the thumb. */}
      <View style={styles.thumbBar} onLayout={onBarLayout}>
        <View ref={barRef} collapsable={false} style={{ flex: 3, flexDirection: 'row', alignItems: 'stretch', gap: S.sm }}>
        <ThumbAction icon={paused ? 'play' : 'pause'} label={paused ? t('Retomar') : t('Pausa')} onPress={togglePause} active={paused} />
        <ThumbAction icon="add-circle-outline" label={mtt ? 'Re-entry' : 'Rebuy'} onPress={rebuy} />
        <ThumbAction icon={s.notes ? 'document-text' : 'document-text-outline'} label={t('Nota')} onPress={() => setNoteOpen(true)} />
        </View>
        <View ref={handRef} collapsable={false} style={{ flex: 2 }}>
          {/* "Nueva mano" / "Nova mão" at 200%: two lines rather than "Nueva m…". */}
          <Button size="md" title={t('Nova mão')} icon="add" lines={2} style={{ paddingHorizontal: 12, gap: 6 }} onPress={() => router.push('/hand/new')} />
        </View>
      </View>
      <CoachMarks id="live-session" steps={tour} />
      <NoteSheet
        visible={noteOpen}
        value={s.notes}
        onClose={() => setNoteOpen(false)}
        onSave={(notes) => {
          setNoteOpen(false);
          save({ notes });
        }}
      />
    </View>
  );
}

/** One tap each when ending: how you played and what the table was like. */
const SESSION_TAGS = ['Focado', 'Cansado', 'Tilt', 'Mesa fácil', 'Mesa difícil', 'Bem jogado', 'Azar'];

/** Square icon-and-label button for the bar at the bottom of a live session. */
function ThumbAction({ icon, label, onPress, active }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.thumb, { opacity: pressed ? 0.7 : 1, borderColor: active ? C.warn : C.border }]}>
      <Ionicons name={icon} size={20} color={active ? C.warn : C.text} />
      <T v="tiny" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.2} color={active ? C.warn : C.textDim}>
        {label}
      </T>
    </Pressable>
  );
}

/** A free note on the session: table dynamics, how you felt, anything to remember. */
function NoteSheet({ visible, value, onClose, onSave }: { visible: boolean; value: string; onClose: () => void; onSave: (v: string) => void }) {
  const sheetAnim = useSheetAnimation();
  const [text, setText] = useState(value);
  const [shownFor, setShownFor] = useState(visible);
  // Start from the saved note each time the sheet opens.
  if (visible !== shownFor) {
    setShownFor(visible);
    if (visible) setText(value);
  }
  const sheetPad = useSheetPad(S.xxl);
  return (
    <Modal visible={visible} transparent animationType={sheetAnim} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: sheetPad, gap: S.md }}>
          <SheetHeader title={t('Nota da sessão')} onClose={onClose} />
          <Field value={text} onChangeText={setText} placeholder={t('A mesa, como te sentes, o que queres lembrar…')} multiline autoFocus inputStyle={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }} />
          <Button title={t('Guardar')} icon="checkmark" onPress={() => onSave(text.trim())} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  thumbBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: S.sm,
    paddingHorizontal: S.gutter,
    paddingVertical: S.sm,
    backgroundColor: C.bgDeep,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  thumb: { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', gap: 2 },
});

/** Who's at your table, with your notes on them: a glance between hands. */
function TableReads({ roster }: { roster: string[] }) {
  const { players, settings } = useStore();
  const known = roster
    .map((name, seat) => ({ seat, name: name.trim(), note: players.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()) }))
    .filter((x) => x.name && x.name.toLowerCase() !== 'hero' && x.name !== settings.nickname && x.note && (x.note.tags.length || x.note.notes || x.note.look));
  if (!known.length) return null;
  return (
    <Section title={t('Na tua mesa')} action={t('Notas')} onAction={() => router.push('/players')}>
      <ListGroup>
        {known.map(({ seat, name, note }) => (
          <ListItem
            key={seat}
            left={<Avatar name={name} />}
            title={
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                <T v="h3">{name}</T>
                {note!.tags.slice(0, 3).map((x) => (
                  <Pill key={x} label={t(x)} color={C.accent} />
                ))}
              </Row>
            }
            subtitle={note!.notes || note!.look ? [note!.look, note!.notes].filter(Boolean).join(' · ') : undefined}
          />
        ))}
      </ListGroup>
    </Section>
  );
}

function mmss(ms: number) {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function clock(ms: number) {
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const sec = secs % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
