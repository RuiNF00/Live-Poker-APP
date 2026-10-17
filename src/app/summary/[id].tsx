// Right after a session ends: the few numbers worth remembering, before the bankroll.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CardRow } from '@/components/PlayingCard';
import { SessionEndPro } from '@/components/SessionEndPro';
import { Banner, Button, Card, Empty, Pill, Row, Screen, T, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { isComplete, replay } from '@/poker/engine';
import { bbs, duration, money } from '@/poker/format';
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

export default function SessionSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, hands } = useStore();
  const s = sessions.find((x) => x.id === id);
  const mine = useMemo(() => hands.filter((h) => h.sessionId === id), [hands, id]);
  const { biggest, best } = useMemo(() => standouts(mine), [mine]);
  const left = useMemo(() => unfinished(mine), [mine]);
  // Off when screenshotting at the table: no money on screen.
  const [hideMoney, setHideMoney] = useState(false);

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
      <Card tone="raised" style={{ alignItems: 'center', gap: S.sm, paddingVertical: S.xl }}>
        <T v="label">{s.name || t('Sessão')}</T>
        <T v="monoXL" color={hideMoney ? C.text : col} accessibilityLabel={hideMoney ? t('Resultado escondido') : undefined}>
          {hideMoney ? '•••' : (p > 0 ? '+' : '') + money(p, s.currency)}
        </T>
        <T v="small">{[s.venue, s.finish ? t('{place}º de {field}', { place: s.finish, field: s.field || '?' }) : ''].filter(Boolean).join(' · ') || ' '}</T>
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
