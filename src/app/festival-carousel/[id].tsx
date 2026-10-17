// The festival as an Instagram carousel for the feed: the summary, the best
// hand, the events, the trip day by day and a closing slide, all 4:5. Same
// privacy as the story: no amount unless the player turns it on, no venue.
// The caption carries the invite link and is copied, since Instagram doesn't
// take a caption from another app.

import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { FestivalSlide, SLIDE_H, SLIDE_W } from '@/components/FestivalCarousel';
import { Button, Empty, ListGroup, Row, T, tap, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { canShareStory, captureSlide, shareCarousel, sharePost } from '@/lib/instagram-story';
import { shareRef } from '@/lib/referrals';
import { carouselCaption, carouselSlides, eventRows, festivalRecap, recapStats } from '@/share/festival-card';
import { useStore } from '@/store/store';
import { BRAND, C, R, S, ff } from '@/theme';

export default function FestivalCarouselScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, sessions, hands } = useStore();
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
  const [copied, setCopied] = useState(false);
  const [ref, setRef] = useState('');
  const refs = useRef<(React.ComponentRef<typeof View> | null)[]>([]);

  useEffect(() => {
    shareRef()
      .then(setRef)
      .catch(() => {});
  }, []);

  const recap = useMemo(() => (trip ? festivalRecap(trip, sessions, hands) : null), [trip, sessions, hands]);
  const events = useMemo(() => (trip ? eventRows(trip, sessions) : []), [trip, sessions]);
  if (!trip || !recap) return <Empty title={t('Esta viagem já não existe')} />;

  const withBrand = brand || !pro.isPro;
  const slides = carouselSlides(recap, events, { showHand, brand: withBrand });
  const stats = recapStats(recap);
  const scale = Math.min((width - 48) / SLIDE_W, (height * 0.5) / SLIDE_H, 1);
  const link = `${BRAND.webUrl}/r/${ref}?utm_source=instagram&utm_medium=carousel&utm_campaign=festival`;
  const caption = carouselCaption(recap, link, { showResult, showMoney });

  const copy = async () => {
    tap('light');
    await Clipboard.setStringAsync(caption).catch(() => {});
    setCopied(true);
  };

  const post = async () => {
    tap('medium');
    setBusy(true);
    try {
      const files: string[] = [];
      for (let i = 0; i < slides.length; i++) files.push(await captureSlide({ current: refs.current[i] }));
      const target = await shareCarousel(files, caption);
      setCopied(true);
      track('story_shared', { target: String(target), kind: 'festival_carousel', slides: slides.length, money: showMoney, result: showResult, hand: slides.includes('hand') });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos preparar o carrossel. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  // X takes 4 images a post: the closing slide is the one left out (the link is in the text).
  const postX = async () => {
    tap('medium');
    setBusy(true);
    try {
      const files: string[] = [];
      for (let i = 0; i < slides.length && files.length < 4; i++) if (slides[i] !== 'close') files.push(await captureSlide({ current: refs.current[i] }));
      const xLink = `${BRAND.webUrl}/r/${ref}?utm_source=x&utm_medium=post&utm_campaign=festival`;
      await sharePost(files, carouselCaption(recap, xLink, { showResult, showMoney }));
      track('story_shared', { target: 'x', kind: 'festival_carousel', slides: files.length, money: showMoney });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos preparar o carrossel. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Carrossel do festival') }} />
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingVertical: S.gutter, gap: S.lg, paddingBottom: 24 }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const p = Math.round(e.nativeEvent.contentOffset.x / width);
            if (p !== page) tap('select');
            setPage(p);
          }}>
          {slides.map((k, i) => (
            <View key={k} style={{ width, alignItems: 'center' }}>
              <View style={{ width: SLIDE_W * scale, height: SLIDE_H * scale, borderRadius: R.lg, overflow: 'hidden', borderWidth: 1, borderColor: C.borderStrong }}>
                <View style={{ position: 'absolute', left: (SLIDE_W * scale - SLIDE_W) / 2, top: (SLIDE_H * scale - SLIDE_H) / 2, transform: [{ scale }] }}>
                  <FestivalSlide
                    ref={(r) => void (refs.current[i] = r)}
                    kind={k}
                    index={i}
                    count={slides.length}
                    recap={recap}
                    stats={stats}
                    events={events}
                    showMoney={showMoney}
                    showResult={showResult}
                    brand={withBrand}
                  />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <Row gap={6} style={{ justifyContent: 'center' }}>
          {slides.map((k, i) => (
            <View key={k} style={{ height: 6, width: i === page ? 18 : 6, borderRadius: 3, backgroundColor: i === page ? C.accent : C.borderStrong }} />
          ))}
        </Row>
        <T v="small" style={{ textAlign: 'center', marginTop: -S.sm }}>
          {t('{n} imagens 4:5 para o feed', { n: slides.length })}
        </T>

        <View style={{ paddingHorizontal: S.gutter, gap: S.lg }}>
          <ListGroup>
            <ToggleItem
              icon="trending-up-outline"
              title={t('Mostrar resultado')}
              subtitle={recap.result?.unit === 'bb' ? t('Em big blinds') : t('Em buy-ins, sem valores')}
              value={showResult}
              onChange={setShowResult}
            />
            <ToggleItem icon="cash-outline" title={t('Mostrar valores')} subtitle={t('Junta o resultado do póquer em {c}, sem as despesas da viagem', { c: recap.currency })} value={showMoney} onChange={setShowMoney} />
            {recap.bestHand ? <ToggleItem icon="play-circle-outline" title={t('Melhor mão')} subtitle={t('A mesa no fim da mão, em big blinds')} value={showHand} onChange={setShowHand} /> : null}
            <ToggleItem
              icon="pricetag-outline"
              title={t('Com marca Sweatbook')}
              subtitle={pro.isPro ? undefined : t('Tirar a marca é do Pro')}
              value={withBrand}
              onChange={() => (pro.isPro ? setBrand((b) => !b) : pro.paywall('story'))}
            />
          </ListGroup>

          <View style={{ gap: S.sm }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="label">{t('Legenda')}</T>
              <Pressable onPress={copy} hitSlop={12} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontFamily: ff(700), fontSize: 15, color: C.accent }}>{copied ? t('Copiada') : t('Copiar')}</Text>
              </Pressable>
            </Row>
            <View style={{ backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: S.md }}>
              <Text selectable style={{ fontFamily: ff(500), fontSize: 14, lineHeight: 20, color: C.textDim }}>
                {caption}
              </Text>
            </View>
            <T v="small">{t('O Instagram não aceita a legenda de outra app: fica copiada, é só colar.')}</T>
          </View>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: S.gutter, paddingTop: S.sm + 2, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgDeep }}>
        {canShareStory ? (
          <Row gap={S.sm}>
            <Button title={busy ? t('A preparar…') : t('Publicar no feed')} icon="logo-instagram" disabled={busy} style={{ flex: 1 }} onPress={post} />
            <Button kind="secondary" icon="logo-x" title="X" disabled={busy} style={{ width: 88 }} onPress={postX} />
          </Row>
        ) : (
          <T v="small" style={{ textAlign: 'center' }}>
            {t('Abre a app no telemóvel para publicar no Instagram.')}
          </T>
        )}
      </View>
    </>
  );
}
