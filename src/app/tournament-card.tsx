// Share the tournament record: amounts off by default, the Sweatbook mark on
// free cards, on the same Partilhar sheet as a session card (Story, WhatsApp,
// X at 4:5, copy, other apps), the destination used last as the button.

import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { CardShareSheet } from '@/components/CardShareSheet';
import { STORY_H, STORY_W } from '@/components/StoryCard';
import { TourneyCard } from '@/components/TourneyCard';
import { Button, Empty, IconButton, ListGroup, Row, T, tap, ToggleItem } from '@/components/ui';
import { t, variant } from '@/i18n';
import { withLang } from '@/lib/link-lang';
import { track } from '@/lib/events';
import { canShareStory, capturePost, captureStory, sharePost, shareStory } from '@/lib/instagram-story';
import { notice } from '@/lib/notice';
import { shareRef } from '@/lib/referrals';
import { lastShare, rememberShare } from '@/lib/share-last';
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
  const [sheet, setSheet] = useState(false);
  const ref = useRef<React.ComponentRef<typeof View> | null>(null);
  const postCard = useRef<React.ComponentRef<typeof View>>(null);
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
      const link = withLang(`${BRAND.webUrl}/r/${code}?utm_source=instagram&utm_medium=story&utm_campaign=tourney_cv`, variant);
      const target = await shareStory(await captureStory(ref), link);
      track('story_shared', { target: String(target), kind: 'tourney_cv', money: !hideMoney });
    } catch {
      notice(t('Não deu'), t('Não conseguimos abrir o Instagram. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  // Counts only: cashes and ITM; amounts stay on the card when the player shows them there.
  const postText = async (to: 'x' | 'whatsapp' | 'any') => {
    const code = await shareRef().catch(() => '');
    const link = withLang(`${BRAND.webUrl}/r/${code}?utm_source=${to === 'any' ? 'app' : to}&utm_medium=post&utm_campaign=tourney_cv`, variant);
    return `${t('{n} torneios, {c} cashes.', { n: sum.count, c: sum.cashes })}\n${link}`;
  };
  const postTo = async (to: 'x' | 'whatsapp' | 'any') => {
    tap('medium');
    setBusy(true);
    try {
      await sharePost([await capturePost(postCard)], await postText(to), to);
      track('story_shared', { target: to, kind: 'tourney_cv', money: !hideMoney });
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

  // The destination used last is the button (as on the session card); the sheet is on "…".
  const last = lastShare();
  const quick =
    last === 'instagram'
      ? { icon: 'logo-instagram' as const, label: t('Story no Instagram') }
      : last === 'whatsapp'
        ? { icon: 'logo-whatsapp' as const, label: 'WhatsApp' }
        : last === 'x'
          ? { icon: 'logo-x' as const, label: t('Publicar no X') }
          : last === 'copy'
            ? { icon: 'link-outline' as const, label: t('Copiar link') }
            : null;
  const sendLast = () => {
    if (!last) return;
    rememberShare(last);
    if (last === 'instagram') void post();
    else if (last === 'whatsapp' || last === 'x') void postTo(last);
    else if (last === 'copy') void copy();
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Currículo de torneios') }} />
      <CardShareSheet visible={sheet} onClose={() => setSheet(false)} instagram={post} whatsapp={() => postTo('whatsapp')} x={() => postTo('x')} other={() => postTo('any')} copy={copy} />
      {/* The 4:5 copy for X and other apps: drawn off screen, only ever captured. */}
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ position: 'absolute', left: -2 * STORY_W, top: 0 }}>
        <TourneyCard ref={postCard} name={settings.nickname} sum={sum} scores={scores} currency={currency} since={since} hideMoney={hideMoney} brand={withBrand} format="post" />
      </View>
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
          quick && !busy ? (
            <Row gap={S.sm}>
              <Button title={quick.label} icon={quick.icon} onPress={sendLast} style={{ flex: 1 }} />
              <IconButton name="ellipsis-horizontal" size={46} label={t('Mais formas de partilhar')} onPress={() => setSheet(true)} />
            </Row>
          ) : (
            <Button title={busy ? t('A preparar…') : t('Partilhar')} icon="share-outline" disabled={busy} onPress={() => setSheet(true)} />
          )
        ) : (
          <T v="small" style={{ textAlign: 'center' }}>
            {t('Abre a app no telemóvel para publicar no Instagram.')}
          </T>
        )}
      </View>
    </>
  );
}
