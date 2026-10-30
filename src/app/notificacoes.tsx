import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationSettings } from '@/components/NotificationSettings';
import { t } from '@/i18n';
import { C, S } from '@/theme';

/** Settings › Notificações: its own screen, so the switches don't make Settings twice as long. */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <Stack.Screen options={{ title: t('Notificações') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, paddingBottom: insets.bottom + 40 }}>
        <NotificationSettings titled={false} />
      </ScrollView>
    </>
  );
}
