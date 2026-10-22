// Right after a session ends: the few numbers worth remembering, before the bankroll.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { softAskState, useNotifySoftAsk } from '@/components/NotifySoftAsk';
import { NextPlayCard } from '@/components/NextPlayCard';
import { CardRow } from '@/components/PlayingCard';
import { SessionEndPro } from '@/components/SessionEndPro';
import { Banner, Button, Card, Empty, Pill, Row, Screen, T, ToggleItem } from '@/components/ui';
import { weekNotice } from '@/billing/nudges';
import { t } from '@/i18n';
import { askOnSummary, kindOn } from '@/lib/notify-policy';
import { comboLabel } from '@/poker/cards';
import { isComplete, replay } from '@/poker/engine';
import { bbs, duration, money, plus } from '@/poker/format';
import { reviewQueue } from '@/poker/review';
import type { Hand } from '@/poker/types';
import { unfinished } from '@/poker/unfinished';
import { playedMs, profit } from '@/store/session-math';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

/** Biggest pot of the session in big blinds, and the hand where hero won or lost most. */
function standouts(hands: Hand[]) {
  let biggest: { hand: Hand; bb: number } | null = null;
  let best: { hand: Hand; net: number } | null = null;
  for (const h of hands) {
    const r = replay(h).result;
    if (!r || !h.game.bb) continue;
    const pot = r.pots.reduce((a, p) => a + p.amount, 0) / h.game.bb;
    if (!biggest || pot > biggest.bb) biggest = { hand: h, bb: pot };
    const net = r.resolved ? r.net[h.hero] : 0;
    if (net && (!best || Math.abs(net) > Math.abs(best.net))) best = { hand: h, net };
  }
  return { biggest, best };
}

/** Times the summary asked for notifications (lib/notify-policy askOnSummary). */
const ASKS_KEY = 'rl.notify.summary-asks.v1';

