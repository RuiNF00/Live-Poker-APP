// «Usar noutro aparelho»: show this device's code, or join another's (SyncDevices.tsx). The QR link
// (sweatbook://sync#code) opens here with the code filled in (+native-intent.tsx); nothing is joined
// until the player taps «Juntar».

import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { t } from '@/i18n';

// The cloud copy's screens load lazily, off the first frame (as in settings.tsx).
const SyncDevices = React.lazy(() => import('@/components/SyncDevices').then((m) => ({ default: m.SyncDevices })));

export default function DevicesScreen() {
  const { join, code } = useLocalSearchParams<{ join?: string; code?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('Usar noutro aparelho') }} />
      <React.Suspense fallback={null}>
        <SyncDevices join={join === '1'} code={typeof code === 'string' ? code : undefined} />
      </React.Suspense>
    </>
  );
}
