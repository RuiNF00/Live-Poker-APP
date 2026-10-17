// Invite friends: your link, how many came and the Pro days you've earned.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { Button, Card, ListGroup, ListItem, Stat, StatGrid, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { inviteStatus, type InviteStatus } from '@/lib/referrals';
import { shortDate } from '@/poker/format';
import { C, F, R, S } from '@/theme';

export default function InviteScreen() {
  const [s, setS] = useState<InviteStatus | null | undefined>(undefined);
  const load = () => {
    setS(undefined);
    inviteStatus().then(setS);
  };
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

  const steps: [React.ComponentProps<typeof Ionicons>['name'], string][] = [
    ['paper-plane-outline', t('Envias o teu link a um amigo')],
    ['download-outline', t('Ele instala e guarda a primeira mão')],
    ['flash-outline', t('Recebem os dois 7 dias de Pro')],
  ];

  return (
    <>
      <Stack.Screen options={{ title: t('Convidar amigos') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.xl, paddingBottom: 48 }}>
        <View style={{ alignItems: 'center', gap: S.md, paddingTop: S.sm }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="gift" size={34} color={C.accent} />
          </View>
          <T v="title" style={{ textAlign: 'center', fontSize: 28 }}>
            {t('7 dias de Pro por amigo')}
          </T>
          <T v="callout" style={{ textAlign: 'center' }}>
            {t('Para ti e para ele. Até 10 amigos por ano.')}
          </T>
        </View>

        <ListGroup>
          {steps.map(([ic, label], i) => (
            <ListItem key={i} left={<T v="mono" color={C.accent} style={{ width: 16 }}>{String(i + 1)}</T>} icon={ic} title={label} numberOfLines={2} />
          ))}
        </ListGroup>

        {s === undefined ? null : s === null ? (
          <Card tone="warn" style={{ gap: S.sm }}>
            <T v="h3" color={C.warn}>
              {t('Sem ligação ao servidor')}
            </T>
            <T v="small">{t('Não deu para carregar o teu link. Verifica a rede e tenta outra vez.')}</T>
            <Button size="sm" kind="secondary" icon="refresh" title={t('Tentar outra vez')} style={{ alignSelf: 'flex-start' }} onPress={load} />
          </Card>
        ) : (
          <>
            <View style={{ gap: S.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Copiar link')}
                onPress={async () => {
                  await Clipboard.setStringAsync(s.url);
                  tap();
                }}
                style={({ pressed }) => ({ backgroundColor: C.bgDeep, borderRadius: R.md, borderWidth: 1, borderColor: C.borderStrong, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}>
                <T selectable style={{ flex: 1, fontFamily: F.monoRegular, fontSize: 14, color: C.text }} numberOfLines={1}>
                  {s.url.replace(/^https:\/\//, '')}
                </T>
                <Ionicons name="copy-outline" size={18} color={C.accent} />
              </Pressable>
              <Button title={t('Partilhar convite')} icon="share-social" onPress={share} />
            </View>
            <StatGrid cols={3}>
              <Stat label={t('Convidados')} value={String(s.invited)} />
              <Stat label={t('A usar')} value={String(s.activated)} />
              <Stat label={t('Dias')} value={String(s.daysEarned)} tone={s.daysEarned ? 'accent' : undefined} />
            </StatGrid>
            {s.proUntil ? (
              <T v="small" style={{ textAlign: 'center' }}>
                {t('Pro de convites até {date}', { date: shortDate(new Date(s.proUntil).getTime()) })}
              </T>
            ) : null}
          </>
        )}
        <T v="tiny" style={{ textAlign: 'center' }}>
          {t('Conta quando o amigo guarda a primeira mão nos 7 dias depois de instalar.')}
        </T>
      </ScrollView>
    </>
  );
}
