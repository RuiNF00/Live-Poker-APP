// New comments on shared hands, on the home: the same quiet card as "Novo na versão", the whole of it
// opens "Mãos partilhadas". It takes its turn in the home's one-banner chain, never during a session.

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Card, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { newsTarget } from '@/lib/friend-hands-core';
import type { Hand } from '@/poker/types';
import { C, R } from '@/theme';

export function SharedHandsCard({ n, fresh, mine }: { n: number; fresh: Record<string, number>; mine: Hand[] }) {
  const title = n === 1 ? t('1 comentário novo') : t('{n} comentários novos', { n });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${t('Nas mãos partilhadas')}`}
      onPress={() => {
        tap();
        // One hand with news: straight to it, on the street of the newest comment. Several: the list.
        const to = newsTarget(fresh, mine);
        if (!to) router.push('/shared-hands');
        else router.push({ pathname: to.kind === 'mine' ? '/hand/[id]' : '/h/[id]', params: { id: to.id, c: String(to.n) } });
      }}>
      {({ pressed }) => (
        <Card style={{ paddingVertical: 12, paddingHorizontal: 14, opacity: pressed ? 0.8 : 1 }}>
          <Row gap={12}>
            <View style={{ width: 32, height: 32, borderRadius: R.sm, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chatbubbles-outline" size={16} color={C.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="h3" numberOfLines={2}>
                {title}
              </T>
              <T v="small">{t('Nas mãos partilhadas')}</T>
            </View>
            <Ionicons name="chevron-forward" size={17} color={C.muted} />
          </Row>
        </Card>
      )}
    </Pressable>
  );
}
