import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { CoachThread } from '@/components/CoachThread';
import { CommentsList, PrivateStreetNotes } from '@/components/Comments';
import { VoiceNotePlayer } from '@/components/entry/VoiceNote';
import { isComplete, replay } from '@/poker/engine';
import { sampleHand } from '@/poker/sample';
import { HandHeader } from '@/components/HandHeader';
import { Replayer } from '@/components/Replayer';
import { ReviewCard } from '@/components/ReviewCard';
import { Banner, Button, Card, Empty, IconButton, Row, Section, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { maybeAskForReview } from '@/lib/review';
import { dropVoiceNote } from '@/lib/voice-note';
import { shareRef } from '@/lib/referrals';
import { isNetworkError, queueShare, takeDirectShare, useQueuedShare } from '@/lib/share-queue';
import { deleteShare, fetchComments, removeComment, fetchVotes, shareLink, uploadHand, type Comment } from '@/lib/share-api';
import { pokerStarsText } from '@/poker/pokerstars';
import { forumText } from '@/poker/text';
import { saveSolverFile } from '@/lib/solver-export';
import { openInGtoWizard } from '@/lib/gto-wizard';
import { shareSampleHand } from '@/lib/sample-share';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';
import type { Hand, Street } from '@/poker/types';

export default function HandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hands, saveHand, deleteHand, settings } = useStore();
  const pro = usePro();
  // The example hand is never stored, so it can't leak into lists, stats or the next hand's defaults.
  const isSample = id === 'sample';
  const sample = useMemo(() => (isSample ? sampleHand('sample') : undefined), [isSample]);
  const hand = sample ?? hands.find((h) => h.id === id);
  const [busy, setBusy] = useState(false);
  // A link made without signal waits here and lands on the hand when the network is back.
  const shareWaiting = useQueuedShare(isSample ? undefined : hand, saveHand);
  const [comments, setComments] = useState<Comment[]>([]);

  const [votes, setVotes] = useState<Record<string, number>>({});
  const loadComments = useCallback(() => {
    if (!hand?.shareId) return;
    fetchComments(hand.shareId).then(setComments).catch(() => {});
    fetchVotes(hand.shareId).then(setVotes).catch(() => {});
  }, [hand?.shareId]);
  useEffect(loadComments, [loadComments]);
  // The street on screen in the replayer: comments mark it "you are here", and tapping a street jumps there.
  const [street, setStreet] = useState<Street>('preflop');
  const [seek, setSeek] = useState<{ street: Street; n: number }>();
  const jumpStreet = (st: Street) => setSeek((x) => ({ street: st, n: (x?.n ?? 0) + 1 }));
  const streets = useMemo(() => {
    if (!hand) return [];
    const seen = new Set(replay(hand).steps.map((s) => s.street));
    return (['preflop', 'flop', 'turn', 'river'] as Street[]).filter((x) => seen.has(x));
  }, [hand]);
  const saveNote = (st: Street, text: string) => {
    if (!hand) return;
    const next = { ...hand.streetNotes, [st]: text || undefined };
    saveHand({ ...hand, streetNotes: next, updatedAt: Date.now() });
  };

  if (!hand) return <Empty title={t('Mão não encontrada')} />;

  if (isSample)
    return (
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.md, gap: S.lg, paddingBottom: 48 }}>
        <Banner tone="info" icon="sparkles-outline" title={t('Mão de exemplo')} body={t('É assim que as tuas mãos ficam guardadas.')} />
        <HandHeader hand={hand} inBB={settings.inBB} />
        <Replayer hand={hand} initialInBB={settings.inBB} autoPlay source="sample" />
        <Button title={t('Registar a minha primeira mão')} icon="add" onPress={() => router.replace('/hand/new')} />
        <Section title={t('Partilhar')}>
          <Button
            kind="secondary"
            title={busy ? t('A criar link…') : t('Partilhar com amigos')}
            icon="share-social"
            disabled={busy}
            onPress={() => {
              tap('medium');
              setBusy(true);
              shareSampleHand(hand).finally(() => setBusy(false));
            }}
          />
          <Row gap={S.sm}>
            <ShareTile icon="logo-instagram" label="Story" sub="Instagram" onPress={() => router.push({ pathname: '/story/[id]', params: { id: 'sample' } })} />
            <ShareTile icon="analytics-outline" label="Solver" sub="GTO Wizard" onPress={() => openInGtoWizard([hand])} />
          </Row>
        </Section>
      </ScrollView>
    );

  const ensureId = async (): Promise<string | null> => {
    if (hand.shareId) return hand.shareId;
    setBusy(true);
    try {
      // One public copy per hand: reuse a link made offline, or wait for the one being sent.
      const slot = await takeDirectShare(hand.id);
      if (slot.kind === 'ready') {
        saveHand({ ...hand, ...slot.link });
        return slot.link.shareId;
      }
      if (slot.kind === 'busy') {
        Alert.alert(t('Link quase pronto'), t('Estamos a criar o link agora. Toca outra vez em Partilhar daqui a um instante.'));
        return null;
      }
      const { id: shareId, token } = await uploadHand(hand, { names: settings.shareNames, notes: settings.shareNotes });
      saveHand({ ...hand, shareId, shareToken: token });
      return shareId;
    } catch (e) {
      if (isNetworkError(e)) {
        const opts = { names: settings.shareNames, notes: settings.shareNotes };
        queueShare(hand, opts);
        Alert.alert(t('Sem rede'), t('O link fica pronto quando houver sinal. Depois é só tocar outra vez em Partilhar.'));
      } else Alert.alert(t('Sem ligação'), t('Não deu para criar o link agora. Podes partilhar o texto da mão.'));
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
    } else {
      const res = await Share.share({ message: msg });
      // Review moment A (design/pedido-avaliacao.md): the third hand shared by link, once it really went out.
      if (res.action === Share.sharedAction && hands.filter((h) => h.shareId || h.id === hand.id).length >= 3) maybeAskForReview('share3');
    }
  };

  // Standard hand history for TwoPlusTwo, Reddit or a WhatsApp group: positions, stacks in bb, every street.
  const copyText = async (withLink: boolean) => {
    let link: string | undefined;
    if (withLink) {
      const isNew = !hand.shareId;
      if (isNew && !pro.canShare()) {
        pro.paywall('shares');
        return;
      }
      const shareId = await ensureId();
      if (!shareId) return;
      if (isNew) pro.record('share');
      const ref = await shareRef();
      link = shareLink(shareId, 'text', { ref });
      track('link_shared', { channel: 'text', share_id: shareId, ref });
    }
    await Clipboard.setStringAsync(forumText(hand, { link, brand: !pro.isPro, notes: settings.shareNotes }));
    Alert.alert(t('Texto copiado'), t('Cola no fórum, no Reddit ou no grupo de WhatsApp.'));
  };

  const askCopyText = () => {
    tap();
    if (Platform.OS === 'web') return copyText(!!hand.shareId);
    Alert.alert(t('Copiar como texto'), t('Histórico da mão em bb, no formato dos fóruns.'), [
      { text: t('Com link do replay'), onPress: () => copyText(true) },
      { text: t('Só o texto'), onPress: () => copyText(false) },
      { text: t('Cancelar'), style: 'cancel' },
    ]);
  };

  // PokerStars hand history, for GTO Wizard, PioSolver, Hold'em Manager or PokerTracker.
  const exportSolver = () => {
    tap();
    if (!isComplete(hand)) {
      Alert.alert(t('Mão por completar'), t('Os solvers só leem mãos completas. Acaba a mão primeiro.'));
      return;
    }
    const save = () => saveSolverFile([hand]).catch(() => Alert.alert(t('Não deu'), t('Não conseguimos guardar o ficheiro. Tenta outra vez.')));
    if (Platform.OS === 'web') return save();
    Alert.alert(t('Exportar para solver'), t('Formato PokerStars: GTO Wizard, PioSolver, Hold\'em Manager e PokerTracker leem-no.'), [
      {
        text: t('Copiar texto'),
        onPress: async () => {
          await Clipboard.setStringAsync(pokerStarsText(hand));
          Alert.alert(t('Texto copiado'), t('Cola-o na importação de mãos do solver ou do tracker.'));
        },
      },
      { text: t('Guardar ficheiro .txt'), onPress: save },
      { text: t('Cancelar'), style: 'cancel' },
    ]);
  };

  const removeOne = (c: Comment) => {
    const doIt = async (block: boolean) => {
      if (!hand.shareId || !hand.shareToken) return;
      try {
        await removeComment(hand.shareId, hand.shareToken, c.id, block);
        if (block) loadComments();
        else setComments((x) => x.filter((y) => y.id !== c.id));
      } catch {
        Alert.alert(t('Sem ligação'), t('Não deu para apagar o comentário agora. Tenta outra vez.'));
      }
    };
    if (Platform.OS === 'web') doIt(false);
    else
      Alert.alert(t('Apagar comentário?'), t('Bloquear impede esta pessoa de voltar a comentar nesta mão.'), [
        { text: t('Cancelar'), style: 'cancel' },
        { text: t('Apagar'), style: 'destructive', onPress: () => doIt(false) },
        { text: t('Apagar e bloquear'), style: 'destructive', onPress: () => doIt(true) },
      ]);
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
      // The public link goes with the hand (the store queues it until there's signal).
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
        <Replayer hand={hand} source="own" initialInBB={settings.inBB} onStreet={setStreet} seek={seek} streetNotes={hand.streetNotes} />
        <HandNav hand={hand} hands={hands} />
        <CoachThread hand={hand} name={settings.nickname} />
        <ReviewCard key={hand.id} hand={hand} onChange={saveHand} />

        <Section title={t('Partilhar')}>
          <Button title={busy ? t('A criar link…') : hand.shareId ? t('Partilhar link') : shareWaiting ? t('Link à espera de rede') : t('Partilhar com amigos')} icon="share-social" disabled={busy} onPress={() => share()} />
          <Row gap={S.sm}>
            <ShareTile icon="help-circle-outline" label={t('Desafio')} sub={t('Votação')} disabled={busy} onPress={() => share(true)} />
            <ShareTile icon="logo-instagram" label="Story" sub="Instagram" onPress={() => router.push({ pathname: '/story/[id]', params: { id: hand.id } })} />
            <ShareTile icon="copy-outline" label={t('Texto')} sub={t('Fórum')} disabled={busy} onPress={askCopyText} />
            <ShareTile icon="analytics-outline" label="Solver" sub="GTO Wizard" onPress={() => openInGtoWizard([hand])} onLongPress={exportSolver} />
          </Row>
        </Section>

        {hand.shareId ? (
          <Section title={t('Comentários')} action={t('Atualizar')} onAction={loadComments}>
            <VoteTally votes={votes} />
            <CommentsList
              shareId={hand.shareId}
              comments={comments}
              onPosted={(c) => setComments((x) => [...x, c])}
              defaultName={settings.nickname}
              streets={streets}
              street={street}
              onJumpStreet={jumpStreet}
              notes={hand.streetNotes}
              onNote={saveNote}
              onRemove={hand.shareToken ? removeOne : undefined}
            />
            {hand.shareToken ? <Button kind="plain" size="sm" title={t('Apagar partilha')} style={{ alignSelf: 'center' }} onPress={unshare} /> : null}
          </Section>
        ) : (
          <>
            <Section title={t('As tuas notas')} hint={t('Uma nota por rua, só tu vês. Nunca sai do telemóvel.')}>
              <PrivateStreetNotes streets={streets} street={street} onJumpStreet={jumpStreet} notes={hand.streetNotes} onNote={saveNote} />
            </Section>
            <T v="small" style={{ textAlign: 'center', paddingHorizontal: S.lg }}>
              {t('Os teus amigos veem o replay no browser e comentam, mesmo sem a app.')}
            </T>
          </>
        )}
      </ScrollView>
    </>
  );
}

