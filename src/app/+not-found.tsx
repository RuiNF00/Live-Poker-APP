import { router, Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button, Empty } from '@/components/ui';
import { t } from '@/i18n';
import { C } from '@/theme';

/** An old or mistyped link (a notification, a widget, a shared URL) lands here instead of a blank error. */
export default function NotFound() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}>
      <Stack.Screen options={{ title: '' }} />
      <Empty
        icon="compass-outline"
        title={t('Este ecrã não existe')}
        body={t('O link pode ser antigo. As tuas mãos e sessões estão todas no sítio.')}
        action={<Button title={t('Ir para as mãos')} onPress={() => router.replace('/hands')} style={{ alignSelf: 'stretch', marginTop: 8 }} />}
      />
    </View>
  );
}
