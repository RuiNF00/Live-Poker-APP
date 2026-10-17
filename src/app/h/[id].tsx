// Public replay page for a shared hand. On web this is what friends open from
// the link (no app needed); in the app, the same link opens here too.

import { Link, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { CommentsList } from '@/components/Comments';
import { HandHeader } from '@/components/HandHeader';
import { Replayer } from '@/components/Replayer';
import { Button, Empty, Row, T, Wordmark } from '@/components/ui';
import { t } from '@/i18n';
import { track } from '@/lib/events';
import { claimInvite } from '@/lib/referrals';
import { anonId, fetchComments, fetchHand, postComment, reportHand, type Comment } from '@/lib/share-api';
import type { Hand } from '@/poker/types';
import { BRAND, C, R } from '@/theme';

export default function SharedHand() {
  const { id, q, r, utm_source, utm_medium } = useLocalSearchParams<{ id: string; q?: string; r?: string; utm_source?: string; utm_medium?: string }>();
  // A friend's link opened in the app: credit the sharer and the channel.
  useEffect(() => {
    if (id && r) claimInvite(String(r), utm_medium === 'story' ? 'story' : 'share', String(id));
    if (id) track('link_opened', { share_id: id, ...(r ? { ref: String(r).slice(0, 20) } : {}), ...(utm_source ? { utm_source: String(utm_source) } : {}), ...(utm_medium ? { utm_medium: String(utm_medium) } : {}) });
  }, [id, r, utm_source, utm_medium]);
  const [hand, setHand] = useState<Hand | null>(null);
  const [err, setErr] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchHand(id).then(setHand).catch(() => setErr(true));
    fetchComments(id).then(setComments).catch(() => {});
  }, [id]);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      <Row style={{ justifyContent: 'space-between', paddingTop: Platform.OS === 'web' ? 4 : 44 }}>
        <Row gap={8}>
          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: C.accent }} />
          <Wordmark size={20} />
        </Row>
        <T v="tiny">{BRAND.tagline}</T>
      </Row>
      {err ? (
        <Empty title={t('Esta mão já não existe')} body={t('O link pode estar errado ou a mão foi apagada.')} />
      ) : !hand ? (
        <T v="small">{t('A carregar a mão…')}</T>
      ) : (
        <>
          <HandHeader hand={hand} quiz={q === '1'} />
          <Replayer
            hand={hand}
            autoPlay
            quiz={q === '1'}
            onVote={(choice) =>
              postComment(id!, { name: 'Voto', text: `🗳️ ${choice}` })
                .then((c) => setComments((x) => [...x, c]))
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
          <CommentsList shareId={id!} comments={comments} onPosted={(c) => setComments((x) => [...x, c])} />
          <Pressable
            disabled={reported}
            hitSlop={8}
            style={{ alignSelf: 'center', paddingTop: 8 }}
            onPress={() => {
              setReported(true);
              reportHand(id!, anonId()).catch(() => {});
            }}>
            <T v="tiny">{reported ? t('Obrigado, vamos rever esta mão.') : t('Denunciar esta mão')}</T>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
