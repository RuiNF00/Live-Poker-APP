import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { CommentsList } from '@/components/Comments';
import { isComplete } from '@/poker/engine';
import { sampleHand } from '@/poker/sample';
import { HandHeader } from '@/components/HandHeader';
import { Replayer } from '@/components/Replayer';
import { Button, Empty, Row, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { shareRef } from '@/lib/referrals';
import { deleteShare, fetchComments, fetchVotes, shareLink, uploadHand, type Comment } from '@/lib/share-api';
import { handText } from '@/poker/text';
import { useStore } from '@/store/store';
import { C, R } from '@/theme';

export default function HandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hands, saveHand, deleteHand, settings } = useStore();
  const pro = usePro();
  // The example hand is never stored, so it can't leak into lists, stats or the next hand's defaults.
  const isSample = id === 'sample';
  const sample = useMemo(() => (isSample ? sampleHand('sample') : undefined), [isSample]);
  const hand = sample ?? hands.find((h) => h.id === id);
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);

  const [votes, setVotes] = useState<Record<string, number>>({});
  const loadComments = useCallback(() => {
    if (!hand?.shareId) return;
    fetchComments(hand.shareId).then(setComments).catch(() => {});
    fetchVotes(hand.shareId).then(setVotes).catch(() => {});
  }, [hand?.shareId]);
  useEffect(loadComments, [loadComments]);

  if (!hand) return <Empty title={t('Mão não encontrada')} />;

  if (isSample)
    return (
      <ScrollView contentContainerStyle={{ padding: 12, gap: 14, paddingBottom: 48 }}>
        <HandHeader hand={hand} />
        <Replayer hand={hand} initialInBB={settings.inBB} autoPlay />
        <Button title={t('Registar a minha primeira mão')} onPress={() => router.replace('/hand/new')} />
      </ScrollView>
    );

  const ensureId = async (): Promise<string | null> => {
    if (hand.shareId) return hand.shareId;
    setBusy(true);
    try {
      const { id: shareId, token } = await uploadHand(hand);
      saveHand({ ...hand, shareId, shareToken: token });
      return shareId;
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
    const shareId = await ensureId();
    if (!shareId) return;
    if (isNew) pro.record('share');
    const ref = await shareRef();
    const link = shareLink(shareId, quiz ? 'challenge' : 'link', { quiz, ref });
    track('link_shared', { channel: quiz ? 'challenge' : 'link', share_id: shareId, ref });
    const lead = quiz ? t('desafio: o que fazes aqui? Vota antes de ver o resultado 🗳️') : t('o que fazias aqui? 👀');
    const msg = `${hand.game.name ? hand.game.name + ' — ' : ''}${lead}
${link}`;
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(msg);
      Alert.alert(t('Link copiado'));
    } else await Share.share({ message: msg });
  };

  const copyText = async () => {
    tap();
    const link = hand.shareId ? shareLink(hand.shareId, 'text', { ref: await shareRef() }) : undefined;
    await Clipboard.setStringAsync(handText(hand, { inBB: settings.inBB, link }));
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
            <VoteTally votes={votes} />
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

function VoteTally({ votes }: { votes: Record<string, number> }) {
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const rows = Object.entries(votes)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: 12, gap: 8, borderWidth: 1, borderColor: C.border }}>
      <T v="label">{total === 1 ? t('1 voto') : t('{n} votos', { n: total })}</T>
      {rows.map(([choice, v]) => {
        const pct = Math.round((v / total) * 100);
        return (
          <View key={choice} style={{ gap: 3 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="small" style={{ color: C.text, textTransform: 'capitalize' }}>
                {choice}
              </T>
              <T v="mono">{pct}%</T>
            </Row>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: C.surface3 }}>
              <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
