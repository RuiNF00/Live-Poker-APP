// Share a festival when it's over: one story with the days played, events,
// cashes, the best hand and the result in buy-ins. Private by default: no
// amount shows unless the player turns it on. The link sticker opens the best
// hand's replay (or the invite page when the hand isn't shown). Free cards
// always say "Feito com Sweatbook".

import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { FESTIVAL_LOOKS, FestivalCard } from '@/components/FestivalCard';
import { CardShareSheet } from '@/components/CardShareSheet';
import { STORY_H, STORY_W } from '@/components/StoryCard';
import { Button, Empty, ListGroup, ListItem, Row, T, tap, ToggleItem } from '@/components/ui';
import { t, variant } from '@/i18n';
import { withLang } from '@/lib/link-lang';
import { track } from '@/lib/events';
import { canShareStory, captureStory, ensureShareId, sharePost, shareStory } from '@/lib/instagram-story';
import { notice } from '@/lib/notice';
import { shareRef } from '@/lib/referrals';
import { shareLink } from '@/lib/share-api';
import { carouselCaption, festivalRecap, recapStats } from '@/share/festival-card';
import { useStore } from '@/store/store';
import { BRAND, C, R, S } from '@/theme';

const LOOK_NAME = { noite: t('Noite'), brasa: t('Brasa') };

