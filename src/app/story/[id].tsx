import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { STORY_H, STORY_W, StoryCard, voiceSlotPx } from '@/components/StoryCard';
import { Button, Chip, ChipRow, Empty, Field, ListGroup, Row, Segmented, T, tap, ToggleItem } from '@/components/ui';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { shareRef } from '@/lib/referrals';
import { canShareStory, captureFrame, captureStory, ensureShareId, renderReplayVideo, renderVoiceStory, sharePost, shareStory, shareVideo } from '@/lib/instagram-story';
import { shareLink } from '@/lib/share-api';
import { publicHand } from '@/poker/privacy';
import { sampleHand } from '@/poker/sample';
import { canAsk, storyMoment, type StoryMode } from '@/story/moment';
import { motionTimeline } from '@/components/replayer/timeline';
import { reelFrames } from '@/story/reel';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

const MAX_COMMENT = 140;
const PROMPTS = [t('Fold é melhor?'), t('Call ou fold?'), t('Como jogavas isto?'), t('Hero call ou spew?'), t('Cooler ou erro meu?')];

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hands, saveHand, settings } = useStore();
  const hand = useMemo(() => hands.find((h) => h.id === id) ?? (id === 'sample' ? sampleHand('sample') : undefined), [hands, id]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ask = hand ? canAsk(hand) : false;
  const [mode, setMode] = useState<StoryMode | 'video'>(ask ? 'question' : 'result');
  const video = mode === 'video';
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const pro = usePro();
  const [brand, setBrand] = useState(true);
  const [voice, setVoice] = useState<string | null>(null);
  const [voiceMs, setVoiceMs] = useState(0);
  // Video mode: the replay step on the card, and how far the frame capture got.
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  // What the voice chip shows: sample bars on screen, an empty slot while capturing for the video.
  const [chip, setChip] = useState<'preview' | 'slot' | null>('preview');
  const onVoice = useCallback((uri: string | null, ms?: number) => {
    setVoice(uri);
    setVoiceMs(ms ?? 0);
  }, []);
  const withVoice = !!voice && pro.isPro;
  const card = useRef<React.ComponentRef<typeof View>>(null);

  // The image goes public too: same privacy as the link.
  const shown = useMemo(() => (hand ? publicHand(hand, { names: settings.shareNames, notes: settings.shareNotes }) : undefined), [hand, settings.shareNames, settings.shareNotes]);
  const moment = useMemo(() => (shown ? storyMoment(shown, video ? 'result' : mode, settings.inBB) : null), [shown, mode, video, settings.inBB]);
  // The replayer's own motion timeline, so the video plays what the app shows.
  const motion = useMemo(() => (shown && moment ? motionTimeline(shown, moment.replay) : []), [shown, moment]);
  const reel = useMemo(() => (shown && moment ? reelFrames(shown, moment.replay, motion, withVoice ? voiceMs / 1000 : null) : []), [shown, moment, motion, withVoice, voiceMs]);

  // The preview plays the hand on a loop while video is picked.
  useEffect(() => {
    if (!video || busy || !reel.length) return;
    let j = 0;
    const id = setInterval(() => {
      j = (j + 1) % (reel.length + 2);
      setStep(Math.min(j, reel.length - 1));
    }, 900);
    return () => clearInterval(id);
  }, [video, busy, reel]);
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

  const postVideo = async () => {
    tap('medium');
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
      const ref = await shareRef();
      const link = shareLink(shareId, 'story', { quiz: false, ref });
      // One frame per key moment, captured from the card itself.
      if (withVoice) setChip('slot');
      const frames: string[] = [];
      for (let i = 0; i < reel.length; i++) {
        setProgress(t('A gravar a mão… {i}/{n}', { i: i + 1, n: reel.length }));
        setStep(i);
        // Two frames to lay out, then the table's 220 ms fade-in.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 280));
        frames.push(await captureFrame(card));
      }
      setChip('preview');
      setProgress(withVoice ? t('A juntar a tua voz…') : t('A montar o vídeo…'));
      const durations = reel.map((f) => f.sec);
      let file: string;
      try {
        file = await renderReplayVideo(frames, durations, withVoice ? voice : null, withVoice ? voiceSlotPx() : null);
      } catch {
        Alert.alert(t('Não deu para criar o vídeo'), t('Verifica a internet e tenta outra vez daqui a pouco.'));
        return;
      }
      await shareVideo(file, link);
      track('story_shared', { target: 'video', voice: withVoice, share_id: shareId, ref, question: false, frames: frames.length });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos criar o vídeo. Tenta outra vez.'));
    } finally {
      setChip('preview');
      setProgress(null);
      setBusy(false);
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

  // X: the card as a picture, the hand's replay link in the post text (a still; the video goes through "Criar vídeo da mão").
  const postX = async () => {
    tap('medium');
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
      const ref = await shareRef();
      const link = shareLink(shareId, 'x', { quiz: mode === 'question', ref });
      const text = comment.trim() || (mode === 'question' ? t('O que fazias nesta mão?') : t('Vê o replay da mão'));
      await sharePost([await captureStory(card)], `${text}\n${link}`);
      track('story_shared', { target: 'x', share_id: shareId, ref, question: mode === 'question' });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos preparar a imagem. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('Story no Instagram') }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.lg, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
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
                <StoryCard ref={card} hand={shown} moment={moment} comment={comment} inBB={settings.inBB} brand={brand || !pro.isPro} voice={withVoice ? chip : null} step={video ? (reel[step]?.k ?? 0) : undefined} at={video ? reel[step]?.at : undefined} />
              </View>
            </View>
          </View>

          <Segmented
            options={[
              { key: 'question', label: t('Pergunta') },
              { key: 'result', label: t('Resultado') },
              { key: 'video', label: t('Vídeo') },
            ]}
            value={mode}
            onChange={(m) => {
              if (m === 'question' && !ask) return;
              setStep(0);
              setMode(m);
            }}
          />
          <T v="small" style={{ textAlign: 'center', marginTop: -4 }}>
            {video
              ? t('A mão a jogar-se, em 15 a 30 segundos. Para Reels, TikTok e estado do WhatsApp.')
              : mode === 'question'
                ? t('Pára antes da tua decisão e esconde o resultado.')
                : t('Mostra a mão até ao fim, com as cartas e quem ganhou.')}
          </T>

          {canShareStory ? <VoiceRecorder uri={voice} onChange={onVoice} locked={!pro.isPro} onLocked={() => pro.paywall('story')} /> : null}

          <View style={{ gap: S.sm }}>
            <Field label={t('O teu comentário')} value={comment} onChangeText={(v) => setComment(v.slice(0, MAX_COMMENT))} placeholder={t('Ex.: Bolha a 58, ele só 3-betou uma vez em 3h. Fold?')} multiline inputStyle={{ minHeight: 72 }} />
            <ChipRow>
              {noteHint ? <Chip label={t('Usar as notas')} icon="document-text-outline" onPress={() => setComment(noteHint)} /> : null}
              {PROMPTS.map((p) => (
                <Chip key={p} label={p} onPress={() => setComment(p)} />
              ))}
            </ChipRow>
          </View>
          <ListGroup>
            <ToggleItem
              icon="pricetag-outline"
              title={t('Com marca Sweatbook')}
              subtitle={pro.isPro ? undefined : t('Tirar a marca é do Pro')}
              value={brand || !pro.isPro}
              onChange={() => (pro.isPro ? setBrand((b) => !b) : pro.paywall('story'))}
            />
          </ListGroup>
        </ScrollView>
        <View style={{ paddingHorizontal: S.gutter, paddingTop: S.sm + 2, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgDeep }}>
          {canShareStory && video ? (
            <Button title={progress ?? (busy ? t('A preparar…') : t('Criar vídeo da mão'))} icon="film-outline" disabled={busy} onPress={postVideo} />
          ) : canShareStory ? (
            <Row gap={S.sm}>
              <Button
                title={busy ? (withVoice ? t('A juntar a tua voz…') : t('A preparar…')) : t('Partilhar no Instagram')}
                icon="logo-instagram"
                disabled={busy}
                style={{ flex: 1 }}
                onPress={post}
              />
              {withVoice ? null : <Button kind="secondary" icon="logo-x" title="X" disabled={busy} style={{ width: 88 }} onPress={postX} />}
            </Row>
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
