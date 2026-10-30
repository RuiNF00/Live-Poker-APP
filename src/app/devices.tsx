// «Usar noutro aparelho»: show this device's code, or join another's (SyncDevices.tsx). The QR link
// (sweatbook://sync#code) opens here with ?from=link and the code kept in memory (+native-intent.tsx):
// nothing joins until the copy was shown and the player said yes (twice for a link).

import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { t } from '@/i18n';

// The cloud copy's screens load lazily, off the first frame (as in settings.tsx). Through CloudBackup, whose
// helpers SyncDevices uses: one chunk for both, never a copy of CloudBackup in the launch bundle.
const SyncDevices = React.lazy(() => import('@/components/CloudBackup').then((m) => ({ default: m.SyncDevices })));

export default function DevicesScreen() {
  const { join, from } = useLocalSearchParams<{ join?: string; from?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('Usar noutro aparelho') }} />
      <React.Suspense fallback={null}>
        <SyncDevices join={join === '1'} fromLink={from === 'link'} />
      </React.Suspense>
    </>
  );
}
