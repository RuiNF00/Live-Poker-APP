import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { STORY_H, STORY_W, StoryCard } from '@/components/StoryCard';
import { Button, Chip, Empty, Row, T, tap } from '@/components/ui';
import { canShareStory, captureStory, ensureShareLink, shareStory } from '@/lib/instagram-story';
import { sampleHand } from '@/poker/sample';
import { canAsk, storyMoment, type StoryMode } from '@/story/moment';
import { useStore } from '@/store/store';
import { C, F, R } from '@/theme';

const MAX_COMMENT = 140;
const PROMPTS = ['Fold é melhor?', 'Call ou fold?', 'Como jogavas isto?', 'Hero call ou spew?', 'Cooler ou erro meu?'];

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
  const card = useRef<React.ComponentRef<typeof View>>(null);

  const moment = useMemo(() => (hand ? storyMoment(hand, mode, settings.inBB) : null), [hand, mode, settings.inBB]);
  if (!hand || !moment) return <Empty title="Mão não encontrada" />;

  // Preview fits the screen; the captured view inside stays 360×640.
  const scale = Math.min((width - 64) / STORY_W, (height * 0.56) / STORY_H, 1);
  const noteHint = hand.notes.trim().split(/(?<=[.?!])\s/)[0]?.slice(0, MAX_COMMENT);

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
      let link: string;
      try {
        link = await ensureShareLink(hand, saveHand);
      } catch {
        Alert.alert('Sem ligação', 'Precisamos de internet para criar o link da mão. Tenta outra vez daqui a pouco.');
        return;
      }
      if (isNew) pro.record('share');
      // Question stories open the challenge view: vote first, result after.
      if (mode === 'question') link += '?q=1';
      const file = await captureStory(card);
      const target = await shareStory(file, link);
      if (target === 'sheet') Alert.alert('Link copiado', 'No Instagram, escolhe Story e cola o link num sticker de Link para os teus amigos votarem.');
    } catch {
      Alert.alert('Não deu', 'Não conseguimos abrir o Instagram. Tenta outra vez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Story no Instagram' }} />
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
                <StoryCard ref={card} hand={hand} moment={moment} comment={comment} inBB={settings.inBB} brand={brand || !pro.isPro} />
              </View>
            </View>
          </View>

          <Row gap={8} style={{ justifyContent: 'center' }}>
            <Chip label="Pergunta" active={mode === 'question'} onPress={() => ask && setMode('question')} style={!ask ? { opacity: 0.4 } : null} />
            <Chip label="Resultado" active={mode === 'result'} onPress={() => setMode('result')} />
            <Chip
              label={pro.isPro ? 'Com marca' : 'Com marca · Pro'}
              active={brand || !pro.isPro}
              color={C.textDim}
              onPress={() => (pro.isPro ? setBrand((b) => !b) : pro.paywall('story'))}
            />
          </Row>
          <T v="tiny" style={{ textAlign: 'center', marginTop: -6 }}>
            {mode === 'question'
              ? 'Pára antes da tua decisão e esconde o resultado. Quem quiser saber tem de abrir o link.'
              : 'Mostra a mão até ao fim, com as cartas e quem ganhou.'}
          </T>

          <View style={{ gap: 8 }}>
            <T v="label">O teu comentário</T>
            <TextInput
              value={comment}
              onChangeText={(t) => setComment(t.slice(0, MAX_COMMENT))}
              placeholder="Ex.: Bolha a 58, ele só 3-betou uma vez em 3h. Fold?"
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
              {noteHint ? <Chip label="Usar as notas" onPress={() => setComment(noteHint)} /> : null}
              {PROMPTS.map((p) => (
                <Chip key={p} label={p} onPress={() => setComment(p)} />
              ))}
            </ScrollView>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg }}>
          {canShareStory ? (
            <Button
              title={busy ? 'A preparar…' : 'Partilhar no Instagram'}
              icon={<Ionicons name="logo-instagram" size={19} color={C.accentInk} />}
              disabled={busy}
              onPress={post}
            />
          ) : (
            <T v="small" style={{ textAlign: 'center' }}>
              Abre a app no telemóvel para publicar no Instagram.
            </T>
          )}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
