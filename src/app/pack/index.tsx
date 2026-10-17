// Links with several hands: send again or turn off. The hands' own links are not touched.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Platform, ScrollView, Share, View } from 'react-native';

import { CardRow } from '@/components/PlayingCard';
import { Button, Card, Empty, Row, T, tap } from '@/components/ui';
import { locale, t, variant } from '@/i18n';
import { withLang } from '@/lib/link-lang';
import { deletePack, usePacks } from '@/lib/pack-api';
import type { HandPack } from '@/lib/pack-core';
import type { Hand } from '@/poker/types';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

function confirm(title: string, body: string, yes: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${body}`));
  return new Promise((r) =>
    Alert.alert(title, body, [
      { text: t('Cancelar'), style: 'cancel', onPress: () => r(false) },
      { text: yes, style: 'destructive', onPress: () => r(true) },
    ]),
  );
}

export default function Packs() {
  const packs = usePacks();
  const { hands } = useStore();
  if (!packs.length)
    return (
      <Empty
        icon="albums-outline"
        title={t('Ainda sem links de várias mãos')}
        body={t('Seleciona mãos na lista (toque longo) e toca em Partilhar num só link.')}
        action={<Button title={t('Ir para as mãos')} kind="secondary" size="md" onPress={() => router.navigate('/')} />}
      />
    );
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.md, gap: S.md, paddingBottom: 48 }}>
      {packs.map((p) => (
        <PackCard key={p.id} pack={p} hands={hands} />
      ))}
    </ScrollView>
  );
}

function PackCard({ pack, hands }: { pack: HandPack; hands: Hand[] }) {
  const list = pack.handIds.map((id) => hands.find((h) => h.id === id)).filter((h): h is Hand => !!h);
  const share = async () => {
    tap();
    const msg = `${t('{n} mãos para rever: o que fazias em cada uma? 👀', { n: pack.handIds.length })}\n${withLang(pack.url, variant)}`;
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(msg);
      Alert.alert(t('Link copiado'));
    } else await Share.share({ message: msg }).catch(() => {});
  };
  const off = async () => {
    if (await confirm(t('Desligar o link?'), t('Quem tiver o link deixa de o abrir. Cada mão mantém o seu próprio link.'), t('Desligar'))) deletePack(pack.id);
  };
  return (
    <Card style={{ gap: S.md }}>
      <View style={{ gap: 4 }}>
        <T v="h3" numberOfLines={2}>
          {pack.title || t('{n} mãos', { n: pack.handIds.length })}
        </T>
        <T v="tiny">
          {t('{n} mãos', { n: pack.handIds.length })} · {new Date(pack.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
          {pack.hideAmounts ? ` · ${t('em big blinds')}` : ''}
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {list.slice(0, 10).map((h) => (
          <View key={h.id} style={{ paddingVertical: 4, paddingHorizontal: 5, borderRadius: R.sm, backgroundColor: C.surface2 }}>
            {h.players[h.hero].cards?.length === 2 ? <CardRow cards={h.players[h.hero].cards!} size="xs" gap={1} /> : <Ionicons name="albums-outline" size={14} color={C.muted} />}
          </View>
        ))}
      </View>
      <Row gap={S.sm}>
        <Button size="sm" kind="secondary" icon="share-outline" title={t('Enviar outra vez')} onPress={share} style={{ flex: 1 }} />
        <Button size="sm" kind="plain" title={t('Desligar')} onPress={off} />
      </Row>
    </Card>
  );
}
