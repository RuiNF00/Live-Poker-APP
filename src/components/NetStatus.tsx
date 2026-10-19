// A quiet pill at the top while there's no signal. Everything keeps working
// (it's all on the phone); it only says that sharing, backups and invites
// will go out by themselves later. Not on hand entry, where it would cover the blinds.

import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useOnline, usePending } from '@/lib/sync';
import { C } from '@/theme';

import { T } from './ui';

export function NetStatus() {
  const online = useOnline();
  const pending = usePending();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  // Hand entry has its own header with the blinds right where the pill floats; the hand is saved on the phone anyway.
  // First run has nothing to send yet, and the pill would sit on the progress bar.
  // The paywall scrolls its plans under it (it covered «3 dias grátis»), and says itself when the store can't be reached.
  if (online || path === '/hand/new' || path === '/welcome' || path === '/paywall') return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={(pending > 0 ? t('Sem rede · {n} por enviar', { n: pending }) : t('Sem rede')) + '. ' + t('Tudo guardado no telemóvel. Envia quando houver sinal.')}
      style={{ position: 'absolute', top: Math.max(0, insets.top - 4), left: 0, right: 0, alignItems: 'center', zIndex: 50 }}>
      {/* Icon only (and what's waiting to go out): a text pill at the top centre ran over long titles at 375 px.
          Small and tucked just under the status bar so it clears the header buttons (the search one sits under it at 375). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 22, height: 22, justifyContent: 'center', paddingHorizontal: pending > 0 ? 7 : 0, borderRadius: 999, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, opacity: 0.95 }}>
        <Ionicons name="cloud-offline-outline" size={12} color={C.textDim} />
        {pending > 0 ? (
          <T v="tiny" color={C.textDim} maxFontSizeMultiplier={1.2} numberOfLines={1}>
            {pending}
          </T>
        ) : null}
      </View>
    </View>
  );
}