function ShareTile({
  icon,
  label,
  sub,
  onPress,
  onLongPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub: string;
  onPress: () => void;
  /** More options: the GTO Wizard tile keeps "copy text" and "save .txt" here. */
  onLongPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Card onPress={disabled ? undefined : onPress} onLongPress={disabled ? undefined : onLongPress} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: S.md, paddingHorizontal: S.sm, opacity: disabled ? 0.5 : 1 }} accessibilityLabel={label}>
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

/** Previous and next hand of the same session or tournament, to review a day in order. */
function HandNav({ hand, hands }: { hand: Hand; hands: Hand[] }) {
  const list = useMemo(
    () => (hand.sessionId ? hands.filter((h) => h.sessionId === hand.sessionId).sort((a, b) => a.createdAt - b.createdAt) : []),
    [hand.sessionId, hands],
  );
  if (list.length < 2) return null;
  const at = list.findIndex((h) => h.id === hand.id);
  const open = (h?: Hand) => {
    if (!h) return;
    tap('select');
    router.replace({ pathname: '/hand/[id]', params: { id: h.id } });
  };
  const btn = (dir: -1 | 1) => {
    const target = list[at + dir];
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir < 0 ? t('Mão anterior') : t('Mão seguinte')}
        accessibilityState={{ disabled: !target }}
        disabled={!target}
        onPress={() => open(target)}
        hitSlop={6}
        style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: S.sm, opacity: !target ? 0.35 : pressed ? 0.7 : 1 })}>
        {dir < 0 ? <Ionicons name="chevron-back" size={18} color={C.text} /> : null}
        <T v="small" color={C.text}>
          {dir < 0 ? t('Anterior') : t('Seguinte')}
        </T>
        {dir > 0 ? <Ionicons name="chevron-forward" size={18} color={C.text} /> : null}
      </Pressable>
    );
  };
  return (
    <Row style={{ justifyContent: 'space-between', borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}>
      {btn(-1)}
      <T v="small" color={C.textDim}>
        {t('Mão {n} de {total} da sessão', { n: at + 1, total: list.length })}
      </T>
      {btn(1)}
    </Row>
  );
}
