// "O meu ano no póquer": the year in a few full-screen cards to swipe through
// and post as stories. Amounts start hidden. Free players see the first two
// cards; the rest are Pro, and free cards always say "Feito com Sweatbook".

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { STORY_H, STORY_W } from '@/components/StoryCard';
import { CardShareSheet } from '@/components/CardShareSheet';
import { Button, Chip, Empty, IconButton, Row, T, tap } from '@/components/ui';
import { YearCard } from '@/components/YearCard';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { canShareStory, captureStory, sharePost, shareStory } from '@/lib/instagram-story';
import { shareRef } from '@/lib/referrals';
import { countInSlices } from '@/lib/idle-count';
import { cachedPotBB, defaultYear, FREE_YEAR_CARDS, handsOfYear, reviewYears, YEAR_MIN_SESSIONS, yearCards, yearReview, type YearCardKind } from '@/share/year-review';
import { useStore } from '@/store/store';
import { BRAND, C, R, S } from '@/theme';

const CARD_TITLE: Record<YearCardKind, string> = {
  year: t('O teu ano'),
  best: t('Melhor sessão'),
  stakes: t('As tuas stakes'),
  bankroll: t('O ano na bankroll'),
  pot: t('Maior pote do ano'),
  streak: t('Semanas seguidas a registar'),
};

