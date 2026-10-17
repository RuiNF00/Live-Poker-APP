// "Mãos partilhadas": the hands friends sent you and your own shared hands, with the comments you
// haven't seen yet. Sending still goes through WhatsApp or Instagram; this is where the talk comes back.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';

import { CardRow } from '@/components/PlayingCard';
import { Badge, Button, Card, Empty, ListItem, Row, Section, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { forgetFriendHand, useSharedHands } from '@/lib/friend-hands';
import type { FriendHand } from '@/lib/friend-hands-core';
import { comboLabel } from '@/poker/cards';
import { blindsLabel } from '@/poker/format';
import type { Hand } from '@/poker/types';
import { C, S } from '@/theme';

const day = (ts: number) => new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

function NewBadge({ n }: { n?: number }) {
  if (!n) return null;
  return <Badge solid color={C.accent} label={n === 1 ? t('1 novo') : t('{n} novos', { n })} />;
}

function comments(n: number | undefined) {
  return !n ? t('Sem comentários') : n === 1 ? t('1 comentário') : t('{n} comentários', { n });
}

export default function SharedHands() {
  const { friends, mine, counts, fresh } = useSharedHands({ refresh: true });
  // Your hands with something new first, then the latest.
  const ordered = [...mine].sort((a, b) => (fresh[b.shareId!] ?? 0) - (fresh[a.shareId!] ?? 0));

  if (!friends.length && !mine.length)
    return (
      <Empty
        icon="chatbubbles-outline"
        title={t('Ainda sem mãos partilhadas')}
        body={t('Partilha uma mão e os comentários dos teus amigos aparecem aqui. As mãos que eles te mandarem também.')}
        action={<Button title={t('Ir para as mãos')} kind="secondary" size="md" onPress={() => router.navigate('/')} />}
      />
    );

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.md, gap: S.lg, paddingBottom: 48 }}>
      <Section title={t('Dos teus amigos')}>
        {friends.length ? (
          <Card padded={false}>
            {friends.map((f, i) => (
              <View key={f.id} style={i ? { borderTopWidth: 1, borderTopColor: C.border } : undefined}>
                <FriendRow hand={f} count={counts[f.id]} fresh={fresh[f.id]} />
              </View>
            ))}
          </Card>
        ) : (
          <T v="small" style={{ paddingHorizontal: 4 }}>
            {t('Quando abrires na app uma mão que um amigo te mandou, ela fica aqui para voltares à conversa.')}
          </T>
        )}
      </Section>

      <Section title={t('As tuas')}>
        {mine.length ? (
          <Card padded={false}>
            {ordered.map((h, i) => (
              <View key={h.id} style={i ? { borderTopWidth: 1, borderTopColor: C.border } : undefined}>
                <MineRow hand={h} count={counts[h.shareId!]} fresh={fresh[h.shareId!]} />
              </View>
            ))}
          </Card>
        ) : (
          <T v="small" style={{ paddingHorizontal: 4 }}>
            {t('Partilha uma mão (botão Partilhar na mão) para os teus amigos comentarem.')}
          </T>
        )}
      </Section>
    </ScrollView>
  );
}

function FriendRow({ hand, count, fresh }: { hand: FriendHand; count?: number; fresh?: number }) {
  const remove = () => {
    const go = () => forgetFriendHand(hand.id);
    if (Platform.OS === 'web') return go();
    Alert.alert(t('Tirar da lista?'), t('A mão continua no link do teu amigo.'), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Tirar'), style: 'destructive', onPress: go },
    ]);
  };
  return (
    <ListItem
      icon="person-outline"
      title={hand.title || t('Mão de um amigo')}
      subtitle={`${day(hand.openedAt)} · ${comments(count)}`}
      right={
        <Row gap={S.sm}>
          <NewBadge n={fresh} />
          <Pressable onPress={remove} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Tirar da lista')} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={18} color={C.muted} />
          </Pressable>
        </Row>
      }
      chevron={false}
      onPress={() => router.push({ pathname: '/h/[id]', params: { id: hand.id } })}
      accessibilityLabel={`${hand.title || t('Mão de um amigo')}, ${comments(count)}${fresh ? `, ${fresh === 1 ? t('1 novo') : t('{n} novos', { n: fresh })}` : ''}`}
    />
  );
}

function MineRow({ hand, count, fresh }: { hand: Hand; count?: number; fresh?: number }) {
  const cards = hand.players[hand.hero]?.cards;
  const title = [comboLabel(cards), blindsLabel(hand)].filter(Boolean).join(' · ');
  return (
    <ListItem
      left={cards?.length === 2 ? <CardRow cards={cards} size="xs" gap={1} /> : undefined}
      title={title || t('Mão')}
      subtitle={`${day(hand.createdAt)} · ${comments(count)}`}
      right={<NewBadge n={fresh} />}
      onPress={() => router.push({ pathname: '/hand/[id]', params: { id: hand.id } })}
      accessibilityLabel={`${title}, ${comments(count)}${fresh ? `, ${fresh === 1 ? t('1 novo') : t('{n} novos', { n: fresh })}` : ''}`}
    />
  );
}