export default function FestivalCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, sessions, hands, settings, saveHand } = useStore();
  const trip = trips.find((x) => x.id === id);
  const pro = usePro();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  // Private by default: amounts only when the player asks for them.
  const [showMoney, setShowMoney] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const [showHand, setShowHand] = useState(true);
  const [brand, setBrand] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const refs = useRef<(React.ComponentRef<typeof View> | null)[]>([]);

  const recap = useMemo(() => (trip ? festivalRecap(trip, sessions, hands) : null), [trip, sessions, hands]);
  if (!trip || !recap) return <Empty title={t('Esta viagem já não existe')} />;

  const stats = recapStats(recap);
  const scale = Math.min((width - 64) / STORY_W, (height * 0.58) / STORY_H, 1);
  const look = FESTIVAL_LOOKS[page];
  const withBrand = brand || !pro.isPro;
  const best = showHand ? recap.bestHand : null;

  const post = async () => {
    tap('medium');
    setBusy(true);
    try {
      const ref = await shareRef().catch(() => '');
      let link = withLang(`${BRAND.webUrl}/r/${ref}?utm_source=instagram&utm_medium=story&utm_campaign=festival`, variant);
      // The best hand's replay is the link, when the player can still make one today.
      if (best && (best.hand.shareId || pro.canShare())) {
        try {
          const isNew = !best.hand.shareId;
          const shareId = await ensureShareId(best.hand, saveHand, { names: settings.shareNames, notes: settings.shareNotes });
          if (isNew) pro.record('share');
          link = shareLink(shareId, 'story', { ref });
        } catch {
          // Offline: the invite link still works.
        }
      }
      const target = await shareStory(await captureStory({ current: refs.current[page] }), link);
      track('story_shared', { target: String(target), kind: 'festival', look, money: showMoney, result: showResult, hand: !!best, days: recap.days, events: recap.events });
    } catch {
      notice(t('Não deu'), t('Não conseguimos abrir o Instagram. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  // X: the card as a picture with the best hand's replay (or the invite) in the post text.
  // The post text (same as the carousel caption) with the best hand's replay, or the invite.
  const postText = async (to: 'x' | 'whatsapp' | 'any') => {
    const ref = await shareRef().catch(() => '');
    let link = withLang(`${BRAND.webUrl}/r/${ref}?utm_source=${to === 'any' ? 'app' : to}&utm_medium=post&utm_campaign=festival`, variant);
    if (best?.hand.shareId) link = shareLink(best.hand.shareId, to === 'any' ? 'link' : to, { ref });
    return carouselCaption(recap, link, { showResult, showMoney });
  };

  const postTo = async (to: 'x' | 'whatsapp' | 'any') => {
    tap('medium');
    setBusy(true);
    try {
      await sharePost([await captureStory({ current: refs.current[page] })], await postText(to), to);
      track('story_shared', { target: to, kind: 'festival', look, money: showMoney });
    } catch {
      notice(t('Não deu'), t('Não conseguimos preparar a imagem. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(await postText('any')).catch(() => {});
    notice(t('Link copiado'));
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Partilhar festival') }} />
      <CardShareSheet visible={sheet} onClose={() => setSheet(false)} instagram={post} whatsapp={() => postTo('whatsapp')} x={() => postTo('x')} other={() => postTo('any')} copy={copy} />
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingVertical: S.gutter, gap: S.lg, paddingBottom: 24 }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // onScroll, not onMomentumScrollEnd: the dots follow the swipe, and the web never fires momentum events.
          scrollEventThrottle={32}
          onScroll={(e) => {
            const p = Math.round(e.nativeEvent.contentOffset.x / width);
            if (p === page) return;
            tap('select');
            setPage(p);
          }}>
          {FESTIVAL_LOOKS.map((k, i) => (
            <View key={k} style={{ width, alignItems: 'center' }}>
              <View style={{ width: STORY_W * scale, height: STORY_H * scale, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: C.borderStrong }}>
                <View style={{ position: 'absolute', left: (STORY_W * scale - STORY_W) / 2, top: (STORY_H * scale - STORY_H) / 2, transform: [{ scale }] }}>
                  <FestivalCard
                    ref={(r) => void (refs.current[i] = r)}
                    recap={recap}
                    stats={stats}
                    look={k}
                    showMoney={showMoney}
                    showResult={showResult}
                    showHand={showHand}
                    brand={withBrand}
                  />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <Row gap={6} style={{ justifyContent: 'center' }}>
          {FESTIVAL_LOOKS.map((k, i) => (
            <View key={k} style={{ height: 6, width: i === page ? 18 : 6, borderRadius: 3, backgroundColor: i === page ? C.accent : C.borderStrong }} />
          ))}
        </Row>
        <T v="small" style={{ textAlign: 'center', marginTop: -S.sm }}>
          {LOOK_NAME[look]} · {t('Desliza para outro estilo')}
        </T>

        <View style={{ paddingHorizontal: S.gutter }}>
          <ListGroup>
            <ToggleItem
              icon="trending-up-outline"
              title={t('Mostrar resultado')}
              subtitle={recap.result?.unit === 'bb' ? t('Em big blinds') : t('Em buy-ins, sem valores')}
              value={showResult}
              onChange={setShowResult}
            />
            <ToggleItem icon="cash-outline" title={t('Mostrar valores')} subtitle={t('Junta o resultado do póquer em {c}, sem as despesas da viagem', { c: recap.currency })} value={showMoney} onChange={setShowMoney} />
            {recap.bestHand ? (
              <ToggleItem icon="play-circle-outline" title={t('Melhor mão')} subtitle={t('O link da story abre o replay')} value={showHand} onChange={setShowHand} />
            ) : null}
            <ToggleItem
              icon="pricetag-outline"
              title={t('Com marca Sweatbook')}
              subtitle={pro.isPro ? undefined : t('Tirar a marca é do Pro')}
              value={withBrand}
              onChange={() => (pro.isPro ? setBrand((b) => !b) : pro.paywall('story'))}
            />
          </ListGroup>
          <ListGroup style={{ marginTop: S.lg }}>
            <ListItem
              icon="albums-outline"
              title={t('Carrossel para o feed')}
              subtitle={t('Várias imagens 4:5: resumo, melhor mão, eventos e dias')}
              chevron
              onPress={() => router.push({ pathname: '/festival-carousel/[id]', params: { id: trip.id } })}
            />
          </ListGroup>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: S.gutter, paddingTop: S.sm + 2, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgDeep }}>
        {canShareStory ? (
          <Button title={busy ? t('A preparar…') : t('Partilhar')} icon="share-outline" disabled={busy} onPress={() => setSheet(true)} />
        ) : (
          <T v="small" style={{ textAlign: 'center' }}>
            {t('Abre a app no telemóvel para publicar no Instagram.')}
          </T>
        )}
      </View>
    </>
  );
}
