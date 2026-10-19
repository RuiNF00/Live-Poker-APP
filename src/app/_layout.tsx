import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { DarkTheme, router, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import React, { Suspense, useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProProvider } from '@/billing/pro';
import { AgeGate } from '@/components/AgeGate';
import { AppLock } from '@/components/AppLock';
import { Deferred } from '@/components/Deferred';
import { OfflineBadge, useOffline } from '@/components/NetStatus';
import { CrashScreen, ScreenBoundary } from '@/components/ScreenError';
import { sheetClose } from '@/components/ModalClose';
import { KeyboardDoneBar } from '@/components/ui';
import { t } from '@/i18n';
import { track, watchResume } from '@/lib/events';
import { useReduceMotion } from '@/lib/motion';
import { reportCaught, startCrashReports } from '@/lib/crash-report';
import { installFetchTimeout } from '@/lib/net';
import { startSync } from '@/lib/sync';
import { startCoachSync } from '@/lib/coach-api';
import { bootReferrals } from '@/lib/referrals';
// Registers the queued share-link sender before the outbox first drains.
import '@/lib/share-queue';
import '@/lib/pack-api';
// Registers the swap delete sender ("Delete all my data").
import '@/lib/swap-cleanup';
// And the swaps created without signal.
import '@/lib/swap-create-queue';
// Same for the public profile's delete.
import '@/lib/public-profile';
import { StoreProvider } from '@/store/store';
import { C, ff } from '@/theme';

// Reminders, syncs and the lock-screen and widget bridges draw nothing on the first frame: their code loads after it.
const AfterStart = React.lazy(() => import('@/components/AfterStart'));
// Only the root crash screen needs it: loaded then, not at launch.
const RescueCopy = React.lazy(() => import('@/components/RescueCopy').then((m) => ({ default: m.RescueCopy })));

// A link opened with the app closed (an invite, a shared hand, a swap) lands on that screen alone:
// without the tabs under it, "Fechar" and back had nowhere to go. On the web the link page stands alone.
export const unstable_settings = Platform.OS === 'web' ? {} : { anchor: '(tabs)' };

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
  const offline = useOffline();
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
          <Deferred>
            <Suspense fallback={null}>
              <AfterStart />
            </Suspense>
          </Deferred>
          <KeyboardDoneBar />
          <Stack
            // Each screen catches its own render errors: «Algo correu mal · Voltar», the rest of the app stays.
            screenLayout={({ children, navigation }) => (
              <ScreenBoundary onBack={() => (navigation.canGoBack() ? navigation.goBack() : router.replace('/'))}>{children}</ScreenBoundary>
            )}
            screenOptions={{
              headerStyle: { backgroundColor: C.bg },
              headerTintColor: C.text,
              headerTitleStyle: { fontWeight: '800', fontFamily: ff(800), fontSize: 17 },
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: C.bg },
              headerShadowVisible: false,
              // No signal: a small badge on the right of the header, where it covers nothing. With signal
              // no item at all (iOS 26 draws a glass capsule around any, even an empty one).
              headerRight: offline ? () => <OfflineBadge /> : undefined,
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
            <Stack.Screen name="story/[id]" options={{ title: 'Story', presentation: 'modal', ...sheetClose }} />
            <Stack.Screen name="year" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            <Stack.Screen name="session-card/[id]" options={{ title: t('Partilhar sessão'), presentation: 'modal', ...sheetClose }} />
            <Stack.Screen name="festival-card/[id]" options={{ title: t('Partilhar festival'), presentation: 'modal', ...sheetClose }} />
            <Stack.Screen name="festival-carousel/[id]" options={{ title: t('Carrossel do festival'), presentation: 'modal', ...sheetClose }} />
            <Stack.Screen name="settings" options={{ title: t('Definições') }} />
            <Stack.Screen name="notes" options={{ title: t('Notas') }} />
            <Stack.Screen name="chop" options={{ title: t('Calculadora de deal') }} />
            <Stack.Screen name="variance" options={{ title: t('Variância') }} />
            <Stack.Screen name="summary/[id]" options={{ title: t('Resumo da sessão') }} />
            <Stack.Screen name="festival" options={{ title: 'Festival' }} />
            <Stack.Screen name="festival-event" options={{ title: t('Torneio') }} />
            <Stack.Screen name="festivals" options={{ title: t('Festivais') }} />
            <Stack.Screen name="festival-new" options={{ title: t('Adicionar o meu festival'), presentation: 'modal', ...sheetClose }} />
            <Stack.Screen name="tournament" options={{ title: t('Modo torneio') }} />
            <Stack.Screen name="tournament-stats" options={{ title: t('Torneios') }} />
            <Stack.Screen name="tournament-card" options={{ title: t('Currículo de torneios'), presentation: 'modal', ...sheetClose }} />
            <Stack.Screen name="odds" options={{ title: t('Calculadora de equity') }} />
            <Stack.Screen name="invite" options={{ title: t('Convidar amigos') }} />
            <Stack.Screen name="profile" options={{ title: t('Perfil público') }} />
            <Stack.Screen name="coach/index" options={{ title: t('Links para o coach') }} />
            <Stack.Screen name="coach/new" options={{ title: t('Enviar ao coach'), presentation: 'modal', ...sheetClose }} />
            <Stack.Screen name="pack/index" options={{ title: t('Links de várias mãos') }} />
            <Stack.Screen name="shared-hands" options={{ title: t('Mãos partilhadas') }} />
            <Stack.Screen name="pack/new" options={{ title: t('Partilhar num só link'), presentation: 'modal', ...sheetClose }} />
            <Stack.Screen name="import" options={{ title: t('Importar de outra app') }} />
            <Stack.Screen name="export" options={{ title: t('Exportar') }} />
            <Stack.Screen name="r/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="live/[id]" options={{ headerShown: false }} />
          </Stack>
          <AppLock />
          {/* After the lock, so it sits on top: no app (and no lock) until the age check allows it. */}
          <AgeGate />
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
 * Last resort, for an error outside any screen (the layout itself, the store
 * or Pro providers, a launch that couldn't read the data). Screens have their
 * own boundary (ScreenBoundary). Hands are already on disk; "Tentar de novo"
 * re-renders. If it keeps failing, Definições can't open either, so the
 * player's records can still be saved to a file from here.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('[app] render error', error);
    reportCaught(error);
    SplashScreen.hideAsync().catch(() => {});
  }, [error]);
  return (
    <CrashScreen
      onRetry={retry}
      extra={
        <Suspense fallback={null}>
          <RescueCopy />
        </Suspense>
      }
    />
  );
}
