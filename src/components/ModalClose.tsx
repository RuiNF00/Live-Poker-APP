// "Fechar" for screens shown as an iOS sheet: without it the only way out is a
// swipe down, which is hard with VoiceOver. Android has its own back button; the web gets it too.

import { router } from 'expo-router';
import React from 'react';
import { Platform, Pressable, Text } from 'react-native';

import { t } from '@/i18n';
import { C, ff } from '@/theme';

export function ModalClose() {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel={t('Fechar')} hitSlop={12} style={{ paddingVertical: 4, paddingRight: 8 }}>
      <Text allowFontScaling={false} style={{ fontFamily: ff(600), fontSize: 16, color: C.accent }}>
        {t('Fechar')}
      </Text>
    </Pressable>
  );
}

/** Screen options for a sheet: the close button on iOS, and on the web, where a direct link has nowhere to go back to. */
export const sheetClose = Platform.OS === 'ios' || Platform.OS === 'web' ? { headerLeft: () => <ModalClose /> } : {};
