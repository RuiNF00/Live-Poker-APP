// "Novo na versão {v}": one quiet card on the home after an update with an
// entry in WHATS_NEW. Never a screen over the launch, never during a session,
// and never followed by the review prompt.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, IconButton, Row, T } from '@/components/ui';
import { WHATS_NEW } from '@/data/whats-new';
import { t } from '@/i18n';
import { whatsNewStep, type WhatsNewSeen } from '@/lib/whats-new-core';
import { useStore } from '@/store/store';
import { C, ff, R } from '@/theme';

const KEY = 'rl.whats-new.seen.v1';
const VERSION = Constants.expoConfig?.version ?? '0';

/** The release to announce, or null. Decided once per app open. */
export function useWhatsNewCard(): { item: { icon: string; title: string; body: string } | null; dismiss: () => void } {
  const { ready, hands, sessions, activeSession } = useStore();
  const [show, setShow] = useState(false);
  const release = WHATS_NEW.find((r) => r.version === VERSION);
  const decided = React.useRef(false);

  useEffect(() => {
    // During a session it waits for the next opening.
    if (!ready || decided.current || activeSession) return;
    decided.current = true;
    (async () => {
      let seen: WhatsNewSeen | null = null;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        seen = raw ? (JSON.parse(raw) as WhatsNewSeen) : null;
      } catch {}
      const step = whatsNewStep(seen, VERSION, !!release?.items.length, hands.length + sessions.length > 0, Date.now());
      if (step.next) await AsyncStorage.setItem(KEY, JSON.stringify(step.next)).catch(() => {});
      setShow(step.show);
    })();
  }, [ready, activeSession, hands.length, sessions.length, release]);

  const dismiss = () => {
    setShow(false);
    AsyncStorage.setItem(KEY, JSON.stringify({ version: VERSION })).catch(() => {});
  };
  return { item: show && release ? release.items[0] : null, dismiss };
}

export function WhatsNewCard({ item, onDismiss }: { item: { icon: string; title: string; body: string }; onDismiss: () => void }) {
  const open = () => {
    onDismiss();
    router.push('/novidades');
  };
  return (
    <Card style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 32, height: 32, borderRadius: R.sm, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={item.icon as React.ComponentProps<typeof Ionicons>['name']} size={16} color={C.accent} />
        </View>
        {/* The text opens Novidades; the × is its own button beside it (no button inside a button). */}
        <Pressable accessibilityRole="button" onPress={open} style={{ flex: 1, gap: 2 }}>
          <T v="label" color={C.accent}>
            {t('Novo na versão {v}', { v: VERSION })}
          </T>
          <T v="h3">{t(item.title)}</T>
          <T v="small">{t(item.body)}</T>
          <T v="small" color={C.accent} style={{ fontFamily: ff(700), fontWeight: '700', marginTop: 2 }}>
            {t('Ver tudo')} ›
          </T>
        </Pressable>
        <IconButton name="close" label={t('Fechar')} size={32} onPress={onDismiss} />
      </Row>
    </Card>
  );
}
