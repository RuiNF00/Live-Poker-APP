import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { CommentsList } from '@/components/Comments';
import { isComplete } from '@/poker/engine';
import { HandHeader } from '@/components/HandHeader';
import { Replayer } from '@/components/Replayer';
import { Button, Empty, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { deleteShare, fetchComments, shareUrl, uploadHand, type Comment } from '@/lib/share-api';
import { handText } from '@/poker/text';
import { useStore } from '@/store/store';
import { C, R } from '@/theme';

export default function HandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hands, saveHand, deleteHand, settings } = useStore();
  const pro = usePro();
  const hand = hands.find((h) => h.id === id);
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);

  const loadComments = useCallback(() => {
    if (hand?.shareId) fetchComments(hand.shareId).then(setComments).catch(() => {});
  }, [hand?.shareId]);
  useEffect(loadComments, [loadComments]);

  if (!hand) return <Empty title={t('Mão não encontrada')} />;

  const ensureLink = async (): Promise<string | null> => {
    if (hand.shareId) return shareUrl(hand.shareId);
    setBusy(true);
    try {
      const { id: shareId, token } = await uploadHand(hand);
      saveHand({ ...hand, shareId, shareToken: token });
      return shareUrl(shareId);
    } catch {
      Alert.alert(t('Sem ligação'), t('Não deu para criar o link agora. Podes partilhar o texto da mão.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const share = async (quiz = false) => {
    tap('medium');
    const isNew = !hand.shareId;
    if (isNew && !pro.canShare()) {
      pro.paywall('shares');
      return;
    }
    const base = await ensureLink();
    if (!base) return;
    if (isNew) pro.record('share');
    const link = quiz ? base + '?q=1' : base;
    const lead = quiz ? t('desafio: o que fazes aqui? Vota antes de ver o resultado 🗳️') : t('o que fazias aqui? 👀');
    const msg = `${hand.game.name ? hand.game.name + ' — ' : ''}${lead}
${link}`;
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(msg);
      Alert.alert(t('Link copiado'));
    } else await Share.share({ message: msg, url: link });
  };

  const copyText = async () => {
    tap();
    await Clipboard.setStringAsync(handText(hand, { inBB: settings.inBB, link: hand.shareId ? shareUrl(hand.shareId) : undefined }));
    Alert.alert(t('Texto copiado'), t('Cola no WhatsApp, Discord ou onde quiseres.'));
  };

  const unshare = () => {
    const doIt = async () => {
      if (!hand.shareId || !hand.shareToken) return;
      try {
        await deleteShare(hand.shareId, hand.shareToken);
        saveHand({ ...hand, shareId: undefined, shareToken: undefined });
        setComments([]);
      } catch {
        Alert.alert(t('Sem ligação'), t('Não deu para apagar a partilha agora. Tenta outra vez.'));
      }
    };
    if (Platform.OS === 'web') doIt();
    else
      Alert.alert(t('Apagar partilha?'), t('O link deixa de funcionar e os comentários são apagados. A mão fica no teu caderno.'), [
        { text: t('Cancelar'), style: 'cancel' },
        { text: t('Apagar'), style: 'destructive', onPress: doIt },
      ]);
  };

  const remove = () => {
    const doIt = () => {
      // The public link goes with the hand.
      if (hand.shareId && hand.shareToken) deleteShare(hand.shareId, hand.shareToken).catch(() => {});
      deleteHand(hand.id);
      router.back();
    };
    if (Platform.OS === 'web') doIt();
    else
      Alert.alert(t('Apagar mão?'), t('Não dá para desfazer.'), [
        { text: t('Cancelar'), style: 'cancel' },
        { text: t('Apagar'), style: 'destructive', onPress: doIt },
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
        {!isComplete(hand) && (
          <Pressable
            onPress={() => router.push({ pathname: '/hand/new', params: { edit: hand.id } })}
            style={{ backgroundColor: 'rgba(245,184,61,0.12)', borderColor: 'rgba(245,184,61,0.45)', borderWidth: 1, borderRadius: R.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="create-outline" size={18} color={C.warn} />
            <T v="small" style={{ flex: 1, color: C.text }}>
              {t('Mão por completar. Toca para continuar onde ficaste.')}
            </T>
          </Pressable>
        )}
        <Replayer hand={hand} initialInBB={settings.inBB} />
        <Button
          title={t('Story no Instagram')}
          icon={<Ionicons name="logo-instagram" size={19} color={C.accentInk} />}
          onPress={() => router.push({ pathname: '/story/[id]', params: { id: hand.id } })}
        />
        <Row gap={8}>
          <Button
            title={busy ? t('A criar link…') : hand.shareId ? t('Partilhar link') : t('Partilhar com amigos')}
            kind="secondary"
            icon={<Ionicons name="share-social" size={18} color={C.text} />}
            style={{ flex: 1 }}
            disabled={busy}
            onPress={() => share()}
          />
          <Button title={t('Desafio')} kind="secondary" icon={<Ionicons name="help-circle-outline" size={16} color={C.text} />} disabled={busy} onPress={() => share(true)} />
          <Button title={t('Texto')} kind="secondary" icon={<Ionicons name="copy-outline" size={16} color={C.text} />} onPress={copyText} />
        </Row>
        {hand.shareId ? (
          <View style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h2">{t('Comentários')}</T>
              <Pressable onPress={loadComments} hitSlop={8}>
                <Ionicons name="refresh" size={18} color={C.textDim} />
              </Pressable>
            </Row>
            <CommentsList shareId={hand.shareId} comments={comments} onPosted={(c) => setComments((x) => [...x, c])} defaultName={settings.nickname} />
            {hand.shareToken ? (
              <Pressable onPress={unshare} hitSlop={8} style={{ alignSelf: 'center', paddingTop: 8 }}>
                <T v="small" color={C.danger}>
                  {t('Apagar partilha')}
                </T>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <T v="small" style={{ textAlign: 'center' }}>
            {t('Partilha o link: os teus amigos veem o replay no browser e comentam, mesmo sem a app.')}
          </T>
        )}
      </ScrollView>
    </>
  );
}
