// Live session: the clock, your stack, blinds, rebuys and cash-out, all in one
// screen you can update between hands. Hands recorded while a session is open
// are linked to it and keep its stack up to date.

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { AmountPad } from '@/components/AmountPad';
import { Avatar } from '@/components/Avatar';
import { LineChart } from '@/components/LineChart';
import { blankSession, SessionForm } from '@/components/SessionForm';
import { StakeFields } from '@/components/StakeFields';
import { Button, Card, Chip, ChipRow, IconButton, ListGroup, ListItem, NumField, Pill, Row, Screen, Section, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { CASH_LEVELS, MTT_LEVELS } from '@/poker/factory';
import { bbs, chips, duration, money, shortDate, timeOf } from '@/poker/format';
import { STAGES } from '@/poker/types';
import { cost, isPaused, owedToBackers, playedMs, profit } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, S } from '@/theme';

/**
 * Re-renders every `ms` while this tab is on screen. Tabs stay mounted, so an
 * always-on interval kept redrawing the whole session screen every second
 * behind hand entry and the hands list.
 */
function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setT((x) => x + 1);
      const id = setInterval(() => setT((x) => x + 1), ms);
      return () => clearInterval(id);
    }, [ms]),
  );
}

function confirm(title: string, body: string, ok: () => void) {
  if (Platform.OS === 'web') ok();
  else Alert.alert(title, body, [{ text: t('Cancelar'), style: 'cancel' }, { text: t('Sim'), onPress: ok }]);
}

export default function SessionScreen() {
  const { activeSession, sessions, saveSession, settings } = useStore();
  const recentNames = useMemo(() => [...new Set(sessions.map((s) => s.name).filter(Boolean))].slice(0, 8), [sessions]);
  const recentVenues = useMemo(() => [...new Set(sessions.map((s) => s.venue).filter(Boolean))].slice(0, 8), [sessions]);

  if (activeSession) return <Live s={activeSession} />;
  return (
    <Screen title={t('Sessão')}>
      <T v="small" style={{ marginTop: -S.md }}>{t('Cada mão que registares já vem com o torneio, as blinds e o teu stack.')}</T>
      <SessionForm
        initial={blankSession(sessions[0]?.kind ?? 'mtt', settings.currency, settings.defaultTableSize)}
        recentNames={recentNames}
        recentVenues={recentVenues}
        submitLabel={t('Começar agora')}
        onSubmit={(s) => {
          tap('medium');
          saveSession(s);
        }}
      />
    </Screen>
  );
}

