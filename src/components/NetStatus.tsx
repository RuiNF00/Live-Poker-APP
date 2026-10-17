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
  if (online || path === '/hand/new') return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('Tudo guardado no telemóvel. Envia quando houver sinal.')}
      style={{ position: 'absolute', top: insets.top + 2, left: 0, right: 0, alignItems: 'center', zIndex: 50 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, opacity: 0.95 }}>
        <Ionicons name="cloud-offline-outline" size={12} color={C.textDim} />
        {/* It floats over the header: at the largest text sizes it would cover the first rows. */}
        <T v="tiny" color={C.textDim} maxFontSizeMultiplier={1.2} numberOfLines={1}>
          {pending > 0 ? t('Sem rede · {n} por enviar', { n: pending }) : t('Sem rede')}
        </T>
      </View>
    </View>
  );
}
