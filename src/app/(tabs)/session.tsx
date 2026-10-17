// Live session: the clock, your stack, blinds, rebuys and cash-out, all in one
// screen you can update between hands. Hands recorded while a session is open
// are linked to it and keep its stack up to date.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountPad } from '@/components/AmountPad';
import { NumField } from '@/components/entry/ContextSheet';
import { LineChart } from '@/components/LineChart';
import { blankSession, SessionForm } from '@/components/SessionForm';
import { StakeFields } from '@/components/StakeFields';
import { Button, Chip, Panel, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { CASH_LEVELS, MTT_LEVELS } from '@/poker/factory';
import { bbs, chips, duration, money, shortDate } from '@/poker/format';
import { STAGES } from '@/poker/types';
import { cost, isPaused, owedToBackers, playedMs, profit } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, ff } from '@/theme';

function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function confirm(title: string, body: string, ok: () => void) {
  if (Platform.OS === 'web') ok();
  else Alert.alert(title, body, [{ text: t('Cancelar'), style: 'cancel' }, { text: t('Sim'), onPress: ok }]);
}

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const { activeSession, sessions, saveSession, settings } = useStore();
  const recentNames = useMemo(() => [...new Set(sessions.map((s) => s.name).filter(Boolean))].slice(0, 8), [sessions]);
  const recentVenues = useMemo(() => [...new Set(sessions.map((s) => s.venue).filter(Boolean))].slice(0, 8), [sessions]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, padding: 14, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <T v="title">{t('Sessão')}</T>
      {activeSession ? (
        <Live s={activeSession} />
      ) : (
        <Panel style={{ gap: 12 }}>
          <T v="h2">{t('Começar sessão')}</T>
          <T v="small">{t('O relógio conta o tempo à mesa, o stack fica guardado e cada mão que registares já vem com torneio, blinds e stack preenchidos.')}</T>
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
        </Panel>
      )}
    </ScrollView>
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
    <View style={{ gap: 12 }}>
      <Panel style={{ gap: 6, alignItems: 'center', paddingVertical: 22 }}>
        <T v="label">{(mtt ? t('Torneio') : 'Cash') + (s.venue ? ' · ' + s.venue : '')}</T>
        <T v="h1" numberOfLines={1}>
          {s.name || t('Sessão')}
        </T>
        <T style={{ fontSize: 44, fontWeight: '800', fontFamily: ff(800), color: paused ? C.warn : C.text, fontVariant: ['tabular-nums'] }}>{clock(playedMs(s))}</T>
        <Row gap={8}>
          <Button small kind="secondary" title={paused ? t('Retomar') : t('Pausa')} onPress={togglePause} icon={<Ionicons name={paused ? 'play' : 'pause'} size={14} color={C.text} />} />
          <Button small kind="secondary" title={nHands === 1 ? t('1 mão') : t('{n} mãos', { n: nHands })} onPress={() => router.push('/')} />
        </Row>
      </Panel>

      <Row gap={10}>
        <Pressable style={{ flex: 1 }} onPress={() => setPad('stack')}>
          <Panel style={{ gap: 2 }}>
            <T v="label">Stack</T>
            <T v="h1">{chips(s.stack)}</T>
            <T v="small">{bbs(s.stack, s.bb)} · {t('toca para atualizar')}</T>
          </Panel>
        </Pressable>
        <Panel style={{ flex: 1, gap: 2 }}>
          <T v="label">Blinds{s.level ? ' · ' + t('nível {n}', { n: s.level }) : ''}</T>
          <T v="h1">
            {chips(s.sb)}/{chips(s.bb)}
          </T>
          <Row gap={6}>
            <Chip label="−" onPress={() => bumpLevel(-1)} />
            <Chip label={t('Subir nível')} onPress={() => bumpLevel(1)} />
          </Row>
        </Panel>
      </Row>

      {s.stackLog.length > 1 && (
        <Panel style={{ gap: 6 }}>
          <T v="label">{t('Stack ao longo da sessão')}</T>
          <LineChart values={s.stackLog.map((x) => x.stack)} height={110} zeroLine={false} />
        </Panel>
      )}

      <TableReads roster={s.roster} />

      {mtt && (
        <Panel style={{ gap: 8 }}>
          <T v="label">{t('Fase')}</T>
          <Row style={{ flexWrap: 'wrap' }} gap={6}>
            {STAGES.map((st) => (
              <Chip key={st.id} label={st.label} active={s.stage === st.id} onPress={() => save({ stage: st.id })} />
            ))}
          </Row>
        </Panel>
      )}

      <Panel style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="label">{t('Investido')}</T>
          <T v="mono">{money(cost(s), s.currency)}</T>
        </Row>
        <Row gap={8}>
          <Button small kind="secondary" style={{ flex: 1 }} title={mtt ? '+ Re-entry' : '+ Rebuy'} onPress={() => confirm(t('Mais uma entrada?'), `${money(s.buyIn, s.currency)}`, () => save({ entries: s.entries + 1 }))} />
          {mtt ? <Button small kind="secondary" style={{ flex: 1 }} title="+ Add-on" onPress={() => confirm('Add-on?', `${money(s.buyIn, s.currency)}`, () => save({ addOn: (s.addOn || 0) + s.buyIn }))} /> : null}
        </Row>
        {mtt ? <Button small kind="ghost" title={t('Calculadora de deal (ICM)')} onPress={() => router.push('/chop')} /> : null}
      </Panel>

      {!ending ? (
        <Button title={t('Terminar sessão')} kind="danger" onPress={() => setEnding(true)} />
      ) : (
        <Panel style={{ gap: 10 }}>
          <T v="h2">{t('Terminar sessão')}</T>
          <Row gap={10}>
            <NumField label={mtt ? t('Prémio ({currency})', { currency: s.currency }) : `Cash-out (${s.currency})`} value={finish.cashOut} onChange={(cashOut) => setFinish((f) => ({ ...f, cashOut }))} />
            {mtt ? <NumField label={t('Lugar')} value={finish.place} onChange={(place) => setFinish((f) => ({ ...f, place }))} /> : null}
            {mtt ? <NumField label={t('Inscritos')} value={finish.field} onChange={(field) => setFinish((f) => ({ ...f, field }))} /> : null}
          </Row>
          <StakeFields s={s} onChange={save} />
          {(() => {
            const end = { ...s, cashOut: finish.cashOut };
            const owed = owedToBackers(end);
            return (
              <>
                {owed > 0 ? (
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="small">{t('A pagar aos backers')}</T>
                    <T v="mono">{money(owed, s.currency)}</T>
                  </Row>
                ) : null}
                <Row style={{ justifyContent: 'space-between' }}>
                  <T v="small">{s.staking?.sold || s.expenses ? t('O teu resultado') : t('Resultado')}</T>
                  <T v="mono" color={profit(end) >= 0 ? C.good : C.bad}>
                    {money(profit(end), s.currency)}
                  </T>
                </Row>
              </>
            );
          })()}
          <Row gap={8}>
            <Button kind="ghost" title={t('Voltar')} style={{ flex: 1 }} onPress={() => setEnding(false)} />
            <Button
              title={t('Guardar')}
              style={{ flex: 1 }}
              onPress={() => {
                tap('medium');
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
        </Panel>
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
        {t('Começou {date} · {total} no total · lucro atual {profit}', { date: shortDate(s.startedAt), total: duration(Date.now() - s.startedAt), profit: money(profit(s), s.currency) })}
      </T>
    </View>
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
    <Panel style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label">{t('Na tua mesa')}</T>
        <Pressable onPress={() => router.push('/players')} hitSlop={8}>
          <T v="tiny" color={C.accent}>
            {t('Notas')}
          </T>
        </Pressable>
      </Row>
      {known.map(({ seat, name, note }) => (
        <View key={seat} style={{ gap: 1 }}>
          <T v="body" style={{ fontWeight: '700', fontFamily: ff(700) }}>
            {name}
            {note!.tags.length ? <T v="small" color={C.accent}>{'  ' + note!.tags.map((x) => t(x)).join(' · ')}</T> : null}
          </T>
          {note!.notes || note!.look ? (
            <T v="small" numberOfLines={2}>
              {[note!.look, note!.notes].filter(Boolean).join(' — ')}
            </T>
          ) : null}
        </View>
      ))}
    </Panel>
  );
}

function clock(ms: number) {
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const sec = secs % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
