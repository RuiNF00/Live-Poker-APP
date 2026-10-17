import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { BottomTabBar, Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SessionMiniBar } from '@/components/SessionMiniBar';
import { tap } from '@/components/ui';
import { t } from '@/i18n';
import { C, ff } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Filled icon when the tab is active, outline otherwise.
const icon = (on: IconName, off: IconName) => {
  const TabIcon = ({ color, focused }: { color: unknown; focused: boolean }) => <Ionicons name={focused ? on : off} color={color as string} size={24} />;
  return TabIcon;
};

function NewHandButton() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Nova mão')}
        onPress={() => {
          tap('medium');
          router.push('/hand/new');
        }}
        style={({ pressed }) => ({
          width: 56,
          height: 44,
          borderRadius: 16,
          backgroundColor: pressed ? C.accentPressed : C.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: C.accent,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}>
        <Ionicons name="add" size={30} color={C.accentInk} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);
  return (
    <Tabs
      tabBar={(props) => (
        <>
          <SessionMiniBar hidden={props.state.routes[props.state.index]?.name === 'session'} />
          <BottomTabBar {...props} />
        </>
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarStyle: {
          backgroundColor: C.bgDeep,
          borderTopColor: C.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 62 + bottom,
          paddingTop: 7,
          paddingBottom: bottom,
        },
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontWeight: '700', fontFamily: ff(700), fontSize: 11, marginTop: 2 },
        // The bar has a fixed height; iOS shows the big label on long-press instead.
        tabBarAllowFontScaling: false,
      }}>
      <Tabs.Screen name="index" options={{ title: t('Mãos'), tabBarIcon: icon('albums', 'albums-outline') }} />
      <Tabs.Screen name="session" options={{ title: t('Sessão'), tabBarIcon: icon('timer', 'timer-outline') }} />
      <Tabs.Screen name="new" options={{ title: '', tabBarButton: () => <NewHandButton /> }} />
      <Tabs.Screen name="bankroll" options={{ title: 'Bankroll', tabBarIcon: icon('stats-chart', 'stats-chart-outline') }} />
      <Tabs.Screen name="players" options={{ title: t('Jogadores'), tabBarIcon: icon('people', 'people-outline') }} />
    </Tabs>
  );
}
