import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { CardShareSheet } from '@/components/CardShareSheet';
import { STORY_H, STORY_W, StoryCard, voiceSlotPx } from '@/components/StoryCard';
import { Button, Chip, ChipRow, Empty, Field, ListGroup, Segmented, T, tap, ToggleItem } from '@/components/ui';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { shareRef } from '@/lib/referrals';
import { canMakeVideo, canShareStory, captureFrame, captureStory, ensureShareId, renderReplayVideo, renderVoiceStory, sharePost, shareStory, shareVideo } from '@/lib/instagram-story';
import { shareLink } from '@/lib/share-api';
import { notice } from '@/lib/notice';
import { publicHand } from '@/poker/privacy';
import { sampleHand } from '@/poker/sample';
import { canAsk, storyMoment, type StoryMode } from '@/story/moment';
import { motionTimeline } from '@/components/replayer/timeline';
import { handShareText } from '@/share/share-text';
import { reelFrames } from '@/story/reel';
import { useStore } from '@/store/store';
import { C, R, S } from '@/theme';

const MAX_COMMENT = 140;
const PROMPTS = [t('Fold é melhor?'), t('Call ou fold?'), t('Como jogavas isto?'), t('Hero call ou spew?'), t('Cooler ou erro meu?')];

export default function StoryScreen() {
  // `to=instagram`: Instagram was already picked in the hand's Partilhar sheet, so the button goes straight there.
  // `ask`: the "O que queres saber?" typed in that sheet; it opens as the story's comment and goes with the link.
  const { id, to, ask: asked } = useLocalSearchParams<{ id: string; to?: string; ask?: string }>();
  const { hands, saveHand, settings } = useStore();
  const hand = useMemo(() => hands.find((h) => h.id === id) ?? (id === 'sample' ? sampleHand('sample') : undefined), [hands, id]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ask = hand ? canAsk(hand) : false;
  const [mode, setMode] = useState<StoryMode | 'video'>(ask ? 'question' : 'result');
  const video = mode === 'video';
  const [comment, setComment] = useState(() => (asked || hand?.ask || '').slice(0, MAX_COMMENT));
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const pro = usePro();
  const [brand, setBrand] = useState(true);
  const [voice, setVoice] = useState<string | null>(null);
  const [voiceMs, setVoiceMs] = useState(0);
  // Video mode: the replay step on the card, and how far the frame capture got.
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  // What the voice chip shows: sample bars on screen, an empty slot while capturing for the video.
  const [chip, setChip] = useState<'preview' | 'slot' | null>('preview');
  // Question stories: Instagram gets an empty space for its Poll sticker, other apps get the options drawn.
  const [capture, setCapture] = useState<'preview' | 'instagram' | 'post'>('preview');
  const onVoice = useCallback((uri: string | null, ms?: number) => {
    setVoice(uri);
    setVoiceMs(ms ?? 0);
  }, []);
  const withVoice = !!voice && pro.isPro;
  const direct = withVoice || to === 'instagram';
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
  // A link made from here carries the question too, like one made from the Partilhar sheet.
  const linked = !hand.shareId && !hand.ask && asked?.trim() ? { ...hand, ask: asked.trim().slice(0, 140) } : hand;

  // Preview fits the screen; the captured view inside stays 360×640.
  const scale = Math.min((width - 64) / STORY_W, (height * 0.56) / STORY_H, 1);
  const noteHint = hand.notes.trim().split(/(?<=[.?!])\s/)[0]?.slice(0, MAX_COMMENT);

  const captureAs = async (c: 'slot' | 'preview' | null, to: 'instagram' | 'post' = 'instagram') => {
    setChip(c);
    setCapture(to);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      return await captureStory(card);
    } finally {
      setChip('preview');
      setCapture('preview');
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
        shareId = await ensureShareId(linked, saveHand, { names: settings.shareNames, notes: settings.shareNotes });
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
      await shareVideo(file, `${handShareText(hand.game.name, 'video')}\n${link}`);
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
        shareId = await ensureShareId(linked, saveHand, { names: settings.shareNames, notes: settings.shareNotes });
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
        target = await shareStory(await captureAs('preview'), link);
      }
      track('story_shared', { target: String(target), voice: !!voice, share_id: shareId, ref, question: mode === 'question' });
      if (mode === 'question')
        notice(
          t('Junta a sondagem'),
          t('No Instagram, põe o sticker Sondagem no espaço vazio com {options}. Depois publica a story Resultado ou deixa o link para verem o que fizeste.', {
            options: moment.options.map((o) => o.label).join(' / '),
          }),
        );
      else if (target === 'sheet') notice(t('Link copiado'), t('No Instagram, escolhe Story e cola o link num sticker de Link para os teus amigos votarem.'));
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos abrir o Instagram. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  // X: the card as a picture, the hand's replay link in the post text (a still; the video goes through "Criar vídeo da mão").
  // The hand's public link, made once (it counts as the free plan's daily share).
  const linkFor = async (channel: 'x' | 'link'): Promise<{ link: string; shareId: string; ref: string } | null> => {
    const isNew = !hand.shareId;
    if (isNew && !pro.canShare()) {
      pro.paywall('shares');
      return null;
    }
    let shareId: string;
    try {
      shareId = await ensureShareId(linked, saveHand, { names: settings.shareNames, notes: settings.shareNotes });
    } catch {
      Alert.alert(t('Sem ligação'), t('Precisamos de internet para criar o link da mão. Tenta outra vez daqui a pouco.'));
      return null;
    }
    if (isNew) pro.record('share');
    const ref = await shareRef();
    return { link: shareLink(shareId, channel, { quiz: mode === 'question', ref }), shareId, ref };
  };
  const postText = (link: string) => `${comment.trim() || handShareText(hand.game.name, mode === 'question' ? 'challenge' : 'link')}\n${link}`;

  // X or any other app: the card as a picture, the replay link in the text.
  const postTo = async (to: 'x' | 'any') => {
    tap('medium');
    setBusy(true);
    try {
      const l = await linkFor(to === 'x' ? 'x' : 'link');
      if (!l) return;
      await sharePost([await captureAs('preview', 'post')], postText(l.link), to);
      track('story_shared', { target: to, share_id: l.shareId, ref: l.ref, question: mode === 'question' });
    } catch {
      Alert.alert(t('Não deu'), t('Não conseguimos preparar a imagem. Tenta outra vez.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const l = await linkFor('link');
    if (!l) return;
    await Clipboard.setStringAsync(postText(l.link)).catch(() => {});
    notice(t('Link copiado'));
  };

  return (
    <>
      <CardShareSheet visible={sheet} onClose={() => setSheet(false)} instagram={post} x={() => postTo('x')} other={() => postTo('any')} copy={copy} />
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
                <StoryCard ref={card} hand={shown} moment={moment} comment={comment} inBB={settings.inBB} brand={brand || !pro.isPro} voice={withVoice ? chip : null} step={video ? (reel[step]?.k ?? 0) : undefined} at={video ? reel[step]?.at : undefined} poll={capture === 'post' ? null : capture === 'instagram' ? 'empty' : 'hint'} />
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
                ? t('Pára antes da tua decisão e deixa espaço para a sondagem do Instagram.')
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
          {video && canMakeVideo ? (
            <Button title={progress ?? (busy ? t('A preparar…') : t('Criar vídeo da mão'))} icon="film-outline" disabled={busy} onPress={postVideo} />
          ) : video ? (
            // Expo Go and the web can't make the video: say so, nothing to tap.
            <Button title={t('Criar vídeo da mão')} sub={t('Disponível na versão da loja')} icon="film-outline" disabled onPress={() => {}} />
          ) : canShareStory ? (
            <Button
              title={busy ? (withVoice ? t('A juntar a tua voz…') : t('A preparar…')) : direct ? t('Partilhar no Instagram') : t('Partilhar')}
              icon={direct ? 'logo-instagram' : 'share-outline'}
              disabled={busy}
              onPress={direct ? post : () => setSheet(true)}
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
