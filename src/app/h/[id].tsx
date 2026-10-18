// Public replay page for a shared hand. On web this is what friends open from
// the link (no app needed); in the app, the same link opens here too.

import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommentsList } from '@/components/Comments';
import { HandHeader } from '@/components/HandHeader';
import { Replayer } from '@/components/Replayer';
import { Button, confirmAction, Empty, IconButton, Row, T, Wordmark } from '@/components/ui';
import { t } from '@/i18n';
import { linkSource, noteSource } from '@/lib/attribution';
import { track } from '@/lib/events';
import { handLoadError, streetOfNew } from '@/lib/friend-hands-core';
import { blockCommenter, forgetFriendHand, hideFriendHand, markCommentsSeen, rememberFriendHand, useBlocked, useSharedHands } from '@/lib/friend-hands';
import { claimInvite } from '@/lib/referrals';
import { anonId, fetchComments, fetchHand, postComment, reportHand, type Comment } from '@/lib/share-api';
import { comboLabel } from '@/poker/cards';
import { replay } from '@/poker/engine';
import { blindsLabel } from '@/poker/format';
import type { Hand, Street } from '@/poker/types';
import { useStore } from '@/store/store';
import { BRAND, C, R } from '@/theme';

export default function SharedHand() {
  const insets = useSafeAreaInsets();
  // `c`: how many new comments brought you here (from "Mãos partilhadas"); the replay opens on the newest one's street.
  const { id, q, r, c: fresh, utm_source, utm_medium } = useLocalSearchParams<{ id: string; q?: string; r?: string; c?: string; utm_source?: string; utm_medium?: string }>();
  // A friend's link opened in the app: credit the sharer and the channel.
  useEffect(() => {
    if (id) noteSource(linkSource('hand', { r: r ? String(r) : undefined }));
    if (id && r) claimInvite(String(r), utm_medium === 'story' ? 'story' : 'share', String(id));
    if (id) track('link_opened', { share_id: id, ...(r ? { ref: String(r).slice(0, 20) } : {}), ...(utm_source ? { utm_source: String(utm_source) } : {}), ...(utm_medium ? { utm_medium: String(utm_medium) } : {}) });
  }, [id, r, utm_source, utm_medium]);
  const [hand, setHand] = useState<Hand | null>(null);
  const blocked = useBlocked();
  const [err, setErr] = useState<'gone' | 'offline' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [reported, setReported] = useState(false);
  const { hands, settings, setSettings } = useStore();
  const mine = !!id && hands.some((h) => h.shareId === id);
  const { friends } = useSharedHands();
  const listed = !!id && friends.some((f) => f.id === id);

  useEffect(() => {
    if (!id) return;
    // No signal is not a deleted hand: that one gets a retry, not «já não existe».
    fetchHand(id).then(setHand).catch((e) => setErr(handLoadError(e)));
    fetchComments(id).then(setComments).catch(() => setComments([]));
  }, [id, attempt]);
  // Opened from a link, the app has no header here: a way out on the phone (the web page is the whole site).
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // A friend's hand goes on "Mãos partilhadas", to come back to the conversation; yours is there already.
  // On the web build too, so the PC test link behaves like the phone.
  useEffect(() => {
    if (!id || !hand || mine) return;
    const cards = hand.players[hand.hero]?.cards;
    // The ante in brackets reads like a typo in a one-line title: blinds only.
    rememberFriendHand(id, [comboLabel(cards), blindsLabel({ game: { ...hand.game, ante: 0 } })].filter(Boolean).join(' · '), cards);
  }, [id, hand, mine]);
  const visible = (comments ?? []).filter((c) => !blocked.commenter(c.by));
  const block = (c: Comment) =>
    confirmAction(t('Bloquear {name}?', { name: c.name }), t('Deixas de ver os comentários desta pessoa nesta mão. Ela não é avisada.'), t('Bloquear'), () => blockCommenter(c.by!), true);
  useEffect(() => {
    if (id && comments) markCommentsSeen(id, comments.length);
  }, [id, comments]);
  const [seek, setSeek] = useState<{ street: Street; n: number }>();
  // The street on screen: a new comment is about it unless unticked, like on your own hand.
  const [street, setStreet] = useState<Street>('preflop');
  const streets = useMemo(() => {
    if (!hand) return [];
    const seen = new Set(replay(hand).steps.map((s) => s.street));
    return (['preflop', 'flop', 'turn', 'river'] as Street[]).filter((x) => seen.has(x));
  }, [hand]);
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !comments?.length || !hand) return;
    opened.current = true;
    const st = streetOfNew(comments, Number(fresh));
    if (st) setSeek({ street: st, n: 1 });
  }, [comments, fresh, hand]);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      <Row style={{ justifyContent: 'space-between', paddingTop: Platform.OS === 'web' ? 4 : Platform.OS === 'android' ? insets.top + 4 : 44 }}>
        <Row gap={8}>
          {Platform.OS === 'web' ? null : <IconButton name="chevron-back" label={t('Voltar')} onPress={close} size={32} />}
          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: C.accent }} />
          <Wordmark size={20} />
        </Row>
        <T v="tiny">{BRAND.tagline}</T>
      </Row>
      {err === 'gone' ? (
        <Empty title={t('Esta mão já não existe')} body={t('O link pode estar errado ou a mão foi apagada.')} />
      ) : err === 'offline' ? (
        <Empty title={t('Sem ligação')} body={t('Sem ligação. Tenta outra vez quando tiveres rede.')} action={<Button kind="secondary" size="md" icon="refresh" title={t('Tentar outra vez')} onPress={() => (setErr(null), setAttempt((n) => n + 1))} />} />
      ) : !hand ? (
        <T v="small">{t('A carregar a mão…')}</T>
      ) : (
        <>
          <HandHeader hand={hand} quiz={q === '1'} />
          {hand.ask ? (
            <T v="h3" style={{ paddingHorizontal: 2 }}>
              “{hand.ask}”
            </T>
          ) : null}
          <Replayer
            source="shared"
            hand={hand}
            initialInBB={settings.inBB}
            onInBB={(inBB) => setSettings({ inBB })}
            autoPlay={!seek}
            seek={seek}
            onStreet={setStreet}
            quiz={q === '1'}
            onVote={(choice) =>
              postComment(id!, { name: 'Voto', text: `🗳️ ${choice}` })
                .then((c) => setComments((x) => [...(x ?? []), c]))
                .catch(() => {})
            }
          />
          <View style={{ backgroundColor: C.accentSoft, borderRadius: R.lg, padding: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(255,106,61,0.35)' }}>
            <T v="h2">{t('Regista as tuas mãos live em segundos')}</T>
            <T v="small">
              {t('{brand} grava mãos em poucos toques, faz o replay e partilha com os teus amigos. Sessões, bankroll e notas de jogadores incluídos.', { brand: BRAND.name })}
            </T>
            <Link href="/" asChild>
              <Button title={t('Experimentar grátis')} />
            </Link>
          </View>
          <T v="h2">{t('Comentários')}</T>
          <CommentsList shareId={id!} defaultName={settings.nickname} comments={visible} onPosted={(c) => setComments((x) => [...(x ?? []), c])} onBlock={mine ? undefined : block}
            streets={streets}
            street={street}
            onJumpStreet={(st) => setSeek((x) => ({ street: st, n: (x?.n ?? 0) + 1 }))}
          />
          <Pressable
            disabled={reported}
            hitSlop={8}
            style={{ alignSelf: 'center', paddingTop: 8 }}
            onPress={() => {
              setReported(true);
              reportHand(id!, anonId()).catch(() => {});
              if (!mine) hideFriendHand(id!);
            }}>
            <T v="tiny">{reported ? t('Obrigado, vamos rever esta mão.') : t('Denunciar esta mão')}</T>
          </Pressable>
          {listed && !reported ? (
            <Pressable hitSlop={8} style={{ alignSelf: 'center' }} accessibilityRole="button" onPress={() => forgetFriendHand(id!)}>
              <T v="tiny">{t('Tirar das mãos partilhadas')}</T>
            </Pressable>
          ) : null}
          {/* Contact on the screen itself (App Store 1.2): a problem with this hand or a comment, one tap to write. */}
          <T v="tiny" style={{ textAlign: 'center' }}>
            {t('Algum problema com uma mão ou comentário? Escreve para')}{' '}
            <T v="tiny" style={{ textDecorationLine: 'underline' }} accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(`h/${id}`)}`).catch(() => {})}>
              {BRAND.supportEmail}
            </T>
          </T>

        </>
      )}
    </ScrollView>
  );
}