export default function YearScreen() {
  const { y } = useLocalSearchParams<{ y?: string }>();
  const { sessions, hands, players, settings } = useStore();
  const pro = usePro();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const years = useMemo(() => reviewYears(sessions), [sessions]);
  const [year, setYear] = useState(() => (y && Number(y)) || defaultYear(sessions) || years[0] || new Date().getFullYear());
  const [page, setPage] = useState(0);
  const [hideMoney, setHideMoney] = useState(true);
  const [brand, setBrand] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const refs = useRef<(React.ComponentRef<typeof View> | null)[]>([]);

  // The biggest pot replays every hand of the year: that runs in slices after the first frame, then the pot card joins.
  const [potsFor, setPotsFor] = useState<{ year: number; hands: typeof hands } | null>(null);
  useEffect(() => countInSlices(handsOfYear(hands, year), (h) => (cachedPotBB(h), false), () => setPotsFor({ year, hands })), [hands, year]);
  const potReady = potsFor?.year === year && potsFor.hands === hands;
  const review = useMemo(() => {
    const activity = [...hands.map((h) => h.createdAt), ...sessions.filter((x) => x.notes.trim()).map((x) => x.startedAt), ...players.map((p) => p.updatedAt)];
    return yearReview(year, sessions, hands, activity, settings.streakPauses ?? [], { pot: potReady });
  }, [year, sessions, hands, players, settings.streakPauses, potReady]);
  const cards = useMemo(() => yearCards(review), [review]);
  const kind = cards[Math.min(page, cards.length - 1)];
  const locked = !pro.isPro && page >= FREE_YEAR_CARDS;
  const withBrand = brand || !pro.isPro;

  const scale = Math.min((width - 48) / STORY_W, (height - insets.top - insets.bottom - 210) / STORY_H, 1);
  const go = (p: number) => {
    const n = Math.max(0, Math.min(cards.length - 1, p));
    pager.current?.scrollTo({ x: n * width, animated: true });
    if (n !== page) tap('select');
    setPage(n);
  };
  const pickYear = (v: number) => {
    tap('select');
    setYear(v);
    setPage(0);
    pager.current?.scrollTo({ x: 0, animated: false });
  };

  const post = async () => {
    tap('medium');
    setBusy(true);
    try {
      const ref = await shareRef().catch(() => '');
      const link = `${BRAND.webUrl}/r/${ref}?utm_source=instagram&utm_medium=story&utm_campaign=year`;
      const target = await shareStory(await captureStory({ current: refs.current[page] }), link);
      track('story_shared', { target: String(target), kind: 'year', card: kind, money: !hideMoney });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos abrir o Instagram. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  // Time and volume only; the result stays on the card if the player shows it there.
  const postText = async (to: 'x' | 'any') => {
    const ref = await shareRef().catch(() => '');
    const link = `${BRAND.webUrl}/r/${ref}?utm_source=${to === 'x' ? 'x' : 'app'}&utm_medium=post&utm_campaign=year`;
    const line = t('O meu {year} no póquer: {sessions} sessões, {hours} horas e {hands} mãos registadas.', {
      year,
      sessions: review.sessions,
      hours: Math.round(review.hours),
      hands: review.hands,
    });
    return `${line}\n${link}`;
  };

  const postTo = async (to: 'x' | 'any') => {
    tap('medium');
    setBusy(true);
    try {
      await sharePost([await captureStory({ current: refs.current[page] })], await postText(to), to);
      track('story_shared', { target: to, kind: 'year', card: kind, money: !hideMoney });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos preparar a imagem. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(await postText('any')).catch(() => {});
    Alert.alert(t('Link copiado'));
  };

  if (review.sessions < YEAR_MIN_SESSIONS) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.sm, paddingHorizontal: S.gutter }}>
        <Stack.Screen options={{ headerShown: false }} />
        <IconButton name="close" label={t('Fechar')} onPress={() => router.back()} />
        <Empty
          icon="sparkles-outline"
          title={t('Ainda não há um ano para ver')}
          body={t('Com {n} sessões terminadas no mesmo ano, o teu resumo aparece aqui.', { n: YEAR_MIN_SESSIONS })}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDeep, paddingTop: insets.top + S.xs }}>
      <Stack.Screen options={{ headerShown: false }} />
      <CardShareSheet visible={sheet} onClose={() => setSheet(false)} instagram={post} x={() => postTo('x')} other={() => postTo('any')} copy={copy} />

      {/* Story-style progress, one segment per card */}
      <Row gap={4} style={{ paddingHorizontal: S.gutter, paddingTop: S.xs }}>
        {cards.map((k, i) => (
          <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= page ? C.accent : C.surface3 }} />
        ))}
      </Row>
      <Row gap={S.sm} style={{ paddingHorizontal: S.sm, paddingTop: S.xs, minHeight: 48 }}>
        <IconButton name="close" label={t('Fechar')} onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T v="h3" numberOfLines={1}>
            {t('O meu ano no póquer')}
          </T>
          <T v="tiny" numberOfLines={1}>
            {CARD_TITLE[kind]} · {page + 1}/{cards.length}
          </T>
        </View>
        <IconButton
          name={hideMoney ? 'eye-off-outline' : 'eye-outline'}
          label={hideMoney ? t('Mostrar valores') : t('Esconder valores')}
          onPress={() => {
            tap('select');
            setHideMoney((h) => !h);
          }}
        />
      </Row>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        // onScroll, not onMomentumScrollEnd: the dots follow the swipe, and the web never fires momentum events.
        scrollEventThrottle={32}
        onScroll={(e) => {
          const p = Math.round(e.nativeEvent.contentOffset.x / width);
          if (p === page) return;
          tap('select');
          setPage(p);
        }}>
        {cards.map((k, i) => {
          const lock = !pro.isPro && i >= FREE_YEAR_CARDS;
          return (
            <View key={`${year}-${k}`} style={{ width, alignItems: 'center', paddingTop: S.sm }}>
              <View style={{ width: STORY_W * scale, height: STORY_H * scale, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: C.borderStrong }}>
                {lock ? (
                  <LockedCard title={CARD_TITLE[k]} onUnlock={() => pro.paywall('stats')} />
                ) : (
                  <View style={{ position: 'absolute', left: (STORY_W * scale - STORY_W) / 2, top: (STORY_H * scale - STORY_H) / 2, transform: [{ scale }] }}>
                    <YearCard ref={(r) => void (refs.current[i] = r)} review={review} kind={k} hideMoney={hideMoney} brand={withBrand} />
                  </View>
                )}
                {/* Tap the edges to step, like stories; swiping works too. */}
                {i > 0 ? <Pressable accessibilityLabel={t('Anterior')} onPress={() => go(i - 1)} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '25%' }} /> : null}
                {i < cards.length - 1 ? <Pressable accessibilityLabel={t('Seguinte')} onPress={() => go(i + 1)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '25%' }} /> : null}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: S.gutter, gap: S.sm, paddingBottom: Math.max(insets.bottom, 12), paddingTop: S.sm }}>
        <Row gap={S.sm} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {years.length > 1
            ? years.slice(0, 3).map((v) => <Chip key={v} label={String(v)} active={v === year} onPress={() => pickYear(v)} />)
            : null}
          <Chip
            icon="pricetag-outline"
            label={t('Com marca Sweatbook')}
            active={withBrand}
            onPress={() => (pro.isPro ? setBrand((b) => !b) : pro.paywall('story'))}
          />
        </Row>
        {locked ? (
          <Button title={t('Ver o ano todo com o Pro')} icon="lock-open-outline" onPress={() => pro.paywall('stats')} />
        ) : (
          <Row gap={S.sm}>
            {kind === 'pot' && review.pot ? (
              <Button kind="secondary" icon="play-outline" title={t('Ver a mão')} style={{ flex: 1 }} onPress={() => router.push(`/hand/${review.pot!.hand.id}`)} />
            ) : null}
            {canShareStory ? (
              <Button title={busy ? t('A preparar…') : t('Partilhar')} icon="share-outline" disabled={busy} style={{ flex: 2 }} onPress={() => setSheet(true)} />
            ) : (
              <T v="small" style={{ flex: 2, textAlign: 'center' }}>
                {t('Abre a app no telemóvel para publicar no Instagram.')}
              </T>
            )}
          </Row>
        )}
      </View>
    </View>
  );
}

/** What a free player sees on a Pro card: its title, never its numbers. */
function LockedCard({ title, onUnlock }: { title: string; onUnlock: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.md }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="lock-closed" size={26} color={C.accent} />
      </View>
      <T v="label">{t('Pro')}</T>
      <T v="h1" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T v="callout" style={{ textAlign: 'center' }}>
        {t('As stakes onde ganhaste mais, os teus meses, o maior pote e a tua sequência estão no Pro.')}
      </T>
      <Button kind="outline" size="sm" title={t('Desbloquear')} onPress={onUnlock} />
    </View>
  );
}
