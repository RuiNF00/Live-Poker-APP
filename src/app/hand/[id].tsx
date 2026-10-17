import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, Share, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { CommentsList } from '@/components/Comments';
import { VoiceNotePlayer } from '@/components/entry/VoiceNote';
import { isComplete } from '@/poker/engine';
import { sampleHand } from '@/poker/sample';
import { HandHeader } from '@/components/HandHeader';
import { Replayer } from '@/components/Replayer';
import { Banner, Button, Card, Empty, IconButton, Row, Section, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { dropVoiceNote } from '@/lib/voice-note';
import { shareRef } from '@/lib/referrals';
import { deleteShare, fetchComments, fetchVotes, shareLink, uploadHand, type Comment } from '@/lib/share-api';
import { handText } from '@/poker/text';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';

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
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.md, gap: S.lg, paddingBottom: 48 }}>
        <Banner tone="info" icon="sparkles-outline" title={t('Mão de exemplo')} body={t('É assim que as tuas mãos ficam guardadas.')} />
        <HandHeader hand={hand} inBB={settings.inBB} />
        <Replayer hand={hand} initialInBB={settings.inBB} autoPlay />
        <Button title={t('Registar a minha primeira mão')} icon="add" onPress={() => router.replace('/hand/new')} />
      </ScrollView>
    );

  const ensureId = async (): Promise<string | null> => {
    if (hand.shareId) return hand.shareId;
    setBusy(true);
    try {
      const { id: shareId, token } = await uploadHand(hand, { names: settings.shareNames, notes: settings.shareNotes });
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
      dropVoiceNote(hand.voiceNote);
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

  const edit = () => router.push({ pathname: '/hand/new', params: { edit: hand.id } });
  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Row gap={S.sm}>
              <IconButton name="create-outline" size={36} label={t('Editar mão')} onPress={edit} />
              <IconButton name="trash-outline" size={36} color={C.danger} label={t('Apagar mão')} onPress={remove} />
            </Row>
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.md, gap: S.lg, paddingBottom: 48 }}>
        <View style={{ paddingHorizontal: 4 }}>
          <HandHeader hand={hand} inBB={settings.inBB} />
        </View>
        {!isComplete(hand) && <Banner tone="warn" icon="create-outline" title={t('Mão por completar')} body={t('Toca para continuar onde ficaste.')} onPress={edit} />}
        {hand.voiceNote ? <VoiceNotePlayer uri={hand.voiceNote} /> : null}
        <Replayer hand={hand} initialInBB={settings.inBB} />

        <Section title={t('Partilhar')}>
          <Button title={busy ? t('A criar link…') : hand.shareId ? t('Partilhar link') : t('Partilhar com amigos')} icon="share-social" disabled={busy} onPress={() => share()} />
          <Row gap={S.sm}>
            <ShareTile icon="help-circle-outline" label={t('Desafio')} sub={t('Votação')} disabled={busy} onPress={() => share(true)} />
            <ShareTile icon="logo-instagram" label="Story" sub="Instagram" onPress={() => router.push({ pathname: '/story/[id]', params: { id: hand.id } })} />
            <ShareTile icon="copy-outline" label={t('Texto')} sub="WhatsApp" onPress={copyText} />
          </Row>
        </Section>

        {hand.shareId ? (
          <Section title={t('Comentários')} action={t('Atualizar')} onAction={loadComments}>
            <VoteTally votes={votes} />
            <CommentsList shareId={hand.shareId} comments={comments} onPosted={(c) => setComments((x) => [...x, c])} defaultName={settings.nickname} />
            {hand.shareToken ? <Button kind="plain" size="sm" title={t('Apagar partilha')} style={{ alignSelf: 'center' }} onPress={unshare} /> : null}
          </Section>
        ) : (
          <T v="small" style={{ textAlign: 'center', paddingHorizontal: S.lg }}>
            {t('Os teus amigos veem o replay no browser e comentam, mesmo sem a app.')}
          </T>
        )}
      </ScrollView>
    </>
  );
}

function ShareTile({ icon, label, sub, onPress, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; sub: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Card onPress={disabled ? undefined : onPress} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: S.md, paddingHorizontal: S.sm, opacity: disabled ? 0.5 : 1 }} accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={C.text} />
      <T v="h3" style={{ fontSize: 14 }}>
        {label}
      </T>
      <T v="tiny" numberOfLines={1}>
        {sub}
      </T>
    </Card>
  );
}

function VoteTally({ votes }: { votes: Record<string, number> }) {
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const rows = Object.entries(votes)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  return (
    <Card style={{ gap: S.sm }}>
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
    </Card>
  );
}
