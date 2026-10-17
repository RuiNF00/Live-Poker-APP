// Live session: the clock, your stack, blinds, rebuys and cash-out, all in one
// screen you can update between hands. Hands recorded while a session is open
// are linked to it and keep its stack up to date.

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AmountPad } from '@/components/AmountPad';
import { Avatar } from '@/components/Avatar';
import { LineChart } from '@/components/LineChart';
import { blankSession, SessionForm } from '@/components/SessionForm';
import { BackerLiveCard } from '@/components/staking/BackerLive';
import { useNotifySoftAsk } from '@/components/NotifySoftAsk';
import { StakeFields } from '@/components/StakeFields';
import { Button, Card, Chip, ChipRow, Field, IconButton, ListGroup, ListItem, NumField, Pill, Row, Screen, Section, SheetHeader, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { LEVEL_LENGTHS, levelAfter, levelUpMessage, nextLevelAt } from '@/lib/lock-screen/live-state';
import { bbs, chips, duration, money, shortDate, timeOf } from '@/poker/format';
import { FESTIVALS, type Festival } from '@/poker/festivals';
import { STAGES } from '@/poker/types';
import { festivalName, useFestivalPlan } from '@/store/festival-plan';
import { bagDay, dayOf, isBagged, resumeDay } from '@/store/multi-day';
import { cost, isPaused, owedToBackers, playedMs, profit } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, S } from '@/theme';

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

function LevelAlarm({ s }: { s: Session }) {
  const now = useTick(1000);
  const nextAt = nextLevelAt(s, now);
  const levelDue = !!nextAt && nextAt <= now;
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
      {t('{date} · {total} desde o início · resultado atual {profit}', { date: shortDate(s.startedAt), total: duration(now - s.startedAt), profit: money(profit(s), s.currency) })}
    </T>
  );
}

function confirm(title: string, body: string, ok: () => void) {
  if (Platform.OS === 'web') ok();
  else Alert.alert(title, body, [{ text: t('Cancelar'), style: 'cancel' }, { text: t('Sim'), onPress: ok }]);
}

