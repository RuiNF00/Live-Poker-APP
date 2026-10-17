// Share a session: swipe between looks (dark, orange, transparent sticker for a
// photo of the table), hide the money if you'd rather, and post it to
// Instagram. Free cards always say "Feito com Sweatbook".

import { Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { SessionCard, STICKER_H, STICKER_W } from '@/components/SessionCard';
import { STORY_H, STORY_W } from '@/components/StoryCard';
import { Button, Empty, ListGroup, Row, T, tap, ToggleItem } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { canShareStory, captureSticker, captureStory, sharePost, shareSticker, shareStory } from '@/lib/instagram-story';
import { shareRef } from '@/lib/referrals';
import { CARD_STYLES, milestoneFor, sessionStats, type CardStyle } from '@/share/session-card';
import { useStore } from '@/store/store';
import { BRAND, C, R, S } from '@/theme';

const LOOK_NAME: Record<CardStyle, string> = { noite: t('Noite'), brasa: t('Brasa'), sticker: t('Sticker') };

export default function SessionCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, hands, settings } = useStore();
  const s = sessions.find((x) => x.id === id);
  const pro = usePro();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  // Privacy mode on: the card starts without amounts, so a result is never shared by accident.
  const [hideMoney, setHideMoney] = useState(!!settings.hideAmounts);
  const [brand, setBrand] = useState(true);
  const [showMilestone, setShowMilestone] = useState(true);
  const [busy, setBusy] = useState(false);
  const refs = useRef<(React.ComponentRef<typeof View> | null)[]>([]);

  const stats = useMemo(() => (s ? sessionStats(s, hands, hideMoney) : []), [s, hands, hideMoney]);
  const milestone = useMemo(() => (s ? milestoneFor(s, sessions, hands) : null), [s, sessions, hands]);
  if (!s) return <Empty title={t('Sessão não encontrada')} />;

  const pageW = width;
  const scale = Math.min((width - 64) / STORY_W, (height * 0.58) / STORY_H, 1);
  const look = CARD_STYLES[page];
  const withBrand = brand || !pro.isPro;

  const post = async () => {
    tap('medium');
    setBusy(true);
    try {
      const ref = await shareRef().catch(() => '');
      const link = `${BRAND.webUrl}/r/${ref}?utm_source=instagram&utm_medium=story&utm_campaign=session`;
      const node = { current: refs.current[page] };
      const target =
        look === 'sticker' ? await shareSticker(await captureSticker(node, STICKER_W, STICKER_H), link) : await shareStory(await captureStory(node), link);
      track('story_shared', { target: String(target), kind: 'session', look, money: !hideMoney, milestone: !!(milestone && showMilestone) });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos abrir o Instagram. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  // X: the same card as a picture in a post, with the invite link in the text.
  const postX = async () => {
    tap('medium');
    setBusy(true);
    try {
      const ref = await shareRef().catch(() => '');
      const link = `${BRAND.webUrl}/r/${ref}?utm_source=x&utm_medium=post&utm_campaign=session`;
      await sharePost([await captureStory({ current: refs.current[page] })], `${t('A minha sessão de póquer ao vivo')}\n${link}`);
      track('story_shared', { target: 'x', kind: 'session', look, money: !hideMoney });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos preparar a imagem. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Partilhar sessão') }} />
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingVertical: S.gutter, gap: S.lg, paddingBottom: 24 }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const p = Math.round(e.nativeEvent.contentOffset.x / pageW);
            if (p !== page) tap('select');
            setPage(p);
          }}>
          {CARD_STYLES.map((k, i) => (
            <View key={k} style={{ width: pageW, alignItems: 'center' }}>
              <View style={{ width: STORY_W * scale, height: STORY_H * scale, borderRadius: R.xl, overflow: 'hidden', borderWidth: 1, borderColor: C.borderStrong }}>
                {k === 'sticker' ? (
                  // A felt backdrop stands in for the photo the sticker goes on.
                  <LinearGradient colors={['#1F5A47', '#123327', '#0C1311']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ transform: [{ scale: Math.max(scale, 0.85) }] }}>
                      <SessionCard ref={(r) => void (refs.current[i] = r)} session={s} stats={stats} look={k} brand={withBrand} />
                    </View>
                    <T v="tiny" color="rgba(238,242,239,0.7)" style={{ position: 'absolute', bottom: 14 }}>
                      {t('Fundo transparente: põe-no por cima da foto da mesa')}
                    </T>
                  </LinearGradient>
                ) : (
                  <View style={{ position: 'absolute', left: (STORY_W * scale - STORY_W) / 2, top: (STORY_H * scale - STORY_H) / 2, transform: [{ scale }] }}>
                    <SessionCard
                      ref={(r) => void (refs.current[i] = r)}
                      session={s}
                      stats={stats}
                      look={k}
                      milestone={showMilestone ? milestone : null}
                      hideMoney={hideMoney}
                      brand={withBrand}
                    />
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        <Row gap={6} style={{ justifyContent: 'center' }}>
          {CARD_STYLES.map((k, i) => (
            <View key={k} style={{ height: 6, width: i === page ? 18 : 6, borderRadius: 3, backgroundColor: i === page ? C.accent : C.borderStrong }} />
          ))}
        </Row>
        <T v="small" style={{ textAlign: 'center', marginTop: -S.sm }}>
          {LOOK_NAME[look]} · {t('Desliza para outro estilo')}
        </T>

        <View style={{ paddingHorizontal: S.gutter }}>
          <ListGroup>
            <ToggleItem icon="eye-off-outline" title={t('Esconder valores')} subtitle={t('Mostra horas, mãos e potes em bb, sem €')} value={hideMoney} onChange={setHideMoney} />
            {milestone ? <ToggleItem icon="trophy-outline" title={t('Mostrar marco')} subtitle={milestone.title} value={showMilestone} onChange={setShowMilestone} /> : null}
            <ToggleItem
              icon="pricetag-outline"
              title={t('Com marca Sweatbook')}
              subtitle={pro.isPro ? undefined : t('Tirar a marca é do Pro')}
              value={withBrand}
              onChange={() => (pro.isPro ? setBrand((b) => !b) : pro.paywall('story'))}
            />
          </ListGroup>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: S.gutter, paddingTop: S.sm + 2, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgDeep }}>
        {canShareStory ? (
          <Row gap={S.sm}>
            <Button title={busy ? t('A preparar…') : t('Partilhar no Instagram')} icon="logo-instagram" disabled={busy} style={{ flex: 1 }} onPress={post} />
            {look === 'sticker' ? null : <Button kind="secondary" icon="logo-x" title="X" disabled={busy} style={{ width: 88 }} onPress={postX} />}
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
