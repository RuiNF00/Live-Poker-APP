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
import { AppLock } from '@/components/AppLock';
import { AutoCloudBackup } from '@/components/CloudBackup';
import { NetStatus } from '@/components/NetStatus';
import { SettleReminder } from '@/components/staking/SettleReminder';
import { SwapReminder } from '@/components/swaps/SwapReminder';
import { SwapSettleReminder } from '@/components/swaps/SwapSettleReminder';
import { MonthRecapSync } from '@/lib/month-recap';
import { BackerLiveSync } from '@/components/staking/BackerLive';
import { TrialFollowUp } from '@/components/TrialFollowUp';
import { Button, Empty, KeyboardDoneBar } from '@/components/ui';
import { t } from '@/i18n';
import { track, watchResume } from '@/lib/events';
import { SessionLockScreen } from '@/lib/lock-screen';
import { HomeWidgetSync } from '@/lib/home-widget';
import { useReduceMotion } from '@/lib/motion';
import { startCrashReports } from '@/lib/crash-report';
import { installFetchTimeout } from '@/lib/net';
import { startSync } from '@/lib/sync';
import { startCoachSync } from '@/lib/coach-api';
import { NotifyPolicySync } from '@/lib/notify-gate';
import { ReviewSync } from '@/lib/review';
import { bootReferrals } from '@/lib/referrals';
// Registers the queued share-link sender before the outbox first drains.
import '@/lib/share-queue';
import '@/lib/pack-api';
// Registers the swap delete sender ("Delete all my data").
import '@/lib/swap-cleanup';
// Same for the public profile's delete.
import '@/lib/public-profile';
import { StoreProvider } from '@/store/store';
import { C, ff } from '@/theme';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.text, border: C.border, primary: C.accent },
};

SplashScreen.preventAutoHideAsync().catch(() => {});
installFetchTimeout();
startCrashReports();
startSync();
startCoachSync();

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
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    track('app_open');
    bootReferrals().catch(() => {});
    return watchResume();
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
          <HomeWidgetSync />
          <SwapReminder />
          <SwapSettleReminder />
          <TrialFollowUp />
          <MonthRecapSync />
          <SettleReminder />
          <NotifyPolicySync />
          <ReviewSync />
          <KeyboardDoneBar />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.bg },
              headerTintColor: C.text,
              headerTitleStyle: { fontWeight: '800', fontFamily: ff(800), fontSize: 17 },
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: C.bg },
              headerShadowVisible: false,
              // Reduce Motion: screens fade in place instead of sliding across.
              animation: reduceMotion ? 'fade' : 'default',
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="hand/new" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            <Stack.Screen name="hand/[id]" options={{ title: t('Mão') }} />
            <Stack.Screen name="h/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="trial" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="welcome" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="story/[id]" options={{ title: 'Story', presentation: 'modal' }} />
            <Stack.Screen name="year" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            <Stack.Screen name="session-card/[id]" options={{ title: t('Partilhar sessão'), presentation: 'modal' }} />
            <Stack.Screen name="festival-card/[id]" options={{ title: t('Partilhar festival'), presentation: 'modal' }} />
            <Stack.Screen name="festival-carousel/[id]" options={{ title: t('Carrossel do festival'), presentation: 'modal' }} />
            <Stack.Screen name="settings" options={{ title: t('Definições') }} />
            <Stack.Screen name="chop" options={{ title: t('Calculadora de deal') }} />
            <Stack.Screen name="variance" options={{ title: t('Variância') }} />
            <Stack.Screen name="summary/[id]" options={{ title: t('Resumo da sessão') }} />
            <Stack.Screen name="festival" options={{ title: 'Festival' }} />
            <Stack.Screen name="festivals" options={{ title: t('Festivais') }} />
            <Stack.Screen name="festival-new" options={{ title: t('Adicionar o meu festival'), presentation: 'modal' }} />
            <Stack.Screen name="tournament" options={{ title: t('Modo torneio') }} />
            <Stack.Screen name="tournament-stats" options={{ title: t('Torneios') }} />
            <Stack.Screen name="tournament-card" options={{ title: t('Currículo de torneios'), presentation: 'modal' }} />
            <Stack.Screen name="odds" options={{ title: t('Calculadora de odds') }} />
            <Stack.Screen name="invite" options={{ title: t('Convidar amigos') }} />
            <Stack.Screen name="profile" options={{ title: t('Perfil público') }} />
            <Stack.Screen name="coach/index" options={{ title: t('Links para o coach') }} />
            <Stack.Screen name="coach/new" options={{ title: t('Enviar ao coach'), presentation: 'modal' }} />
            <Stack.Screen name="pack/index" options={{ title: t('Links de várias mãos') }} />
            <Stack.Screen name="shared-hands" options={{ title: t('Mãos partilhadas') }} />
            <Stack.Screen name="pack/new" options={{ title: t('Partilhar num só link'), presentation: 'modal' }} />
            <Stack.Screen name="import" options={{ title: t('Importar de outra app') }} />
            <Stack.Screen name="export" options={{ title: t('Exportar') }} />
            <Stack.Screen name="r/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="live/[id]" options={{ headerShown: false }} />
          </Stack>
          <NetStatus />
          <AppLock />
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
