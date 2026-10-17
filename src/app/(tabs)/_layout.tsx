import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { Pressable, View } from 'react-native';

import { tap } from '@/components/ui';
import { t } from '@/i18n';
import { C, ff } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const icon = (name: IconName) => {
  const TabIcon = ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  return TabIcon;
};

function NewHandButton() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Pressable
        accessibilityLabel={t('Nova mão')}
        onPress={() => {
          tap('medium');
          router.push('/hand/new');
        }}
        style={({ pressed }) => ({
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: C.accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -14,
          opacity: pressed ? 0.85 : 1,
          shadowColor: C.accent,
          shadowOpacity: 0.45,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}>
        <Ionicons name="add" size={32} color={C.accentInk} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.border, height: 84, paddingTop: 6 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontWeight: '700', fontFamily: ff(700), fontSize: 11 },
      }}>
      <Tabs.Screen name="index" options={{ title: t('Mãos'), tabBarIcon: icon('albums') }} />
      <Tabs.Screen name="session" options={{ title: t('Sessão'), tabBarIcon: icon('timer') }} />
      <Tabs.Screen name="new" options={{ title: '', tabBarButton: () => <NewHandButton /> }} />
      <Tabs.Screen name="bankroll" options={{ title: 'Bankroll', tabBarIcon: icon('stats-chart') }} />
      <Tabs.Screen name="players" options={{ title: t('Jogadores'), tabBarIcon: icon('people') }} />
    </Tabs>
  );
}
