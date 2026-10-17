// The month in poker, opened from the notification on the 1st or from
// Bankroll. The recap and its story card are free (amounts hidden on the card
// by default); how it compares with earlier months and where the money came
// from are Pro.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CardShareSheet } from '@/components/CardShareSheet';
import { MonthCard } from '@/components/MonthCard';
import { SmallSample } from '@/components/SmallSample';
import { ProBlur, useLocked } from '@/components/ProGate';
import { STORY_H, STORY_W } from '@/components/StoryCard';
import { Button, Card, Chip, ChipRow, Empty, IconButton, ListGroup, Row, Section, Segmented, T, tap, ToggleItem } from '@/components/ui';
import { lang, locale, t } from '@/i18n';
import { track } from '@/lib/events';
import { canShareStory, captureStory, sharePost, shareStory } from '@/lib/instagram-story';
import { askNotificationPermission, notifications } from '@/lib/lock-screen/reminder';
import { recapHidden } from '@/lib/month-recap';
import { maybeAskForReview } from '@/lib/review';
import { shareRef } from '@/lib/referrals';
import { notice } from '@/lib/notice';
import { duration, money, shortDate } from '@/poker/format';
import { stakeKey, stakeLabel } from '@/store/bankroll-math';
import { compareMonths, defaultMonth, inMonth, monthKey, monthName, monthRecap, recapMonths, recapNotice, MIN_BB_HOURS, RECAP_HOUR, type MonthCompare, type MonthRecap } from '@/store/month-recap';
import { breakdown, playedMs } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { BRAND, C, R, S } from '@/theme';

const PREVIEW = 0.62;

