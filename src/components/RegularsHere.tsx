// Sitting down in a room you know: "Tens notas sobre 4 regulares daqui", one
// tap from the notes. No names on it: the player beside you can see the
// screen. Only in the first hours of the session (that's when you look around
// the table), and gone for this session once closed.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';

import { t } from '@/i18n';
import { regularsAt } from '@/store/regulars';
import { useStore } from '@/store/store';
import type { Session } from '@/store/types';

import { Banner, tap } from './ui';

const HIDDEN = 'rl.regulars.hidden.v1';
/** After this long at the table the banner has done its job. */
export const REGULARS_FOR = 2 * 3_600_000;

export function RegularsHere({ s }: { s: Session }) {
  const { hands, sessions, players } = useStore();
  const [hidden, setHidden] = useState<string[] | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    AsyncStorage.getItem(HIDDEN)
      .then((v) => setHidden(v ? (JSON.parse(v) as string[]) : []))
      .catch(() => setHidden([]));
  }, []);
  // The session's own hands don't count: who you meet today isn't "known" yet.
  const known = useMemo(() => regularsAt(s.venue, hands.filter((h) => h.sessionId !== s.id), sessions, players), [s.venue, s.id, hands, sessions, players]);

  if (!hidden || hidden.includes(s.id) || !known.length || now - s.startedAt > REGULARS_FOR) return null;
  return (
    <Banner
      tone="info"
      icon="people-outline"
      title={known.length === 1 ? t('Tens notas sobre 1 regular daqui') : t('Tens notas sobre {n} regulares daqui', { n: known.length })}
      body={t('Vê quem são e o que já sabes de cada um.')}
      action={t('Ver notas')}
      onPress={() => router.push({ pathname: '/notes', params: { venue: s.venue } })}
      onDismiss={() => {
        tap();
        const next = [...hidden, s.id].slice(-20);
        setHidden(next);
        AsyncStorage.setItem(HIDDEN, JSON.stringify(next)).catch(() => {});
      }}
      dismissLabel={t('Fechar')}
    />
  );
}
