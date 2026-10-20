import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import React, { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button, Row, T, useSheetPad } from '@/components/ui';
import { t } from '@/i18n';
import { askNotificationPermission, notifications } from '@/lib/lock-screen/reminder';
import { track } from '@/lib/events';
import { softAskAllowed } from '@/lib/notify-policy';
import { noteOverlay } from '@/lib/review';
import { C, R, S } from '@/theme';

export interface SoftAsk {
  /** Where it was asked, for the notify_permission event. */
  where: 'session' | 'festival' | 'trial' | 'swap' | 'coach' | 'comments' | 'month' | 'staking' | 'week';
  /** Why the player wants this, in one line. */
  title: string;
  /** What they get, when the generic line isn't enough. */
  body?: string;
  /** The notification they will get, drawn the way iOS shows it. */
  preview: { title: string; body: string };
}

const SOFT_NO_KEY = 'rl.notify.soft-no.v1';

/**
 * What an ask would do now: 'granted' (nothing to ask), 'ask' (the sheet shows) or
 * 'no' (web, refused in the system, or "Agora não" less than 30 days ago).
 */
export async function softAskState(): Promise<'granted' | 'ask' | 'no'> {
  const n = notifications();
  if (!n) return 'no';
  try {
    const cur = await n.getPermissionsAsync();
    if (cur.granted) return 'granted';
    if (!cur.canAskAgain) return 'no';
    const lastNo = Number(await AsyncStorage.getItem(SOFT_NO_KEY)) || null;
    return softAskAllowed(lastNo) ? 'ask' : 'no';
  } catch {
    return 'no';
  }
}

/**
 * The system prompt can be answered once. Before it, show the notification the
 * player will actually get and let them say "not now" without burning it.
 * Already allowed: resolves true at once. Already refused, or web: false, no sheet.
 * "Agora não" holds every ask, wherever it comes from, for 30 days.
 */
export function useNotifySoftAsk(): [React.ReactNode, (ask: SoftAsk) => Promise<boolean>] {
  const [ask, setAsk] = useState<SoftAsk | null>(null);
  const done = useRef<((ok: boolean) => void) | null>(null);

  const request = useCallback(async (a: SoftAsk) => {
    const state = await softAskState();
    if (state !== 'ask') return state === 'granted';
    return new Promise<boolean>((resolve) => {
      done.current = resolve;
      noteOverlay(true);
      setAsk(a);
    });
  }, []);

  const finish = async (yes: boolean) => {
    setAsk(null);
    noteOverlay(false);
    if (!yes) AsyncStorage.setItem(SOFT_NO_KEY, String(Date.now())).catch(() => {});
    const ok = yes ? await askNotificationPermission() : false;
    if (ask) track('notify_permission', { where: ask.where, result: !yes ? 'later' : ok ? 'granted' : 'denied' });
    done.current?.(ok);
    done.current = null;
  };

  const sheet = <SoftAskSheet ask={ask} onAnswer={finish} />;
  return [sheet, request];
}

export function SoftAskSheet({ ask, onAnswer }: { ask: SoftAsk | null; onAnswer: (yes: boolean) => void }) {
  const sheetPad = useSheetPad(S.xxl);
  return (
    <Modal visible={!!ask} transparent animationType="fade" onRequestClose={() => onAnswer(false)}>
      <Pressable accessible={false} onPress={() => onAnswer(false)} style={{ flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' }}>
        {ask ? (
          <Pressable accessible={false} accessibilityViewIsModal onAccessibilityEscape={() => onAnswer(false)} style={{ backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: S.lg, paddingBottom: sheetPad, gap: S.lg }}>
            <View
              accessible
              accessibilityLabel={`${t('Exemplo de aviso')}: ${ask.preview.title}. ${ask.preview.body}`}
              style={{ backgroundColor: C.surface3, borderRadius: R.lg, padding: S.md, gap: 6, borderWidth: 1, borderColor: C.border }}>
              <Row gap={S.sm}>
                <Image source={require('../../assets/images/icon.png')} style={{ width: 20, height: 20, borderRadius: 5 }} />
                <T v="tiny" style={{ flex: 1, color: C.textDim }}>
                  SWEATBOOK
                </T>
                <T v="tiny">{t('agora')}</T>
              </Row>
              <T v="h3">{ask.preview.title}</T>
              <T v="small" style={{ color: C.textDim }}>
                {ask.preview.body}
              </T>
            </View>
            <View style={{ gap: S.sm }}>
              <T v="h1">{ask.title}</T>
              <T v="body" style={{ color: C.textDim }}>
                {ask.body ?? t('Só avisos que pediste. Nada de publicidade. Podes escolher quais nas Definições da Sweatbook.')}
              </T>
            </View>
            <View style={{ gap: S.sm }}>
              <Button title={t('Ativar avisos')} icon="notifications-outline" onPress={() => onAnswer(true)} />
              <Button title={t('Agora não')} kind="ghost" onPress={() => onAnswer(false)} />
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}
