// "Mãos partilhadas": the hands friends sent you and your own shared hands, with the comments you
// haven't seen yet. Sending still goes through WhatsApp or Instagram; this is where the talk comes back.

import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Linking, ScrollView, View } from 'react-native';

import { CardRow } from '@/components/PlayingCard';
import { Badge, Button, Card, Empty, ListItem, Section, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { useSharedHands } from '@/lib/friend-hands';
import { comboLabel } from '@/poker/cards';
import { blindsLabel } from '@/poker/format';
import { BRAND, C, S } from '@/theme';

const TERMS_URL = `${BRAND.webUrl}/terms`;

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
      {friends.length ? (
        <Section title={t('Dos teus amigos')}>
          <Card padded={false}>
            {friends.map((f, i) => (
              <View key={f.id} style={i ? { borderTopWidth: 1, borderTopColor: C.border } : undefined}>
                <HandRow
                  cards={f.cards}
                  title={f.title || t('Mão de um amigo')}
                  when={f.openedAt}
                  count={counts[f.id]}
                  fresh={fresh[f.id]}
                  onPress={() => router.push({ pathname: '/h/[id]', params: { id: f.id, ...(fresh[f.id] ? { c: String(fresh[f.id]) } : {}) } })}
                />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title={t('As tuas')}>
        {mine.length ? (
          <Card padded={false}>
            {ordered.map((h, i) => (
              <View key={h.id} style={i ? { borderTopWidth: 1, borderTopColor: C.border } : undefined}>
                <HandRow
                  cards={h.players[h.hero]?.cards}
                  title={[comboLabel(h.players[h.hero]?.cards), blindsLabel({ game: { ...h.game, ante: 0 } })].filter(Boolean).join(' · ') || t('Mão')}
                  when={h.createdAt}
                  count={counts[h.shareId!]}
                  fresh={fresh[h.shareId!]}
                  onPress={() => router.push({ pathname: '/hand/[id]', params: { id: h.id, ...(fresh[h.shareId!] ? { c: String(fresh[h.shareId!]) } : {}) } })}
                />
              </View>
            ))}
          </Card>
        ) : (
          <View style={{ gap: S.sm, paddingHorizontal: 4, alignItems: 'flex-start' }}>
            <T v="small">{t('Partilha uma mão (botão Partilhar na mão) para os teus amigos comentarem.')}</T>
            <Button title={t('Partilhar uma mão')} kind="secondary" size="md" onPress={() => router.navigate('/')} />
          </View>
        )}
      </Section>

      <Footer />
    </ScrollView>
  );
}

// Friends' hands and yours look the same: the hole cards are what makes a hand recognisable. The
// badge sits in a fixed column by the chevron, so new comments line up down the list.
function HandRow(p: { cards?: string[]; title: string; when: number; count?: number; fresh?: number; onPress: () => void }) {
  return (
    <ListItem
      left={p.cards?.length === 2 ? <CardRow cards={p.cards} size="xs" gap={1} /> : <View style={{ width: 44 }} />}
      title={p.title}
      subtitle={`${day(p.when)} · ${comments(p.count)}`}
      right={
        <View style={{ minWidth: 64, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <NewBadge n={p.fresh} />
        </View>
      }
      onPress={p.onPress}
      accessibilityLabel={`${p.title}, ${comments(p.count)}${p.fresh ? `, ${p.fresh === 1 ? t('1 novo') : t('{n} novos', { n: p.fresh })}` : ''}`}
    />
  );
}

// Who to write to and the rules for comments, where people talk to each other.
function Footer() {
  return (
    <View style={{ gap: 4, paddingHorizontal: 4 }}>
      <T v="tiny">
        {t('Ao comentar ou partilhar aceitas os')}{' '}
        <T v="tiny" style={{ textDecorationLine: 'underline' }} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} accessibilityRole="link">
          {t('Termos')}
        </T>
        .
      </T>
      <T v="tiny">
        {t('Algum problema com uma mão ou comentário? Escreve para')}{' '}
        <T v="tiny" style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`mailto:${BRAND.supportEmail}`)} accessibilityRole="link">
          {BRAND.supportEmail}
        </T>
      </T>
    </View>
  );
}