function Live({ s }: { s: Session }) {
  useKeepAwake();
  useTick(1000);
  const { saveSession, hands } = useStore();
  const [pad, setPad] = useState<null | 'stack' | 'cashout'>(null);
  const [ending, setEnding] = useState(false);
  const [finish, setFinish] = useState({ cashOut: 0, place: 0, field: 0 });
  const paused = isPaused(s);
  const mtt = s.kind === 'mtt';
  const levels = mtt ? MTT_LEVELS : CASH_LEVELS;
  // Memoised: this screen re-renders every second (clock) and hands can be thousands.
  const nHands = useMemo(() => hands.filter((h) => h.sessionId === s.id).length, [hands, s.id]);
  const save = (p: Partial<Session>) => saveSession({ ...s, ...p });
  const first = s.stackLog[0]?.stack ?? s.stack;
  const delta = s.stack - first;

  const bumpLevel = (dir: 1 | -1) => {
    tap();
    const i = levels.findIndex(([sb, bb]) => sb === s.sb && bb === s.bb);
    const j = Math.max(0, Math.min(levels.length - 1, (i < 0 ? 0 : i) + dir));
    const [sb, bb] = levels[j];
    save({ sb, bb, ante: s.anteType === 'bb' ? bb : s.anteType === 'all' ? Math.round(bb / 8) : 0, level: (s.level ?? 1) + dir > 0 ? (s.level ?? 1) + dir : 1 });
  };
  const togglePause = () => {
    tap();
    const now = Date.now();
    if (paused) save({ breaks: s.breaks.map((b, i) => (i === s.breaks.length - 1 ? { ...b, end: now } : b)) });
    else save({ breaks: [...s.breaks, { start: now }] });
  };

  return (
    <Screen title={s.name || t('Sessão')} eyebrow={(mtt ? t('Torneio') : 'Cash') + (s.venue ? ' · ' + s.venue : '')} contentStyle={{ gap: S.lg }}>
      <Card tone="raised" style={{ alignItems: 'center', gap: S.md, paddingVertical: S.xl }}>
        <Pill label={paused ? t('Em pausa') : t('A jogar')} color={paused ? C.warn : C.good} icon={paused ? 'pause' : 'ellipse'} />
        <T v="monoXL" style={{ fontSize: 52, lineHeight: 58 }} color={paused ? C.warn : C.text}>
          {clock(playedMs(s))}
        </T>
        <T v="small">{t('Começou às {time} · {n}', { time: timeOf(s.startedAt), n: nHands === 1 ? t('1 mão') : t('{n} mãos', { n: nHands }) })}</T>
        <Row gap={S.sm} style={{ alignSelf: 'stretch', marginTop: S.xs }}>
          <Button size="md" kind="secondary" style={{ flex: 1 }} title={paused ? t('Retomar') : t('Pausa')} icon={paused ? 'play' : 'pause'} onPress={togglePause} />
          <Button size="md" style={{ flex: 1 }} title={t('Nova mão')} icon="add" onPress={() => router.push('/hand/new')} />
        </Row>
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
            onPress={() => confirm(t('Mais uma entrada?'), `${money(s.buyIn, s.currency)}`, () => save({ entries: s.entries + 1 }))}
          />
          {mtt ? <ListItem icon="layers-outline" iconColor={C.accent} title="Add-on" subtitle={money(s.buyIn, s.currency)} onPress={() => confirm('Add-on?', `${money(s.buyIn, s.currency)}`, () => save({ addOn: (s.addOn || 0) + s.buyIn }))} /> : null}
          {mtt ? <ListItem icon="pie-chart-outline" iconColor={C.info} title={t('Calculadora de deal (ICM)')} onPress={() => router.push('/chop')} /> : null}
        </ListGroup>
      </Section>

      {!ending ? (
        <Button title={t('Terminar sessão')} kind="danger" size="md" icon="flag-outline" onPress={() => setEnding(true)} />
      ) : (
        <Section title={t('Terminar sessão')}>
          <Card style={{ gap: S.md }}>
            <Row gap={S.sm}>
              <NumField label={mtt ? t('Prémio ({currency})', { currency: s.currency }) : `Cash-out (${s.currency})`} value={finish.cashOut} onChange={(cashOut) => setFinish((f) => ({ ...f, cashOut }))} />
              {mtt ? <NumField label={t('Lugar')} value={finish.place} onChange={(place) => setFinish((f) => ({ ...f, place }))} /> : null}
              {mtt ? <NumField label={t('Inscritos')} value={finish.field} onChange={(field) => setFinish((f) => ({ ...f, field }))} /> : null}
            </Row>
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
                    <T v="h3">{s.staking?.sold || s.expenses ? t('O teu resultado') : t('Resultado')}</T>
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
                onPress={() => {
                  const now = Date.now();
                  saveSession({
                    ...s,
                    cashOut: finish.cashOut,
                    finish: finish.place || undefined,
                    field: finish.field || undefined,
                    endedAt: now,
                    breaks: s.breaks.map((b) => (b.end ? b : { ...b, end: now })),
                  });
                  router.push('/bankroll');
                }}
              />
            </Row>
          </Card>
        </Section>
      )}

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
      <T v="tiny" style={{ textAlign: 'center' }}>
        {t('{date} · {total} desde o início · resultado atual {profit}', { date: shortDate(s.startedAt), total: duration(Date.now() - s.startedAt), profit: money(profit(s), s.currency) })}
      </T>
    </Screen>
  );
}

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

function clock(ms: number) {
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const sec = secs % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
