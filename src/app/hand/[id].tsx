import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { CommentsList } from '@/components/Comments';
import { HandHeader } from '@/components/HandHeader';
import { Replayer } from '@/components/Replayer';
import { Button, Empty, Row, T, tap } from '@/components/ui';
import { fetchComments, shareUrl, uploadHand, type Comment } from '@/lib/share-api';
import { handText } from '@/poker/text';
import { useStore } from '@/store/store';
import { C } from '@/theme';

export default function HandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hands, saveHand, deleteHand, settings } = useStore();
  const hand = hands.find((h) => h.id === id);
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);

  const loadComments = useCallback(() => {
    if (hand?.shareId) fetchComments(hand.shareId).then(setComments).catch(() => {});
  }, [hand?.shareId]);
  useEffect(loadComments, [loadComments]);

  if (!hand) return <Empty title="Mão não encontrada" />;

  const ensureLink = async (): Promise<string | null> => {
    if (hand.shareId) return shareUrl(hand.shareId);
    setBusy(true);
    try {
      const { id: shareId, token } = await uploadHand(hand);
      saveHand({ ...hand, shareId, shareToken: token });
      return shareUrl(shareId);
    } catch {
      Alert.alert('Sem ligação', 'Não deu para criar o link agora. Podes partilhar o texto da mão.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    tap('medium');
    const link = await ensureLink();
    if (!link) return;
    const msg = `${hand.game.name ? hand.game.name + ' — ' : ''}o que fazias aqui? 👀\n${link}`;
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(msg);
      Alert.alert('Link copiado');
    } else await Share.share({ message: msg, url: link });
  };

  const copyText = async () => {
    tap();
    await Clipboard.setStringAsync(handText(hand, { inBB: settings.inBB, link: hand.shareId ? shareUrl(hand.shareId) : undefined }));
    Alert.alert('Texto copiado', 'Cola no WhatsApp, Discord ou onde quiseres.');
  };

  const remove = () => {
    const doIt = () => {
      deleteHand(hand.id);
      router.back();
    };
    if (Platform.OS === 'web') doIt();
    else
      Alert.alert('Apagar mão?', 'Não dá para desfazer.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: doIt },
      ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Row gap={16}>
              <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/hand/new', params: { edit: hand.id } })}>
                <Ionicons name="create-outline" size={22} color={C.text} />
              </Pressable>
              <Pressable hitSlop={8} onPress={remove}>
                <Ionicons name="trash-outline" size={21} color={C.danger} />
              </Pressable>
            </Row>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 14, paddingBottom: 48 }}>
        <HandHeader hand={hand} />
        <Replayer hand={hand} initialInBB={settings.inBB} />
        <Button
          title="Story no Instagram"
          icon={<Ionicons name="logo-instagram" size={19} color={C.accentInk} />}
          onPress={() => router.push({ pathname: '/story/[id]', params: { id: hand.id } })}
        />
        <Row gap={8}>
          <Button
            title={busy ? 'A criar link…' : hand.shareId ? 'Partilhar link' : 'Partilhar com amigos'}
            kind="secondary"
            icon={<Ionicons name="share-social" size={18} color={C.text} />}
            style={{ flex: 1 }}
            disabled={busy}
            onPress={share}
          />
          <Button title="Texto" kind="secondary" icon={<Ionicons name="copy-outline" size={16} color={C.text} />} onPress={copyText} />
        </Row>
        {hand.shareId ? (
          <View style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h2">Comentários</T>
              <Pressable onPress={loadComments} hitSlop={8}>
                <Ionicons name="refresh" size={18} color={C.textDim} />
              </Pressable>
            </Row>
            <CommentsList shareId={hand.shareId} comments={comments} onPosted={(c) => setComments((x) => [...x, c])} defaultName={settings.nickname} />
          </View>
        ) : (
          <T v="small" style={{ textAlign: 'center' }}>
            Partilha o link: os teus amigos veem o replay no browser e comentam, mesmo sem a app.
          </T>
        )}
      </ScrollView>
    </>
  );
}
