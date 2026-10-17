import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, View } from 'react-native';

import { usePro } from '@/billing/pro';
import { CoachThread } from '@/components/CoachThread';
import { CommentsList, PrivateStreetNotes } from '@/components/Comments';
import { VoiceNotePlayer } from '@/components/entry/VoiceNote';
import { notice } from '@/lib/notice';
import { isComplete, replay } from '@/poker/engine';
import { sameTable } from '@/poker/factory';
import { sampleHand } from '@/poker/sample';
import { unfinished } from '@/poker/unfinished';
import { HandHeader } from '@/components/HandHeader';
import { Replayer } from '@/components/Replayer';
import { ReviewCard } from '@/components/ReviewCard';
import { ShareSheet, type ShareOption } from '@/components/ShareSheet';
import { Banner, Button, Card, confirmAction, Empty, Field, IconButton, Row, Section, T, tap } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { maybeAskForReview } from '@/lib/review';
import { dropVoiceNote } from '@/lib/voice-note';
import { shareRef } from '@/lib/referrals';
import { lastShare, rememberShare } from '@/lib/share-last';
import { isNetworkError, queueShare, takeDirectShare, useQueuedShare } from '@/lib/share-queue';
import { commentPushAvailable, openedOwnHand, turnOnCommentPush } from '@/lib/comment-push';
import { markCommentsSeen } from '@/lib/friend-hands';
import { kindOn } from '@/lib/notify-policy';
import { useNotifySoftAsk } from '@/components/NotifySoftAsk';
import { streetOfNew } from '@/lib/friend-hands-core';
import { deleteShare, fetchComments, removeComment, fetchVotes, shareLink, uploadHand, type Comment } from '@/lib/share-api';
import { pokerStarsText } from '@/poker/pokerstars';
import { forumText } from '@/poker/text';
import { saveSolverFile } from '@/lib/solver-export';
import { openInGtoWizard } from '@/lib/gto-wizard';
import { shareSampleHand } from '@/lib/sample-share';
import { handShareText } from '@/share/share-text';
import { useStore } from '@/store/store';
import { C, S } from '@/theme';
import type { Hand, Street } from '@/poker/types';
import { reduceMotion } from '@/lib/motion';

/** How long "Desfazer" stays on a removed comment before it really goes. */
const UNDO_MS = 5000;
const without = <V,>(o: Record<string, V>, k: string) => {
  const { [k]: _gone, ...rest } = o;
  return rest;
};

