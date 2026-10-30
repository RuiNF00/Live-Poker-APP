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
import { releaseFor, whatsNewStep, type WhatsNewSeen } from '@/lib/whats-new-core';
import { useStore } from '@/store/store';
import { C, ff, R } from '@/theme';

const KEY = 'rl.whats-new.seen.v1';
const VERSION = Constants.expoConfig?.version ?? '0';
const SEEN_AFTER_MS = 1500;

/** The release to announce, or null. Decided once per app open. */
export function useWhatsNewCard(): { item: { icon: string; title: string; body: string } | null; dismiss: () => void; shown: () => void } {
  const { ready, hands, sessions, activeSession } = useStore();
  const [show, setShow] = useState(false);
  const release = releaseFor(WHATS_NEW, VERSION);
  // What is remembered as dealt with: the release (not the app version), so 1.1.0 after 1.0.1's card doesn't show it twice.
  const key = release?.version ?? VERSION;
  const decided = React.useRef(false);
  const stamp = React.useRef<WhatsNewSeen | null>(null);

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
      const step = whatsNewStep(seen, key, !!release?.items.length, hands.length + sessions.length > 0, Date.now());
      // The 7 days start when the card is on screen (shown()), not while the first week's steps hold its place.
      if (step.show) stamp.current = step.next;
      else if (step.next) await AsyncStorage.setItem(KEY, JSON.stringify(step.next)).catch(() => {});
      setShow(step.show);
    })();
  }, [ready, activeSession, hands.length, sessions.length, release, key]);

  const dismiss = () => {
    setShow(false);
    AsyncStorage.setItem(KEY, JSON.stringify({ version: key })).catch(() => {});
  };
  const shown = React.useCallback(() => {
    const next = stamp.current;
    stamp.current = null;
    if (next) AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  // A session started after the card was dealt: it steps aside until the session ends.
  return { item: show && release && !activeSession ? release.items[0] : null, dismiss, shown };
}

export function WhatsNewCard({ item, onDismiss, onShown }: { item: { icon: string; title: string; body: string }; onDismiss: () => void; onShown?: () => void }) {
  // Seen once it stays on screen: a first render the first week's steps replace a moment later doesn't count.
  useEffect(() => {
    if (!onShown) return;
    const id = setTimeout(onShown, SEEN_AFTER_MS);
    return () => clearTimeout(id);
  }, [onShown]);
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
          {/* Two lines on the card, so the update doesn't push the Resumo down; «Ver tudo» has the whole text. */}
          <T v="small" numberOfLines={2}>
            {t(item.body)}
          </T>
          <T v="small" color={C.accent} style={{ fontFamily: ff(700), fontWeight: '700', marginTop: 2 }}>
            {t('Ver tudo')} ›
          </T>
        </Pressable>
        <IconButton name="close" label={t('Fechar')} size={32} onPress={onDismiss} />
      </Row>
    </Card>
  );
}
