import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { STORY_H, STORY_W, StoryCard, voiceSlotPx } from '@/components/StoryCard';
import { Button, Chip, Empty, Row, T, tap } from '@/components/ui';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { shareRef } from '@/lib/referrals';
import { canShareStory, captureStory, ensureShareId, renderVoiceStory, shareStory } from '@/lib/instagram-story';
import { shareLink } from '@/lib/share-api';
import { publicHand } from '@/poker/privacy';
import { sampleHand } from '@/poker/sample';
import { canAsk, storyMoment, type StoryMode } from '@/story/moment';
import { useStore } from '@/store/store';
import { C, F, R } from '@/theme';

const MAX_COMMENT = 140;
const PROMPTS = [t('Fold é melhor?'), t('Call ou fold?'), t('Como jogavas isto?'), t('Hero call ou spew?'), t('Cooler ou erro meu?')];

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hands, saveHand, settings } = useStore();
  const hand = useMemo(() => hands.find((h) => h.id === id) ?? (id === 'sample' ? sampleHand('sample') : undefined), [hands, id]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ask = hand ? canAsk(hand) : false;
  const [mode, setMode] = useState<StoryMode>(ask ? 'question' : 'result');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const pro = usePro();
  const [brand, setBrand] = useState(true);
  const [voice, setVoice] = useState<string | null>(null);
  // What the voice chip shows: sample bars on screen, an empty slot while capturing for the video.
  const [chip, setChip] = useState<'preview' | 'slot' | null>('preview');
  const onVoice = useCallback((uri: string | null) => setVoice(uri), []);
  const withVoice = !!voice && pro.isPro;
  const card = useRef<React.ComponentRef<typeof View>>(null);

  // The image goes public too: same privacy as the link.
  const shown = useMemo(() => (hand ? publicHand(hand, { names: settings.shareNames, notes: settings.shareNotes }) : undefined), [hand, settings.shareNames, settings.shareNotes]);
  const moment = useMemo(() => (shown ? storyMoment(shown, mode, settings.inBB) : null), [shown, mode, settings.inBB]);
  if (!hand || !shown || !moment) return <Empty title={t('Mão não encontrada')} />;

  // Preview fits the screen; the captured view inside stays 360×640.
  const scale = Math.min((width - 64) / STORY_W, (height * 0.56) / STORY_H, 1);
  const noteHint = hand.notes.trim().split(/(?<=[.?!])\s/)[0]?.slice(0, MAX_COMMENT);

  const captureAs = async (c: 'slot' | null) => {
    setChip(c);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      return await captureStory(card);
    } finally {
      setChip('preview');
    }
  };

  const post = async () => {
    tap('medium');
    // A story creates the hand's public link, so it counts as the free plan's daily share.
    const isNew = !hand.shareId;
    if (isNew && !pro.canShare()) {
      pro.paywall('shares');
      return;
    }
    setBusy(true);
    try {
      let shareId: string;
      try {
        shareId = await ensureShareId(hand, saveHand, { names: settings.shareNames, notes: settings.shareNotes });
      } catch {
        Alert.alert(t('Sem ligação'), t('Precisamos de internet para criar o link da mão. Tenta outra vez daqui a pouco.'));
        return;
      }
      if (isNew) pro.record('share');
      // Question stories open the challenge view: vote first, result after.
      const ref = await shareRef();
      const link = shareLink(shareId, 'story', { quiz: mode === 'question', ref });
      let target;
      if (withVoice && voice) {
        // Capture with the waveform slot empty; the server animates it over the voice.
        const frame = await captureAs('slot');
        let video: string | null = null;
        try {
          video = await renderVoiceStory(frame, voice, voiceSlotPx());
        } catch {
          const goOn = await new Promise<boolean>((resolve) =>
            Alert.alert(t('Não deu para juntar a voz'), t('Podes publicar a história sem voz ou tentar daqui a pouco.'), [
              { text: t('Cancelar'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('Sem voz'), onPress: () => resolve(true) },
            ]),
          );
          if (!goOn) return;
        }
        target = video ? await shareStory(video, link, 'video') : await shareStory(await captureAs(null), link);
      } else {
        target = await shareStory(await captureStory(card), link);
      }
      track('story_shared', { target: String(target), voice: !!voice, share_id: shareId, ref, question: mode === 'question' });
      if (target === 'sheet') Alert.alert(t('Link copiado'), t('No Instagram, escolhe Story e cola o link num sticker de Link para os teus amigos votarem.'));
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos abrir o Instagram. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Story no Instagram') }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: STORY_W * scale,
                height: STORY_H * scale,
                borderRadius: R.xl,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: C.borderStrong,
              }}>
              <View
                style={{
                  position: 'absolute',
                  left: (STORY_W * scale - STORY_W) / 2,
                  top: (STORY_H * scale - STORY_H) / 2,
                  transform: [{ scale }],
                }}>
                <StoryCard ref={card} hand={shown} moment={moment} comment={comment} inBB={settings.inBB} brand={brand || !pro.isPro} voice={withVoice ? chip : null} />
              </View>
            </View>
          </View>

          <Row gap={8} style={{ justifyContent: 'center' }}>
            <Chip label={t('Pergunta')} active={mode === 'question'} onPress={() => ask && setMode('question')} style={!ask ? { opacity: 0.4 } : null} />
            <Chip label={t('Resultado')} active={mode === 'result'} onPress={() => setMode('result')} />
            <Chip
              label={pro.isPro ? t('Com marca') : t('Com marca') + ' · Pro'}
              active={brand || !pro.isPro}
              color={C.textDim}
              onPress={() => (pro.isPro ? setBrand((b) => !b) : pro.paywall('story'))}
            />
          </Row>
          <T v="tiny" style={{ textAlign: 'center', marginTop: -6 }}>
            {mode === 'question'
              ? t('Pára antes da tua decisão e esconde o resultado. Quem quiser saber tem de abrir o link.')
              : t('Mostra a mão até ao fim, com as cartas e quem ganhou.')}
          </T>

          {canShareStory ? <VoiceRecorder uri={voice} onChange={onVoice} locked={!pro.isPro} onLocked={() => pro.paywall('story')} /> : null}

          <View style={{ gap: 8 }}>
            <T v="label">{t('O teu comentário')}</T>
            <TextInput
              value={comment}
              onChangeText={(v) => setComment(v.slice(0, MAX_COMMENT))}
              placeholder={t('Ex.: Bolha a 58, ele só 3-betou uma vez em 3h. Fold?')}
              placeholderTextColor={C.muted}
              multiline
              style={{
                backgroundColor: C.surface,
                borderRadius: R.md,
                borderWidth: 1,
                borderColor: C.border,
                color: C.text,
                fontFamily: F.medium,
                fontSize: 16,
                minHeight: 64,
                padding: 12,
                textAlignVertical: 'top',
              }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {noteHint ? <Chip label={t('Usar as notas')} onPress={() => setComment(noteHint)} /> : null}
              {PROMPTS.map((p) => (
                <Chip key={p} label={p} onPress={() => setComment(p)} />
              ))}
            </ScrollView>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg }}>
          {canShareStory ? (
            <Button
              title={busy ? (withVoice ? t('A juntar a tua voz…') : t('A preparar…')) : t('Partilhar no Instagram')}
              icon={<Ionicons name="logo-instagram" size={19} color={C.accentInk} />}
              disabled={busy}
              onPress={post}
            />
          ) : (
            <T v="small" style={{ textAlign: 'center' }}>
              {t('Abre a app no telemóvel para publicar no Instagram.')}
            </T>
          )}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