export default function HandScreen() {
  // `c`: how many new comments brought you here (from "Mãos partilhadas"); the replay opens on the newest one's street.
  // `f`: this hand was just finished in the editor; the next unfinished one is offered.
  const { id, c: fresh, f: justFinished } = useLocalSearchParams<{ id: string; c?: string; f?: string }>();
  const { hands, saveHand, deleteHand, settings, setSettings, activeSession } = useStore();
  const pro = usePro();
  // The example hand is never stored, so it can't leak into lists, stats or the next hand's defaults.
  const isSample = id === 'sample';
  const sample = useMemo(() => (isSample ? sampleHand('sample') : undefined), [isSample]);
  const hand = sample ?? hands.find((h) => h.id === id);
  const nextLeft = useMemo(() => {
    if (!justFinished) return null;
    const left = unfinished(hands).filter((h) => h.id !== id);
    return left.length ? { n: left.length, id: left[0].id } : null;
  }, [justFinished, hands, id]);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Shown at the top of the link; only before the link exists.
  const [ask, setAsk] = useState('');
  // A link made without signal waits here and lands on the hand when the network is back.
  const shareWaiting = useQueuedShare(isSample ? undefined : hand, saveHand);
  const [comments, setComments] = useState<Comment[]>([]);

  const [votes, setVotes] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Record<string, 'remove' | 'block'>>({});
  const later = useRef(new Map<string, { run: () => void; timer: ReturnType<typeof setTimeout> }>());
  // Leaving the hand before "Desfazer" runs out: the removal goes through then.
  useEffect(() => {
    const queued = later.current;
    return () => {
      for (const p of queued.values()) {
        clearTimeout(p.timer);
        p.run();
      }
    };
  }, []);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Opened for new comments: the screen scrolls to them once they're laid out.
  const toComments = useRef(Number(fresh) > 0);
  const commentsOn = kindOn(settings, 'comments');
  const loadComments = useCallback(() => {
    if (!hand?.shareId) return;
    const sid = hand.shareId;
    fetchComments(sid)
      .then((c) => {
        setComments(c);
        markCommentsSeen(sid, c.length);
      })
      .catch(() => {});
    fetchVotes(hand.shareId).then(setVotes).catch(() => {});
  }, [hand?.shareId]);
  useEffect(loadComments, [loadComments]);
  // Opened: the next comment may send a notice again.
  const [sid, stok] = [hand?.shareId, hand?.shareToken];
  useEffect(() => {
    if (sid && stok) void openedOwnHand({ shareId: sid, shareToken: stok }, commentsOn);
  }, [sid, stok, commentsOn]);
  const [softAsk, askNotify] = useNotifySoftAsk();
  // The link that was just made, for the ask below (the hand on screen is a render behind).
  const made = useRef<{ shareId?: string; shareToken?: string }>({});
  // After the first share of a hand, once it went out: "Novo comentário na tua mão" is worth asking for then.
  const offerCommentPush = async () => {
    if (!commentsOn || !commentPushAvailable() || !made.current.shareToken) return;
    const ok = await askNotify({
      where: 'comments',
      title: t('Avisamos-te quando alguém comentar'),
      preview: { title: t('Novo comentário na tua mão: turn'), body: t('Toca para abrir a mão nesse comentário.') },
    });
    if (ok) void turnOnCommentPush(made.current);
  };
  // The street on screen in the replayer: comments mark it "you are here", and tapping a street jumps there.
  const [street, setStreet] = useState<Street>('preflop');
  const [seek, setSeek] = useState<{ street: Street; n: number }>();
  const jumpStreet = (st: Street) => setSeek((x) => ({ street: st, n: (x?.n ?? 0) + 1 }));
  // Opened from "Mãos partilhadas" with new comments: once, on the street of the newest one.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !comments.length) return;
    opened.current = true;
    const st = streetOfNew(comments, Number(fresh));
    if (st) setSeek((x) => ({ street: st, n: (x?.n ?? 0) + 1 }));
  }, [comments, fresh]);
  const onCommentsLayout = (y: number) => {
    if (!toComments.current || !comments.length) return;
    toComments.current = false;
    scroller.current?.scrollTo({ y: Math.max(0, y - S.sm), animated: !reduceMotion() });
  };
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
        <Replayer hand={hand} initialInBB={settings.inBB} onInBB={(inBB) => setSettings({ inBB })} autoPlay source="sample" />
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
        made.current = slot.link;
        saveHand({ ...hand, ...slot.link });
        return slot.link.shareId;
      }
      if (slot.kind === 'busy') {
        notice(t('Link quase pronto'), t('Estamos a criar o link agora. Toca outra vez em Partilhar daqui a um instante.'));
        return null;
      }
      const asked = { ...hand, ask: ask.trim().slice(0, 140) || undefined };
      const { id: shareId, token } = await uploadHand(asked, { names: settings.shareNames, notes: settings.shareNotes });
      made.current = { shareId, shareToken: token };
      saveHand({ ...asked, shareId, shareToken: token });
      return shareId;
    } catch (e) {
      if (isNetworkError(e)) {
        const opts = { names: settings.shareNames, notes: settings.shareNotes };
        queueShare({ ...hand, ask: ask.trim().slice(0, 140) || undefined }, opts);
        notice(t('Sem rede'), t('O link fica pronto quando houver sinal. Depois é só tocar outra vez em Partilhar.'));
      } else notice(t('Sem ligação'), t('Não deu para criar o link agora. Podes partilhar o texto da mão.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const share = async (quiz = false, to?: 'x' | 'whatsapp') => {
    tap('medium');
    const isNew = !hand.shareId;
    const shareId = await ensureId();
    if (!shareId) return;
    if (isNew) pro.record('share');
    const ref = await shareRef();
    const channel = to ?? (quiz ? 'challenge' : 'link');
    const link = shareLink(shareId, channel, { quiz, ref });
    track('link_shared', { channel, share_id: shareId, ref });
    const head = handShareText(hand.game.name, quiz ? 'challenge' : 'comment');
    const msg = `${head}
${link}`;
    if (to === 'x') {
      // Straight to a new post on X (the app if installed, else the browser); the link shows the replay card.
      await Linking.openURL(`https://x.com/intent/post?text=${encodeURIComponent(head)}&url=${encodeURIComponent(link)}`).catch(() => Share.share({ message: msg }));
      if (isNew) void offerCommentPush();
      return;
    }
    if (to === 'whatsapp') {
      // Straight to WhatsApp's chat picker: one tap less than the system sheet. Without WhatsApp, the usual sheet.
      const text = encodeURIComponent(msg);
      const url = Platform.OS === 'web' ? `https://wa.me/?text=${text}` : `whatsapp://send?text=${text}`;
      await Linking.openURL(url).catch(() => Share.share({ message: msg }));
      if (isNew) void offerCommentPush();
      return;
    }
    if (Platform.OS === 'web') {
      await Clipboard.setStringAsync(msg);
      notice(t('Link copiado'));
    } else {
      const res = await Share.share({ message: msg });
      // Review moment A (design/pedido-avaliacao.md): the third hand shared by link, once it really went out.
      if (res.action === Share.sharedAction && hands.filter((h) => h.shareId || h.id === hand.id).length >= 3) maybeAskForReview('share3');
      if (isNew && res.action === Share.sharedAction) void offerCommentPush();
    }
  };

  // Standard hand history for TwoPlusTwo, Reddit or a WhatsApp group: positions, stacks in bb, every street.
  const copyText = async (withLink: boolean) => {
    let link: string | undefined;
    if (withLink) {
      const isNew = !hand.shareId;
      const shareId = await ensureId();
      if (!shareId) return;
      if (isNew) pro.record('share');
      const ref = await shareRef();
      link = shareLink(shareId, 'text', { ref });
      track('link_shared', { channel: 'text', share_id: shareId, ref });
    }
    await Clipboard.setStringAsync(forumText(hand, { link, brand: !pro.isPro, notes: settings.shareNotes }));
    notice(t('Texto copiado'), t('Cola no fórum, no Reddit ou no grupo de WhatsApp.'));
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
      notice(t('Mão por completar'), t('Os solvers só leem mãos completas. Acaba a mão primeiro.'));
      return;
    }
    const save = () => saveSolverFile([hand]).catch(() => notice(t('Não deu'), t('Não conseguimos guardar o ficheiro. Tenta outra vez.')));
    if (Platform.OS === 'web') return save();
    Alert.alert(t('Exportar para solver'), t('Formato hand history (.txt): GTO Wizard, PioSolver, Hold\'em Manager e PokerTracker leem-no.'), [
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

  // Apagar and Bloquear act in one tap: the comment shows "Desfazer" for a few seconds before it goes.
  const commitRemove = async (c: Comment, block: boolean) => {
    later.current.delete(c.id);
    const sid = hand.shareId;
    try {
      if (sid && hand.shareToken) await removeComment(sid, hand.shareToken, c.id, block);
      if (block) loadComments();
      else setComments((x) => x.filter((y) => y.id !== c.id));
    } catch {
      notice(t('Sem ligação'), t('Não deu para apagar o comentário agora. Tenta outra vez.'));
    } finally {
      setPending((p) => without(p, c.id));
    }
  };
  const removeOne = (c: Comment, block: boolean) => {
    tap();
    setPending((p) => ({ ...p, [c.id]: block ? 'block' : 'remove' }));
    later.current.set(c.id, { run: () => commitRemove(c, block), timer: setTimeout(() => commitRemove(c, block), UNDO_MS) });
  };
  const undoRemove = (c: Comment) => {
    const p = later.current.get(c.id);
    if (p) clearTimeout(p.timer);
    later.current.delete(c.id);
    setPending((p) => without(p, c.id));
  };

  const copyLink = async () => {
    const isNew = !hand.shareId;
    const shareId = await ensureId();
    if (!shareId) return;
    if (isNew) pro.record('share');
    const ref = await shareRef();
    await Clipboard.setStringAsync(shareLink(shareId, 'link', { ref }));
    track('link_shared', { channel: 'copy', share_id: shareId, ref });
    tap('success');
    notice(t('Link copiado'));
    if (isNew) void offerCommentPush();
  };

  const unshare = () => {
    const doIt = async () => {
      if (!hand.shareId || !hand.shareToken) return;
      try {
        await deleteShare(hand.shareId, hand.shareToken);
        saveHand({ ...hand, shareId: undefined, shareToken: undefined });
        setComments([]);
      } catch {
        notice(t('Sem ligação'), t('Não deu para apagar a partilha agora. Tenta outra vez.'));
      }
    };
    // Asks on the web too: one tap would end the link and every comment.
    confirmAction(t('Apagar partilha?'), t('O link deixa de funcionar e os comentários são apagados. A mão fica no teu caderno.'), t('Apagar'), doIt);
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

  // The destinations the sheet lists first; the one used last is also the button on the screen.
  const destinations: ShareOption[] = [
    { key: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', onPress: () => share(false, 'whatsapp') },
    { key: 'instagram', icon: 'logo-instagram', label: t('Story no Instagram'), onPress: () => router.push({ pathname: '/story/[id]', params: { id: hand.id, to: 'instagram', ...((ask.trim() || hand.ask) ? { ask: ask.trim() || hand.ask } : {}) } }) },
    { key: 'x', icon: 'logo-x', label: t('Publicar no X'), onPress: () => share(false, 'x') },
    { key: 'other', icon: 'share-outline', label: t('Outras apps'), sub: t('Mensagens, Telegram…'), onPress: () => share() },
    { key: 'copy', icon: 'link-outline', label: t('Copiar link'), onPress: copyLink },
  ];
  // Sent to WhatsApp last time: the button goes straight there (one tap less); the sheet stays one tap away.
  // "Outras apps" keeps the sheet, so the system one never opens unasked.
  const last = lastShare();
  const quick = last === 'whatsapp' ? { icon: 'logo-whatsapp' as const, label: 'WhatsApp' } : last === 'instagram' ? { icon: 'logo-instagram' as const, label: t('Story no Instagram') } : last === 'x' ? { icon: 'logo-x' as const, label: t('Publicar no X') } : last === 'copy' ? { icon: 'link-outline' as const, label: t('Copiar link') } : null;
  const sendLast = () => {
    const o = destinations.find((d) => d.key === last);
    if (!o?.key) return;
    rememberShare(o.key);
    o.onPress();
  };

  const edit = () => router.push({ pathname: '/hand/new', params: { edit: hand.id } });
  // Live, or the latest hand of a table still going: the next hand is one tap away.
  // Only once the hand is finished: an unfinished pot would carry the wrong stacks over.
  const nextHere = isComplete(hand) && ((!!activeSession && hand.sessionId === activeSession.id) || (hands[0]?.id === hand.id && sameTable(hand, null)));
  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Row gap={S.sm}>
              {/* Share stays one tap away while the replayer is scrolled into view. */}
              <IconButton name="share-social-outline" size={36} label={t('Partilhar')} onPress={() => setShareOpen(true)} />
              <IconButton name="create-outline" size={36} label={t('Editar mão')} onPress={edit} />
              <IconButton name="trash-outline" size={36} color={C.danger} label={t('Apagar mão')} onPress={remove} />
            </Row>
          ),
        }}
      />
      <ScrollView
        ref={scroller}
        style={{ backgroundColor: C.bg }}
        contentContainerStyle={{ padding: S.md, gap: S.lg, paddingBottom: 48 }}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 4 }}>
          <HandHeader hand={hand} inBB={settings.inBB} />
        </View>
        {/* The next hand from the one just saved: one tap, not back and then "Nova mão". */}
        <Row gap={S.sm}>
          {quick && !busy && !shareWaiting ? (
            <>
              <Button
                title={quick.label}
                icon={quick.icon}
                onPress={sendLast}
                style={{ flex: 1 }}
                lines={2}
              />
              <IconButton name="ellipsis-horizontal" size={46} label={t('Mais formas de partilhar')} onPress={() => setShareOpen(true)} />
            </>
          ) : (
            <Button title={busy ? t('A criar link…') : shareWaiting ? t('Link à espera de rede') : t('Partilhar')} icon="share-social" disabled={busy} onPress={() => setShareOpen(true)} style={{ flex: 1 }} lines={2} />
          )}
          {nextHere ? <Button kind="secondary" title={t('Próxima mão')} icon="add" onPress={() => router.replace('/hand/new')} style={{ flex: 1 }} lines={2} /> : null}
        </Row>
        {!isComplete(hand) && <Banner tone="warn" icon="create-outline" title={t('Mão por completar')} body={t('Toca para continuar onde ficaste.')} onPress={edit} />}
        {nextLeft ? (
          <Banner
            tone="warn"
            icon="create-outline"
            title={nextLeft.n === 1 ? t('Falta 1 mão por completar') : t('Faltam {n} mãos por completar', { n: nextLeft.n })}
            action={t('Acabar')}
            onPress={() => router.replace({ pathname: '/hand/new', params: { edit: nextLeft.id } })}
          />
        ) : null}
        {hand.voiceNote ? <VoiceNotePlayer uri={hand.voiceNote} /> : null}
        <Replayer hand={hand} source="own" initialInBB={settings.inBB} onInBB={(inBB) => setSettings({ inBB })} icm={!!settings.icm} onStreet={setStreet} seek={seek} streetNotes={hand.streetNotes} />
        <HandNav hand={hand} hands={hands} />
        <CoachThread hand={hand} name={settings.nickname} />
        <ReviewCard key={hand.id} hand={hand} onChange={saveHand} />


        {hand.shareId ? (
          <View onLayout={(e) => onCommentsLayout(e.nativeEvent.layout.y)}>
          <Section title={t('Comentários')} action={t('Atualizar')} onAction={loadComments}>
            <VoteTally votes={votes} />
            <CommentsList
              shareId={hand.shareId}
              comments={comments}
              onPosted={(c) =>
                setComments((x) => {
                  // Your own reply isn't news to you.
                  if (hand?.shareId) markCommentsSeen(hand.shareId, x.length + 1);
                  return [...x, c];
                })
              }
              defaultName={settings.nickname}
              streets={streets}
              street={street}
              onJumpStreet={jumpStreet}
              notes={hand.streetNotes}
              onNote={saveNote}
              onRemove={hand.shareToken ? removeOne : undefined}
              pending={pending}
              onUndo={undoRemove}
              ownerToken={hand.shareToken}
              onCompose={() => setTimeout(() => scroller.current?.scrollToEnd({ animated: !reduceMotion() }), 350)}
            />
            {hand.shareToken ? <Button kind="plain" size="sm" title={t('Apagar partilha')} style={{ alignSelf: 'center' }} onPress={unshare} /> : null}
          </Section>
          </View>
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
      {softAsk}
      <ShareSheet
        visible={shareOpen}
        header={
          hand.shareId ? null : (
            <Field label={t('O que queres saber? (opcional)')} value={ask} onChangeText={setAsk} placeholder={t('Ex.: call ou fold no river?')} maxLength={140} />
          )
        }
        onClose={() => setShareOpen(false)}
        groups={[
          {
            options: destinations,
          },
          {
            title: t('Mais'),
            options: [
              { icon: 'help-circle-outline', label: t('Desafio'), sub: t('Os amigos votam antes de ver o resultado'), onPress: () => share(true) },
              { icon: 'copy-outline', label: t('Texto para fórum'), sub: t('TwoPlusTwo, Reddit, grupos'), onPress: askCopyText },
              { icon: 'analytics-outline', label: t('Abrir no GTO Wizard'), onPress: () => openInGtoWizard([hand]) },
              { icon: 'document-text-outline', label: t('Exportar para solver'), sub: t('Formato hand history (.txt)'), onPress: exportSolver },
            ],
          },
        ]}
      />
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
