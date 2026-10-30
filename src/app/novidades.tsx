import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { Card, Row, Section, T } from '@/components/ui';
import { WHATS_NEW } from '@/data/whats-new';
import { t } from '@/i18n';
import { releaseFor, releaseTitle } from '@/lib/whats-new-core';
import { C, R, S } from '@/theme';

const VERSION = Constants.expoConfig?.version ?? '0';

/** What each version brought, newest first. */
export default function WhatsNewScreen() {
  // The entry this version announces is titled with the version the player has (releaseTitle).
  const current = releaseFor(WHATS_NEW, VERSION);
  return (
    <>
      <Stack.Screen options={{ title: t('Novidades') }} />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, paddingBottom: S.xxl, gap: S.lg }}>
        {WHATS_NEW.map((r) => (
          <Section key={r.version} title={t('Versão {v}', { v: releaseTitle(r.version, r === current, VERSION) })}>
            <Card style={{ gap: S.lg }}>
              {r.items.map((it) => (
                <Row key={it.title} gap={S.md} style={{ alignItems: 'flex-start' }}>
                  <View style={{ width: 36, height: 36, borderRadius: R.sm, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={it.icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color={C.accent} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="h3">{t(it.title)}</T>
                    <T v="small">{t(it.body)}</T>
                  </View>
                </Row>
              ))}
            </Card>
          </Section>
        ))}
      </ScrollView>
    </>
  );
}
