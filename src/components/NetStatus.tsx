// A quiet badge while there's no signal. Everything keeps working (it's all on the
// phone); it only says that sharing, backups and invites will go out by themselves later.
// It sits in the header row (next to the screen's own buttons), never floating over the
// content: a pill over the top centre covered the native titles and, at 200% text, the tab titles.

import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Text, View } from 'react-native';

import { t } from '@/i18n';
import { useOnline, usePending } from '@/lib/sync';
import { C, F } from '@/theme';

export function useOffline(): boolean {
  return !useOnline();
}

export function OfflineBadge() {
  const offline = useOffline();
  const pending = usePending();
  if (!offline) return null;
  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={(pending > 0 ? t('Sem rede · {n} por enviar', { n: pending }) : t('Sem rede')) + '. ' + t('Tudo guardado no telemóvel. Envia quando houver sinal.')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 26, height: 26, justifyContent: 'center', paddingHorizontal: pending > 0 ? 8 : 0, borderRadius: 999, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }}>
      <Ionicons name="cloud-offline-outline" size={14} color={C.textDim} />
      {pending > 0 ? (
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ color: C.textDim, fontSize: 12, fontFamily: F.medium }}>
          {pending}
        </Text>
      ) : null}
    </View>
  );
}

/** Native stack header: the badge before the screen's own right button, if any. */
export function headerRightWithBadge(right?: () => React.ReactNode) {
  return function HeaderRight() {
    const offline = useOffline();
    // Nothing at all with signal: iOS 26 draws a glass capsule around every header item, even an empty one.
    if (!offline && !right) return null;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <OfflineBadge />
        {right ? right() : null}
      </View>
    );
  };
}