export default function SessionScreen() {
  const { activeSession, sessions, saveSession, settings, setSettings, bankrolls, defaultBankroll } = useStore();
  const recentNames = useMemo(() => [...new Set(sessions.map((s) => s.name).filter(Boolean))].slice(0, 8), [sessions]);
  const recentVenues = useMemo(() => [...new Set(sessions.map((s) => s.venue).filter(Boolean))].slice(0, 8), [sessions]);
  const bagged = useMemo(() => sessions.filter(isBagged), [sessions]);

  const startRef = useRef<(() => void) | null>(null);
  if (activeSession) return <Live s={activeSession} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen title={t('Sessão')} contentStyle={{ paddingBottom: 96 }}>
        <T v="small" style={{ marginTop: -S.md }}>{t('Cada mão que registares já vem com o torneio, as blinds e o teu stack.')}</T>
        <ListGroup>
          {FESTIVALS.map((f) => (
            <FestivalItem key={f.id} f={f} />
          ))}
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
        <SessionForm
          initial={{ ...blankSession(sessions[0]?.kind ?? 'mtt', defaultBankroll.currency, settings.defaultTableSize), format: sessions[0]?.format, bankrollId: defaultBankroll.id }}
          bankrolls={bankrolls}
          recentNames={recentNames}
          recentVenues={recentVenues}
          submitLabel={t('Começar agora')}
          submitRef={startRef}
          onSubmit={(s) => {
            tap('success');
            saveSession(s);
            // The next session goes to the same bankroll.
            if (s.bankrollId && s.bankrollId !== settings.bankrollId) setSettings({ bankrollId: s.bankrollId });
          }}
        />
      </Screen>
      {/* Pinned above the tab bar: the form is longer than the screen, starting should not need a scroll. */}
      <View style={styles.thumbBar}>
        <Button title={t('Começar agora')} icon="play" haptic={false} onPress={() => startRef.current?.()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function FestivalItem({ f }: { f: Festival }) {
  const plan = useFestivalPlan(f.id);
  return (
    <ListItem
      icon="calendar-outline"
      iconColor={C.accent}
      title={festivalName(f, plan)}
      subtitle={`${f.venue} · ${t('{n} torneios', { n: new Set(f.events.map((e) => e.number)).size })}`}
      chevron
      onPress={() => router.push({ pathname: '/festival', params: { id: f.id } })}
    />
  );
}

function Live({ s }: { s: Session }) {
  // A browser may refuse the wake lock; ending the session must not throw because of it.
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  const { saveSession, hands } = useStore();
  const [pad, setPad] = useState<null | 'stack' | 'cashout' | 'bag'>(null);
  const [ending, setEnding] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [finish, setFinish] = useState({ cashOut: 0, place: 0, field: 0 });
  const [moods, setMoods] = useState<string[]>([]);
  const [softAsk, askNotify] = useNotifySoftAsk();
  const paused = isPaused(s);
  const mtt = s.kind === 'mtt';
  // Memoised: hands can be thousands.
  const nHands = useMemo(() => hands.filter((h) => h.sessionId === s.id).length, [hands, s.id]);
  const save = (p: Partial<Session>) => saveSession({ ...s, ...p });
  const first = s.stackLog[0]?.stack ?? s.stack;
  const delta = s.stack - first;

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
      void askNotify({ title: t('Avisamos-te quando o nível sobe'), preview: levelUpMessage(s) });
    }
    save({ levelMinutes, levelStartedAt: undefined });
  };
  const togglePause = () => {
    tap();
    const now = Date.now();
    if (paused) save({ breaks: s.breaks.map((b, i) => (i === s.breaks.length - 1 ? { ...b, end: now } : b)) });
    else save({ breaks: [...s.breaks, { start: now }] });
  };

  const rebuy = () => confirm(t('Mais uma entrada?'), `${money(s.buyIn, s.currency)}`, () => save({ entries: s.entries + 1 }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {softAsk}
      <Screen title={s.name || t('Sessão')} eyebrow={(mtt ? t('Torneio') : 'Cash') + (s.day ? ' · ' + t('Dia {n}', { n: s.day }) : '') + (s.venue ? ' · ' + s.venue : '')} contentStyle={{ gap: S.lg, paddingBottom: 112 }}>
        <Card tone="raised" style={{ alignItems: 'center', gap: S.md, paddingVertical: S.xl }}>
          <Pill label={paused ? t('Em pausa') : t('A jogar')} color={paused ? C.warn : C.good} icon={paused ? 'pause' : 'ellipse'} />
          <PlayClock s={s} paused={paused} />
          <T v="small">{t('Começou às {time} · {n}', { time: timeOf(s.startedAt), n: nHands === 1 ? t('1 mão') : t('{n} mãos', { n: nHands }) })}</T>
        </Card>

        <Row gap={S.sm} style={{ alignItems: 'stretch' }}>
          <Card onPress={() => setPad('stack')} style={{ flex: 1, gap: 4 }} accessibilityLabel={t('Atualizar stack')}>
            <Row>
              <T v="label" style={{ flex: 1 }}>
                Stack
              </T>
              <Ionicons name="pencil" size={13} color={C.accent} />
            </Row>
            <T v="monoL">{chips(s.stack)}</T>
            <Row gap={6}>
              <T v="monoS">{bbs(s.stack, s.bb)}</T>
              {delta ? (
                <T v="monoS" color={delta > 0 ? C.good : C.bad}>
                  {(delta > 0 ? '+' : '') + chips(delta)}
                </T>
              ) : null}
            </Row>
          </Card>
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
              <LevelAlarm s={s} />
            </Pressable>
          </Card>
        </Row>

        {s.stackLog.length > 1 && (
          <Section title={t('Stack ao longo da sessão')}>
            <Card style={{ paddingHorizontal: S.md }}>
              <LineChart values={s.stackLog.map((x) => x.stack)} height={120} zeroLine={false} />
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
            <ListItem icon="wallet-outline" title={t('Investido')} value={money(cost(s), s.currency)} />
            <ListItem
              icon="add-circle-outline"
              iconColor={C.accent}
              title={mtt ? 'Re-entry' : 'Rebuy'}
              subtitle={money(s.buyIn, s.currency)}
              onPress={rebuy}
            />
            {mtt ? <ListItem icon="layers-outline" iconColor={C.accent} title="Add-on" subtitle={money(s.buyIn, s.currency)} onPress={() => confirm('Add-on?', `${money(s.buyIn, s.currency)}`, () => save({ addOn: (s.addOn || 0) + s.buyIn }))} /> : null}
            {mtt ? <ListItem icon="pie-chart-outline" iconColor={C.info} title={t('Calculadora de deal (ICM)')} onPress={() => router.push('/chop')} /> : null}
          </ListGroup>
        </Section>

        <Section title="Staking" action={t('Backers')} onAction={() => router.push('/staking')}>
          <BackerLiveCard s={s} />
          <StakeFields s={s} onChange={save} expenses={false} />
        </Section>

        {!ending ? (
          <View style={{ gap: S.sm }}>
            {mtt ? <Button title={t('Ensacar fichas (fim do dia {n})', { n: dayOf(s) })} kind="secondary" size="md" icon="bag-handle-outline" onPress={() => setPad('bag')} /> : null}
            <Button title={t('Terminar sessão')} kind="danger" size="md" icon="flag-outline" onPress={() => setEnding(true)} />
          </View>
        ) : (
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
              <StakeFields s={s} onChange={save} />
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
                    router.push({ pathname: '/summary/[id]', params: { id: s.id } });
                  }}
                />
              </Row>
            </Card>
          </Section>
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
          onClose={() => setPad(null)}
          onDone={(v) => {
            setPad(null);
            save({ stack: v, stackLog: [...s.stackLog, { t: Date.now(), stack: v, level: s.level }] });
          }}
        />
        <SinceStart s={s} />
      </Screen>
      {/* Everything you do between hands, within reach of the thumb. */}
      <View style={styles.thumbBar}>
        <ThumbAction icon={paused ? 'play' : 'pause'} label={paused ? t('Retomar') : t('Pausa')} onPress={togglePause} active={paused} />
        <ThumbAction icon="add-circle-outline" label={mtt ? 'Re-entry' : 'Rebuy'} onPress={rebuy} />
        <ThumbAction icon={s.notes ? 'document-text' : 'document-text-outline'} label={t('Nota')} onPress={() => setNoteOpen(true)} />
        <Button size="md" style={{ flex: 1.6 }} title={t('Nova mão')} icon="add" onPress={() => router.push('/hand/new')} />
      </View>
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
      <T v="tiny" numberOfLines={1} maxFontSizeMultiplier={1.2} color={active ? C.warn : C.textDim}>
        {label}
      </T>
    </Pressable>
  );
}

/** A free note on the session: table dynamics, how you felt, anything to remember. */
function NoteSheet({ visible, value, onClose, onSave }: { visible: boolean; value: string; onClose: () => void; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [shownFor, setShownFor] = useState(visible);
  // Start from the saved note each time the sheet opens.
  if (visible !== shownFor) {
    setShownFor(visible);
    if (visible) setText(value);
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: S.xxl, gap: S.md }}>
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
