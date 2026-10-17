// Share the tournament record as a story: amounts off by default, the
// Sweatbook mark on free cards, and posted to Instagram like a session card.

import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { STORY_H, STORY_W } from '@/components/StoryCard';
import { TourneyCard } from '@/components/TourneyCard';
import { Button, Empty, ListGroup, T, tap, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { canShareStory, captureStory, shareStory } from '@/lib/instagram-story';
import { notice } from '@/lib/notice';
import { shareRef } from '@/lib/referrals';
import { useStore } from '@/store/store';
import { biggestScores, finishedTourneys, summarize } from '@/store/tourney-stats';
import { BRAND, C, R, S } from '@/theme';

export default function TournamentCardScreen() {
  const { cur, view } = useLocalSearchParams<{ cur?: string; view?: string }>();
  const { sessions, settings } = useStore();
  const pro = usePro();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Off by default: a record of cashes says enough, the amounts are the player's call.
  const [hideMoney, setHideMoney] = useState(true);
  const [brand, setBrand] = useState(true);
  const [busy, setBusy] = useState(false);
  const ref = useRef<React.ComponentRef<typeof View> | null>(null);
  const { currency, list } = useMemo(() => finishedTourneys(sessions, cur), [sessions, cur]);
  // Same view as the stats screen it came from, so the ROI on the card is the one the player just saw.
  const sum = useMemo(() => summarize(list, view === 'action' ? 'action' : 'mine'), [list, view]);
  const scores = useMemo(() => biggestScores(list, 3), [list]);
  const since = useMemo(() => Math.min(...list.map((s) => s.startedAt)), [list]);
  if (!list.length) return <Empty title={t('Ainda sem torneios terminados')} />;

  const scale = Math.min((width - 64) / STORY_W, (height * 0.6) / STORY_H, 1);
  const withBrand = brand || !pro.isPro;
  const post = async () => {
    tap('medium');
    setBusy(true);
    try {
      const code = await shareRef().catch(() => '');
      const link = `${BRAND.webUrl}/r/${code}?utm_source=instagram&utm_medium=story&utm_campaign=tourney_cv`;
      const target = await shareStory(await captureStory(ref), link);
      track('story_shared', { target: String(target), kind: 'tourney_cv', money: !hideMoney });
    } catch {
      notice(t('Não deu'), t('Não conseguimos abrir o Instagram. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Currículo de torneios') }} />
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingVertical: S.gutter, gap: S.lg, paddingBottom: 24, alignItems: 'center' }}>
        <View style={{ width: STORY_W * scale, height: STORY_H * scale, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: C.borderStrong }}>
          <View style={{ position: 'absolute', left: (STORY_W * scale - STORY_W) / 2, top: (STORY_H * scale - STORY_H) / 2, transform: [{ scale }] }}>
            <TourneyCard ref={ref} name={settings.nickname} sum={sum} scores={scores} currency={currency} since={since} hideMoney={hideMoney} brand={withBrand} />
          </View>
        </View>
        <View style={{ paddingHorizontal: S.gutter, alignSelf: 'stretch' }}>
          <ListGroup>
            <ToggleItem icon="eye-off-outline" title={t('Esconder valores')} subtitle={t('Mostra lugares e múltiplos do buy-in, sem dinheiro')} value={hideMoney} onChange={setHideMoney} />
            <ToggleItem icon="pricetag-outline" title={t('Com marca Sweatbook')} subtitle={pro.isPro ? undefined : t('Tirar a marca é do Pro')} value={withBrand} onChange={() => (pro.isPro ? setBrand((b) => !b) : pro.paywall('story'))} />
          </ListGroup>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: S.gutter, paddingTop: S.sm + 2, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgDeep }}>
        {canShareStory ? (
          <Button title={busy ? t('A preparar…') : t('Partilhar no Instagram')} icon="logo-instagram" disabled={busy} onPress={post} />
        ) : (
          <T v="small" style={{ textAlign: 'center' }}>
            {t('Abre a app no telemóvel para publicar no Instagram.')}
          </T>
        )}
      </View>
    </>
  );
}
