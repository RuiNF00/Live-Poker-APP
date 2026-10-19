// Terms of Use (EULA) and Privacy Policy, required next to every purchase button (App Store 3.1.2,
// Google Play), opened in the player's language. Extra links (Restaurar compras) go in as children.

import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Pressable } from 'react-native';

import { legalUrl } from '@/billing/disclosure';
import { Row, T } from '@/components/ui';
import { t, variant } from '@/i18n';
import { C, S } from '@/theme';

export function LegalLink({ title, onPress, role = 'link', disabled, color = C.textDim }: { title: string; onPress: () => void; role?: 'link' | 'button'; disabled?: boolean; color?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole={role} hitSlop={{ left: 6, right: 6 }} style={{ minHeight: 44, justifyContent: 'center' }}>
      <T v="tiny" color={color}>
        {title}
      </T>
    </Pressable>
  );
}

export function LegalLinks({ children }: { children?: React.ReactNode }) {
  return (
    <Row gap={S.lg} style={{ justifyContent: 'center', flexWrap: 'wrap', rowGap: 0 }}>
      <LegalLink title={t('Termos de utilização (EULA)')} onPress={() => void WebBrowser.openBrowserAsync(legalUrl('terms', variant))} />
      <LegalLink title={t('Política de privacidade')} onPress={() => void WebBrowser.openBrowserAsync(legalUrl('privacy', variant))} />
      {children}
    </Row>
  );
}
