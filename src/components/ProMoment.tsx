import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { bigWin, pickMoment, viewed, type Moment } from '@/billing/moments';
import { usePro } from '@/billing/pro';
import { Card, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { fetchViews } from '@/lib/share-api';
import { money } from '@/poker/format';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

const KEY = 'rl.moments.v1';
const DAY = 86_400_000;
/** Shared hands whose views are checked: the newest few from the last month. */
const RECENT = 5;

interface Saved {
  dismissed: string[];
  /** Last views check, so the network is asked at most once a day. */
  checkedAt: number;
  counts: { handId: string; views: number }[];
}

/**
 * Pro offered right after the free plan proved its worth: a shared hand that
 * friends keep opening, or the best session so far. One card on the home
 * screen (never a pop-up), gone once tapped or closed. The hook says whether
 * it shows, so the home keeps a single context card at a time.
 */
export function useProMoment() {
  const { isPro, paywall } = usePro();
  const { hands, sessions } = useStore();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setSaved(v ? (JSON.parse(v) as Saved) : { dismissed: [], checkedAt: 0, counts: [] }))
      .catch(() => setSaved({ dismissed: [], checkedAt: 0, counts: [] }));
  }, []);

  const shared = hands
    .filter((h) => h.shareId && now - h.createdAt < 30 * DAY)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, RECENT);
  const sharedIds = shared.map((h) => `${h.id}:${h.shareId}`).join(',');

  useEffect(() => {
    if (isPro || !saved || !sharedIds || now - saved.checkedAt < DAY) return;
    let live = true;
    Promise.all(shared.map((h) => fetchViews(h.shareId!).then((views) => ({ handId: h.id, views })).catch(() => null))).then((r) => {
      const counts = r.filter((x): x is { handId: string; views: number } => !!x);
      if (!live || !counts.length) return;
      const next = { ...saved, checkedAt: now, counts };
      setSaved(next);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    });
    return () => {
      live = false;
    };
    // Re-check only when the set of shared hands changes or the saved state first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, saved === null, sharedIds, now]);

  if (isPro || !saved) return null;
  const m = pickMoment([bigWin(sessions, now), viewed(saved.counts)], saved.dismissed);
  if (!m) return null;

  const dismiss = (x: Moment) => {
    const next = { ...saved, dismissed: [...saved.dismissed, x.key].slice(-50) };
    setSaved(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };
  const open = () => {
    tap();
    dismiss(m);
    paywall(m.kind);
  };
  return { m, open, dismiss: () => dismiss(m) };
}

export function ProMoment({ state }: { state: NonNullable<ReturnType<typeof useProMoment>> }) {
  const { m, open, dismiss } = state;
  const icon = m.kind === 'views' ? 'eye' : 'trophy';
  const title =
    m.kind === 'views' ? t('A tua mão foi vista {n} vezes', { n: m.views }) : t('A tua melhor sessão: {amount}', { amount: '+' + money(m.profit, m.currency) });
  const body = m.kind === 'views' ? t('Com Pro, guardas e partilhas todas as mãos da sessão.') : t('Vê em que salas, jogos e stakes ganhas mais.');

  return (
    <Card tone="raised" style={{ gap: S.sm }}>
      <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={C.accent} />
        </View>
        <Pressable onPress={open} accessibilityRole="button" style={{ flex: 1, gap: 2 }}>
          <T v="h3">{title}</T>
          <T v="small">{body}</T>
          <T v="small" color={C.accent} style={{ paddingTop: 4 }}>
            {t('Ver Pro')} ›
          </T>
        </Pressable>
        <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Esconder')}>
          <Ionicons name="close" size={18} color={C.muted} />
        </Pressable>
      </Row>
    </Card>
  );
}