export default function MonthScreen() {
  const { sessions, hands, settings, setSettings } = useStore();
  const locked = useLocked('monthCompare');
  const params = useLocalSearchParams<{ m?: string }>();
  const months = useMemo(() => recapMonths(sessions).slice(0, 12), [sessions]);
  const [key, setKey] = useState(() => (params.m && /^\d{4}-\d{2}$/.test(params.m) ? params.m : defaultMonth(sessions)));
  const hidden = !!settings.hideAmounts;
  const r = useMemo(() => (key ? monthRecap(sessions, key) : null), [sessions, key]);
  const cmp = useMemo(() => (key && r ? compareMonths(sessions, key, r.currency) : null), [sessions, key, r]);
  const [hideMoney, setHideMoney] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  // Narrow phones: the preview never runs past the screen edges.
  const { width } = useWindowDimensions();
  const preview = Math.min(PREVIEW, (width - 2 * S.gutter) / STORY_W);
  const card = useRef<React.ComponentRef<typeof View>>(null);
  const [granted, setGranted] = useState<boolean | null>(() => (notifications() ? null : false));
  useEffect(() => {
    const n = notifications();
    if (!n) return;
    n.getPermissionsAsync()
      .then((p) => setGranted(p.granted))
      .catch(() => setGranted(false));
  }, []);

  // Store-review moment B (design/pedido-avaliacao.md): on leaving, after scrolling to the end of a finished month at ≥ 0.
  const sawEnd = useRef(false);
  const goodMonth = useRef(false);
  useEffect(() => {
    goodMonth.current = !!key && !!r && r.sessions > 0 && r.profit >= 0 && key < monthKey(Date.now());
  }, [key, r]);
  useEffect(() => () => void (sawEnd.current && goodMonth.current && maybeAskForReview('month')), []);

  if (!key || !r || !cmp || !r.sessions) {
    return (
      <>
        <Stack.Screen options={{ title: t('Resumo do mês') }} />
        <View style={{ flex: 1, backgroundColor: C.bg, padding: S.gutter }}>
          <Empty icon="calendar-outline" title={t('Ainda não há um mês para ver')} body={t('Termina uma sessão e o resumo do mês aparece aqui. No dia 1 avisamos-te com o mês que passou.')} />
        </View>
      </>
    );
  }

  const fmt = (n: number) => (hidden ? '•••' : money(Math.round(n), r.currency));
  const signed = (n: number) => (hidden ? '•••' : (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(Math.round(n)), r.currency));
  const on = settings.monthRecap !== false;

  const post = async () => {
    tap('medium');
    setBusy(true);
    try {
      const ref = await shareRef().catch(() => '');
      const link = `${BRAND.webUrl}/r/${ref}?utm_source=instagram&utm_medium=story&utm_campaign=month`;
      const target = await shareStory(await captureStory(card), link);
      track('story_shared', { target: String(target), kind: 'month', money: !hideMoney });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos abrir o Instagram. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  // Text G: time and volume only; the result stays on the card if the player shows it there.
  const postText = async (to: 'x' | 'any') => {
    const ref = await shareRef().catch(() => '');
    const link = `${BRAND.webUrl}/r/${ref}?utm_source=${to === 'x' ? 'x' : 'app'}&utm_medium=post&utm_campaign=month`;
    const name = monthName(key);
    const line = t('O meu {month} ao vivo: {sessions} sessões, {hours} horas e {hands} mãos registadas.', {
      month: lang === 'en' ? name : name.toLowerCase(),
      sessions: r.sessions,
      hours: Math.round(r.hours),
      hands: hands.filter((h) => monthKey(h.createdAt) === key).length,
    });
    return `${line}\n${link}`;
  };

  const postTo = async (to: 'x' | 'any') => {
    tap('medium');
    setBusy(true);
    try {
      await sharePost([await captureStory(card)], await postText(to), to);
      track('story_shared', { target: to, kind: 'month', money: !hideMoney });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos preparar a imagem. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(await postText('any')).catch(() => {});
    notice(t('Link copiado'));
  };


  const toggle = async (v: boolean) => {
    setSettings({ monthRecap: v });
    if (v && !granted) setGranted(await askNotificationPermission());
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Resumo do mês') }} />
      <CardShareSheet visible={sheet} onClose={() => setSheet(false)} instagram={post} x={() => postTo('x')} other={() => postTo('any')} copy={copy} />
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 60 }}
        scrollEventThrottle={200}
        onScroll={({ nativeEvent: e }) => {
          if (e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 80) sawEnd.current = true;
        }}>
        {months.length > 1 ? (
          <ChipRow>
            {months.map((m) => (
              <Chip
                key={m}
                label={monthName(m, m.slice(0, 4) !== String(new Date().getFullYear()))}
                active={m === key}
                onPress={() => {
                  tap('select');
                  setKey(m);
                }}
              />
            ))}
          </ChipRow>
        ) : null}

        <Card tone="raised" style={{ gap: S.sm }}>
          <T v="label">{monthName(key, true)}</T>
          <T v="monoXL" color={r.profit >= 0 ? C.good : C.bad} numberOfLines={1} adjustsFontSizeToFit>
            {signed(r.profit)}
          </T>
          <T v="body">
            {[
              t('{h} h', { h: r.hours.toLocaleString(locale, { maximumFractionDigits: 1 }) }),
              r.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: r.sessions }),
              r.hours >= 0.25 ? t('{amount}/h', { amount: signed(r.hourly) }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </T>
          {/* BB/h is cash only, so it gets its own line next to a total that may hold tournaments. */}
          {r.cashSessions > 0 && (r.cashSessions !== r.sessions || r.bbHourly !== null) ? (
            <T v="small">
              {[
                r.cashSessions === r.sessions ? '' : t('Cash: {h} h', { h: r.cashHours.toLocaleString(locale, { maximumFractionDigits: 1 }) }),
                r.bbHourly !== null ? `${r.bbHourly > 0 ? '+' : ''}${r.bbHourly.toLocaleString(locale, { maximumFractionDigits: 1 })} BB/h` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </T>
          ) : null}
          {r.cashSessions > 0 && r.bbHourly === null ? <SmallSample n={Math.floor(r.cashHours * 10) / 10} min={MIN_BB_HOURS} variant="note" unit={t('horas de cash')} /> : null}
          {r.mtts ? <T v="small">{t('Torneios com prémio: {cashes} de {n}', { cashes: r.cashes, n: r.mtts })}</T> : null}
          {r.best ? <Line label={t('Melhor sessão')} s={r.best} value={signed(r.best.profit)} /> : null}
          {r.worst && r.worst.profit < 0 ? <Line label={t('Pior sessão')} s={r.worst} value={signed(r.worst.profit)} /> : null}
        </Card>

        <Section title={t('Partilhar o mês')} hint={t('Os valores começam escondidos: o cartão mostra horas, sessões e BB/h.')}>
          <View style={{ alignItems: 'center', gap: S.md }}>
            <View style={{ width: STORY_W * preview, height: STORY_H * preview, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: C.borderStrong }}>
              <View style={{ position: 'absolute', left: (STORY_W * preview - STORY_W) / 2, top: (STORY_H * preview - STORY_H) / 2, transform: [{ scale: preview }] }}>
                <MonthCard ref={card} r={r} hideMoney={hideMoney} />
              </View>
            </View>
            <Row gap={S.sm}>
              <IconButton
                name={hideMoney ? 'eye-off-outline' : 'eye-outline'}
                label={hideMoney ? t('Mostrar valores') : t('Esconder valores')}
                onPress={() => {
                  tap('select');
                  setHideMoney((h) => !h);
                }}
              />
              {canShareStory ? (
                <Button title={busy ? t('A preparar…') : t('Partilhar')} icon="share-outline" disabled={busy} onPress={() => setSheet(true)} />
              ) : (
                <T v="small" style={{ flex: 1 }}>
                  {t('Abre a app no telemóvel para publicar no Instagram.')}
                </T>
              )}
            </Row>
          </View>
        </Section>

        <Section title={t('Comparado com os meses anteriores')}>
          <ProBlur feature="monthCompare" locked={locked} title={t('Vê se este mês foi melhor que os outros')}>
            <Compare r={r} c={cmp} fmt={locked ? () => '•••' : fmt} signed={locked ? () => '•••' : signed} />
          </ProBlur>
        </Section>

        <Section title={t('Onde ganhaste este mês')}>
          <ProBlur feature="monthCompare" locked={locked} title={t('Vê as salas e stakes deste mês')}>
            <Where list={inMonth(sessions, key).filter((s) => s.currency === r.currency)} cur={r.currency} signed={locked ? () => '•••' : signed} />
          </ProBlur>
        </Section>

        <ListGroup>
          <ToggleItem
            icon="notifications-outline"
            title={t('Aviso no dia 1')}
            subtitle={t('No dia 1 às {hour}:00, por exemplo: «{example}»', { hour: RECAP_HOUR, example: recapNotice(r, recapHidden(settings)).title })}
            value={on}
            onChange={(v) => void toggle(v)}
          />
        </ListGroup>
        {on && granted === false ? <T v="tiny" style={{ marginTop: -S.lg }}>{t('Permite as notificações da Sweatbook nas definições do telemóvel para receberes o aviso.')}</T> : null}
      </ScrollView>
    </>
  );
}

function Line({ label, s, value }: { label: string; s: { session: Session; profit: number }; value: string }) {
  return (
    <Row style={{ alignItems: 'flex-start', marginTop: S.xs }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="label">{label}</T>
        <T v="small" numberOfLines={1}>
          {[s.session.venue || s.session.name, shortDate(s.session.startedAt), duration(playedMs(s.session))].filter(Boolean).join(' · ')}
        </T>
      </View>
      <T v="mono" color={s.profit >= 0 ? C.good : C.bad}>
        {value}
      </T>
    </Row>
  );
}

function Compare({ r, c, fmt, signed }: { r: MonthRecap; c: MonthCompare; fmt: (n: number) => string; signed: (n: number) => string }) {
  const top = Math.max(1, ...c.history.map((h) => Math.abs(h.profit)));
  const verdict =
    c.of < 2
      ? t('O primeiro mês com sessões nos últimos seis: o próximo já tem com que comparar.')
      : c.rank === 1
        ? t('O melhor mês dos últimos {n} com sessões.', { n: c.of })
        : c.rank === c.of
          ? t('O mês mais fraco dos últimos {n} com sessões.', { n: c.of })
          : t('{rank}º de {n} meses com sessões, do melhor para o pior.', { rank: c.rank, n: c.of });
  return (
    <Card style={{ gap: S.md }}>
      <T v="h3">{verdict}</T>
      <Row gap={6} style={{ alignItems: 'flex-end', height: 96 }}>
        {c.history.map((h) => {
          const me = h.key === r.key;
          const hgt = Math.max(3, (Math.abs(h.profit) / top) * 72);
          return (
            <View key={h.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ width: '70%', height: hgt, borderRadius: 4, backgroundColor: h.profit > 0 ? C.good : h.profit < 0 ? C.bad : C.surface3, opacity: me ? 1 : 0.45 }} />
              <T v="tiny" color={me ? C.text : C.muted} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {monthName(h.key).slice(0, 3)}
              </T>
            </View>
          );
        })}
      </Row>
      {c.prev ? (
        <Diff label={t('Contra {month}', { month: monthName(c.prev.key) })} rows={[[t('Resultado'), signed(r.profit - c.prev.profit), r.profit - c.prev.profit], [t('Horas'), hrs(r.hours - c.prev.hours), r.hours - c.prev.hours]]} />
      ) : null}
      {c.avg ? (
        <Diff
          label={c.avg.months === 1 ? t('Este mês / o mês anterior com sessões') : t('Este mês / média dos {n} meses anteriores', { n: c.avg.months })}
          rows={[
            [t('Resultado'), `${fmt(r.profit)} / ${fmt(c.avg.profit)}`, r.profit - c.avg.profit],
            [t('Por hora'), `${fmt(r.hourly)} / ${fmt(c.avg.hourly)}`, r.hourly - c.avg.hourly],
            [t('Horas'), `${Math.round(r.hours)} / ${Math.round(c.avg.hours)}`, 0],
          ]}
        />
      ) : null}
    </Card>
  );
}

const hrs = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))} h`;

function Diff({ label, rows }: { label: string; rows: [string, string, number][] }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="label">{label}</T>
      {rows.map(([k, v, d]) => (
        <Row key={k}>
          <T v="small" style={{ flex: 1 }}>
            {k}
          </T>
          <T v="mono" color={d > 0 ? C.good : d < 0 ? C.bad : C.text}>
            {v}
          </T>
        </Row>
      ))}
    </View>
  );
}

function Where({ list, cur, signed }: { list: Session[]; cur: string; signed: (n: number) => string }) {
  const [by, setBy] = useState<'venue' | 'stake'>('venue');
  const rows = useMemo(() => breakdown(list, by === 'venue' ? 'venue' : (s) => stakeLabel(stakeKey(s), cur), cur), [list, by, cur]);
  return (
    <Card style={{ gap: S.md }}>
      <Segmented
        size="sm"
        options={[
          { key: 'venue', label: t('Sala') },
          { key: 'stake', label: t('Stake') },
        ]}
        value={by}
        onChange={setBy}
      />
      {rows.length ? (
        rows.map((b) => (
          <Row key={b.key}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body" numberOfLines={1}>
                {b.key}
              </T>
              <T v="tiny">{[b.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: b.sessions }), t('{h} h', { h: Math.round(b.hours) })].join(' · ')}</T>
            </View>
            <T v="mono" color={b.profit >= 0 ? C.good : C.bad}>
              {signed(b.profit)}
            </T>
          </Row>
        ))
      ) : (
        <Row gap={6}>
          <Ionicons name="information-circle-outline" size={15} color={C.muted} />
          <T v="small">{t('Sem salas registadas neste mês.')}</T>
        </Row>
      )}
    </Card>
  );
}
