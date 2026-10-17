// Links sent to a coach: which are open, which hands got comments, and the off switch.

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, Share, View } from 'react-native';

import { CardRow } from '@/components/PlayingCard';
import { Badge, Button, Card, Empty, ListGroup, ListItem, Pill, Row, T, tap } from '@/components/ui';
import { locale, t } from '@/i18n';
import { linkStatus, unreadByHand, type CoachLink, type CoachState } from '@/lib/coach-core';
import { revokeCoachLink, syncCoach, useCoach } from '@/lib/coach-api';
import { comboLabel } from '@/poker/cards';
import type { Hand } from '@/poker/types';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

function confirm(title: string, body: string, yes: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${body}`));
  return new Promise((r) =>
    Alert.alert(title, body, [
      { text: t('Cancelar'), style: 'cancel', onPress: () => r(false) },
      { text: yes, style: 'destructive', onPress: () => r(true) },
    ]),
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

export default function CoachLinks() {
  const coach = useCoach();
  const { hands } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    syncCoach().catch(() => {});
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await syncCoach().catch(() => 0);
    setRefreshing(false);
  };

  if (!coach.links.length)
    return (
      <Empty
        icon="school-outline"
        title={t('Ainda sem links para o coach')}
        body={t('Seleciona mãos na lista (toque longo) ou abre uma pasta e toca em Enviar ao coach.')}
        action={<Button title={t('Ir para as mãos')} kind="secondary" size="md" onPress={() => router.navigate('/')} />}
      />
    );

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{ padding: S.md, gap: S.lg, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.accent} />}>
      {coach.links.map((l) => (
        <LinkCard key={l.token} link={l} coach={coach} hands={hands} />
      ))}
      <T v="tiny" style={{ textAlign: 'center', paddingHorizontal: S.lg }}>
        {t('Os comentários chegam sozinhos. Puxa para baixo para ver já.')}
      </T>
    </ScrollView>
  );
}

function LinkCard({ link, coach, hands }: { link: CoachLink; coach: CoachState; hands: Hand[] }) {
  const status = linkStatus(link);
  const comments = coach.comments[link.token] ?? [];
  const unread = unreadByHand({ ...coach, comments: { [link.token]: comments } });
  const byHand = new Map<string, number>();
  for (const c of comments) if (c.author === 'coach') byHand.set(c.handId, (byHand.get(c.handId) ?? 0) + 1);
  const list = link.handIds.map((id) => hands.find((h) => h.id === id)).filter((h): h is Hand => !!h);
  const commented = list.filter((h) => byHand.has(h.id));
  const fresh = Object.values(unread).reduce((a, b) => a + b, 0);

  const share = async () => {
    tap();
    const msg = t('Podes rever estas {n} mãos? Comenta no próprio replay, sem criar conta: {url}', { n: link.handIds.length, url: link.url });
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(msg);
      Alert.alert(t('Link copiado'));
    } else await Share.share({ message: msg }).catch(() => {});
  };
  const revoke = async () => {
    if (await confirm(t('Desligar o link?'), t('O coach deixa de abrir as mãos. Os comentários que já fez ficam aqui.'), t('Desligar'))) revokeCoachLink(link.token);
  };

  const statusText =
    status === 'revoked' ? t('Desligado') : status === 'expired' ? t('Expirou') : link.expiresAt ? t('Ativo até {d}', { d: day(link.expiresAt) }) : t('Ativo, sem prazo');

  return (
    <View style={{ gap: S.sm }}>
      <Card style={{ gap: S.md }}>
        <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="h3" numberOfLines={2}>
              {link.title}
            </T>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <Pill icon={status === 'live' ? 'lock-closed' : 'close-circle'} label={statusText} color={status === 'live' ? C.good : C.muted} />
              <T v="tiny">
                {link.handIds.length === 1 ? t('1 mão') : t('{n} mãos', { n: link.handIds.length })} · {t('enviado a {d}', { d: day(link.createdAt) })}
              </T>
            </Row>
          </View>
          {fresh ? <Badge label={fresh === 1 ? t('1 novo') : t('{n} novos', { n: fresh })} /> : null}
        </Row>
        {status === 'live' ? (
          <Row gap={S.sm}>
            <Button size="sm" kind="secondary" icon="share-outline" title={t('Enviar outra vez')} onPress={share} style={{ flex: 1 }} />
            <Button size="sm" kind="plain" title={t('Desligar')} onPress={revoke} />
          </Row>
        ) : null}
      </Card>
      {commented.length ? (
        <ListGroup>
          {commented.map((h) => (
            <ListItem
              key={h.id}
              left={h.players[h.hero].cards?.length === 2 ? <CardRow cards={h.players[h.hero].cards!} size="xs" gap={1} /> : <Ionicons name="albums-outline" size={18} color={C.muted} />}
              title={comboLabel(h.players[h.hero].cards) || h.game.name || t('Mão')}
              subtitle={byHand.get(h.id) === 1 ? t('1 comentário') : t('{n} comentários', { n: byHand.get(h.id) ?? 0 })}
              right={unread[h.id] ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent }} accessibilityLabel={t('Por ler')} /> : null}
              onPress={() => router.push({ pathname: '/hand/[id]', params: { id: h.id } })}
            />
          ))}
        </ListGroup>
      ) : (
        <T v="tiny" style={{ paddingHorizontal: 4 }}>
          {status === 'live' ? t('Ainda sem comentários. Avisamos-te quando o coach comentar.') : t('Sem comentários neste link.')}
        </T>
      )}
    </View>
  );
}
