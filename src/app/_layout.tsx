import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { DarkTheme, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProProvider } from '@/billing/pro';
import { AutoCloudBackup } from '@/components/CloudBackup';
import { NetStatus } from '@/components/NetStatus';
import { BackerLiveSync } from '@/components/staking/BackerLive';
import { Button, Empty } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { SessionLockScreen } from '@/lib/lock-screen';
import { installFetchTimeout } from '@/lib/net';
import { startSync } from '@/lib/sync';
import { bootReferrals } from '@/lib/referrals';
import { StoreProvider } from '@/store/store';
import { C, ff } from '@/theme';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.text, border: C.border, primary: C.accent },
};

SplashScreen.preventAutoHideAsync().catch(() => {});
installFetchTimeout();
startSync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  useEffect(() => {
    track('app_open');
    bootReferrals().catch(() => {});
  }, []);
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <StoreProvider>
          <ProProvider>
          <HideSplash />
          <StatusBar style="light" />
          <AutoCloudBackup />
          <BackerLiveSync />
          <SessionLockScreen />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.bg },
              headerTintColor: C.text,
              headerTitleStyle: { fontWeight: '800', fontFamily: ff(800), fontSize: 17 },
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: C.bg },
              headerShadowVisible: false,
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="hand/new" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            <Stack.Screen name="hand/[id]" options={{ title: t('Mão') }} />
            <Stack.Screen name="h/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="story/[id]" options={{ title: 'Story', presentation: 'modal' }} />
            <Stack.Screen name="session-card/[id]" options={{ title: t('Partilhar sessão'), presentation: 'modal' }} />
            <Stack.Screen name="settings" options={{ title: t('Definições') }} />
            <Stack.Screen name="chop" options={{ title: t('Calculadora de deal') }} />
            <Stack.Screen name="variance" options={{ title: t('Variância') }} />
            <Stack.Screen name="summary/[id]" options={{ title: t('Resumo da sessão') }} />
            <Stack.Screen name="festival" options={{ title: 'Festival' }} />
            <Stack.Screen name="odds" options={{ title: t('Calculadora de odds') }} />
            <Stack.Screen name="invite" options={{ title: t('Convidar amigos') }} />
            <Stack.Screen name="import" options={{ title: t('Importar de outra app') }} />
            <Stack.Screen name="export" options={{ title: t('Exportar') }} />
            <Stack.Screen name="r/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="live/[id]" options={{ headerShown: false }} />
          </Stack>
          <NetStatus />
          </ProProvider>
        </StoreProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Mounted once fonts and local data are both in: the first frame is the real one. */
function HideSplash() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return null;
}

/**
 * A screen that crashes while rendering shows this instead of closing the
 * app. Hands are already on disk; "Tentar de novo" re-renders.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('[app] render error', error);
    SplashScreen.hideAsync().catch(() => {});
  }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}>
      <Empty
        title={t('Algo correu mal neste ecrã')}
        body={t('As tuas mãos estão guardadas no telemóvel. Tenta de novo; se voltar a acontecer, fecha e abre a app.')}
        action={<Button title={t('Tentar de novo')} onPress={retry} style={{ alignSelf: 'stretch', marginTop: 8 }} />}
      />
    </View>
  );
}
