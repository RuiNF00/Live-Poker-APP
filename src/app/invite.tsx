// Invite friends: your link, how many came and the Pro days you've earned.

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { Button, Empty, Panel, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { inviteStatus, type InviteStatus } from '@/lib/referrals';
import { shortDate } from '@/poker/format';
import { C, F, R } from '@/theme';

export default function InviteScreen() {
  const [s, setS] = useState<InviteStatus | null | undefined>(undefined);
  useEffect(() => {
    inviteStatus().then(setS);
  }, []);

  const share = async () => {
    if (!s) return;
    tap('medium');
    const msg = t('Uso o Sweatbook para guardar as minhas mãos de póquer ao vivo. Experimenta: {url}', { url: s.url });
    track('link_shared', { channel: 'invite' });
    if (Platform.OS === 'web') await Clipboard.setStringAsync(msg);
    else await Share.share({ message: msg });
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Convidar amigos') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }}>
        {s === undefined ? null : s === null ? (
          <Empty title={t('Convites indisponíveis')} body={t('Não deu para carregar os teus convites. Tenta outra vez mais tarde.')} />
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 10 }}>
              <Ionicons name="gift-outline" size={40} color={C.accent} />
              <T v="h1" style={{ textAlign: 'center' }}>
                {t('Ganha 7 dias de Pro por amigo')}
              </T>
              <T v="body" style={{ textAlign: 'center', color: C.textDim }}>
                {t('Convida amigos: quando um amigo começa a usar o Sweatbook, ganham os dois 7 dias de Pro.')}
              </T>
            </View>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(s.url);
                tap();
              }}
              style={{ backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.borderStrong, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T selectable style={{ flex: 1, fontFamily: F.monoRegular, fontSize: 14, color: C.text }} numberOfLines={1}>
                {s.url.replace(/^https:\/\//, '')}
              </T>
              <Ionicons name="copy-outline" size={18} color={C.textDim} />
            </Pressable>
            <Button title={t('Partilhar convite')} icon={<Ionicons name="share-social" size={18} color={C.accentInk} />} onPress={share} />
            <Row gap={10}>
              <Panel style={{ flex: 1, gap: 2 }}>
                <T v="label">{t('Convidados')}</T>
                <T v="h1">{s.invited}</T>
              </Panel>
              <Panel style={{ flex: 1, gap: 2 }}>
                <T v="label">{t('A usar')}</T>
                <T v="h1">{s.activated}</T>
              </Panel>
              <Panel style={{ flex: 1, gap: 2 }}>
                <T v="label">{t('Dias ganhos')}</T>
                <T v="h1">{s.daysEarned}</T>
              </Panel>
            </Row>
            {s.proUntil ? <T v="small" style={{ textAlign: 'center' }}>{t('Pro de convites até {date}', { date: shortDate(new Date(s.proUntil).getTime()) })}</T> : null}
            <T v="tiny" style={{ textAlign: 'center' }}>
              {t('Conta quando o amigo guarda a primeira mão nos 7 dias depois de instalar. Até 10 amigos por ano.')}
            </T>
          </>
        )}
      </ScrollView>
    </>
  );
}