export default function SessionSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, hands, settings } = useStore();
  const s = sessions.find((x) => x.id === id);
  const [softAsk, askNotify] = useNotifySoftAsk();
  const mine = useMemo(() => hands.filter((h) => h.sessionId === id), [hands, id]);
  const { biggest, best } = useMemo(() => standouts(mine), [mine]);
  const left = useMemo(() => unfinished(mine), [mine]);
  // Marked at the table ("Rever"): still fresh, the moment to look at them again.
  const toReview = useMemo(() => reviewQueue(mine), [mine]);
  // Off when screenshotting at the table: no money on screen.
  const [hideMoney, setHideMoney] = useState(false);

  // Right after a session, with the result seen: the moment the Sunday notice makes sense.
  const endedAt = s?.endedAt;
  useEffect(() => {
    if (!endedAt) return;
    let off = false;
    const timer = setTimeout(async () => {
      const asks = Number(await AsyncStorage.getItem(ASKS_KEY).catch(() => null)) || 0;
      const closed = sessions.filter((x) => x.endedAt).length;
      if (off || !askOnSummary({ closed, asks, weekOn: kindOn(settings, 'week'), endedAt, now: Date.now() })) return;
      if ((await softAskState()) !== 'ask' || off) return;
      AsyncStorage.setItem(ASKS_KEY, String(asks + 1)).catch(() => {});
      const week = weekNotice({ now: Date.now(), hands, sessions });
      void askNotify({
        where: 'week',
        title: t('Ao domingo, a tua semana'),
        body: t('Dizemos-te o que registaste nessa semana e quantas mãos tens para rever. Sem valores e sem publicidade. Cada aviso desliga-se nas Definições da Sweatbook.'),
        // Sunday afternoon there is no notice left this week: the same notice, for this session.
        preview: week ?? { title: t('A tua semana no póquer'), body: `${t('{a} esta semana.', { a: t('1 sessão') })} ${t('Toca para veres as tuas mãos.')}` },
      });
    }, 1200);
    return () => {
      off = true;
      clearTimeout(timer);
    };
    // Once per summary: the store changing under it (a hand reviewed) doesn't ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endedAt]);

  if (!s) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('Resumo da sessão') }} />
        <Empty icon="flag-outline" title={t('Sessão não encontrada')} />
      </Screen>
    );
  }
  const p = profit(s);
  const col = p > 0 ? C.good : p < 0 ? C.bad : C.text;
  return (
    <Screen contentStyle={{ gap: S.lg }}>
      <Stack.Screen options={{ title: t('Resumo da sessão') }} />
      {softAsk}
      <Card tone="raised" style={{ alignItems: 'center', gap: S.sm, paddingVertical: S.xl }}>
        <T v="label">{s.name || t('Sessão')}</T>
        <T v="monoXL" color={hideMoney ? C.text : col} accessibilityLabel={hideMoney ? t('Resultado escondido') : undefined}>
          {hideMoney ? '•••' : plus(p) + money(p, s.currency)}
        </T>
        <T v="small">{[s.venue, s.finish ? t('{place}.º de {field}', { place: s.finish, field: s.field || '?' }) : ''].filter(Boolean).join(' · ') || ' '}</T>
        {s.tags?.length ? (
          <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: S.xs }}>
            {s.tags.map((tg) => (
              <Pill key={tg} label={t(tg)} />
            ))}
          </Row>
        ) : null}
      </Card>

      <Row gap={S.sm} style={{ alignItems: 'stretch' }}>
        <Tile label={t('Horas')} value={duration(playedMs(s))} />
        <Tile label={s.handsDealt ? t('Mãos jogadas') : t('Mãos guardadas')} value={String(s.handsDealt ?? mine.length)} />
        <Tile label={t('Maior pote')} value={biggest ? bbs(biggest.bb, 1) : '—'} />
      </Row>

      <SessionEndPro sessionId={s.id} profit={p} hours={playedMs(s) / 3_600_000} game={s.kind} currency={s.currency} hideMoney={hideMoney} />

      {best ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/hand/[id]', params: { id: best.hand.id } })}>
          {({ pressed }) => (
            <Card style={{ gap: S.sm, opacity: pressed ? 0.8 : 1 }}>
              <T v="label">{t('A mão da sessão')}</T>
              <Row gap={S.md}>
                {best.hand.players[best.hand.hero].cards?.length === 2 ? <CardRow cards={best.hand.players[best.hand.hero].cards!} size="sm" /> : null}
                <View style={{ flex: 1 }}>
                  <T v="h3">{comboLabel(best.hand.players[best.hand.hero].cards)}</T>
                  <T v="small">{t('Rever no replayer')}</T>
                </View>
                {!hideMoney ? (
                  <T v="mono" color={best.net > 0 ? C.good : C.bad}>
                    {(best.net > 0 ? '+' : '') + bbs(best.net, best.hand.game.bb)}
                  </T>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={C.muted} />
              </Row>
            </Card>
          )}
        </Pressable>
      ) : null}

      {/* Hands saved with "Guardar já": one tap opens the oldest where it stopped. */}
      {left.length > 0 ? (
        <Banner
          tone="warn"
          icon="create-outline"
          title={left.length === 1 ? t('1 mão por completar') : t('{n} mãos por completar', { n: left.length })}
          action={t('Acabar')}
          onPress={() => router.push({ pathname: '/hand/new', params: { edit: left[0].id } })}
        />
      ) : null}

      {toReview.length > 0 ? (
        <Banner
          icon="school-outline"
          title={toReview.length === 1 ? t('Marcaste 1 mão. Rever agora?') : t('Marcaste {n} mãos. Rever agora?', { n: toReview.length })}
          body={t('Enquanto ainda te lembras de tudo. As que ficarem esperam em «Por rever».')}
          action={t('Rever')}
          onPress={() => router.push({ pathname: '/hand/[id]', params: { id: toReview[0].id, q: s.id } })}
        />
      ) : null}

      {/* Only for the session that just ended, and only when reminders are on. */}
      {s.endedAt && Date.now() - s.endedAt < 12 * 3_600_000 && kindOn(settings, 'tips') && !sessions.some((x) => x.startedAt > s.startedAt) ? <NextPlayCard sessions={sessions} ask={askNotify} /> : null}

      <Card padded={false}>
        <ToggleItem icon="eye-off-outline" title={t('Esconder valores')} subtitle={t('Para mostrar ou tirar print sem dinheiro à vista')} value={hideMoney} onChange={setHideMoney} />
      </Card>

      <View style={{ gap: S.sm }}>
        <Button title={t('Partilhar sessão')} icon="share-social" onPress={() => router.push(`/session-card/${id}`)} />
        {mine.filter((h) => isComplete(h)).length >= 2 ? (
          <Button kind="secondary" title={t('Partilhar as mãos num só link')} icon="albums-outline" onPress={() => router.push({ pathname: '/pack/new', params: { session: id } })} />
        ) : null}
        <Button kind="ghost" title={t('Ver no bankroll')} icon="stats-chart" onPress={() => router.replace('/bankroll')} />
        <Button kind="ghost" title={t('Fechar')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </Screen>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, gap: 4 }}>
      <T v="label">{label}</T>
      <T v="mono" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
    </Card>
  );
}
