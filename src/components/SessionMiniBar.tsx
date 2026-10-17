import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { chips, duration } from '@/poker/format';
import { isPaused, playedMs } from '@/store/session-math';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';
import { C, S } from '@/theme';

import { T, tap } from './ui';

/**
 * A live session pinned above the tab bar on every tab, like a music mini-player.
 * Hidden on the Session tab itself, where the full clock already shows.
 */
export function SessionMiniBar({ hidden }: { hidden?: boolean }) {
  const { activeSession } = useStore();
  // Mounted fresh each time it shows, so the clock starts from the real time.
  return activeSession && !hidden ? <Bar s={activeSession} /> : null;
}

function Bar({ s }: { s: Session }) {
  // Minutes are enough here; a 1 s tick would redraw every tab behind the bar.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const paused = isPaused(s);
  const col = paused ? C.warn : C.good;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={paused ? t('Sessão em pausa · {time}', { time: duration(playedMs(s, now)) }) : t('Sessão em curso · {time}', { time: duration(playedMs(s, now)) })}
      onPress={() => {
        tap();
        router.navigate('/session');
      }}
      style={({ pressed }) => [styles.bar, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.dot, { backgroundColor: col, shadowColor: col }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="h3" numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {s.name || t('Sem nome')}
        </T>
        <T v="monoS" numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {[paused ? t('Em pausa') : duration(playedMs(s, now)), 'Stack ' + chips(s.stack), s.bb ? `${chips(s.sb)}/${chips(s.bb)}` : ''].filter(Boolean).join(' · ')}
        </T>
      </View>
      <Ionicons name="chevron-up" size={18} color={C.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    minHeight: 52,
    paddingHorizontal: S.lg,
    paddingVertical: S.sm,
    backgroundColor: C.surface2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.borderStrong,
  },
  dot: { width: 9, height: 9, borderRadius: 5, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
});
