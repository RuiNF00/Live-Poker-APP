// Public replay page for a shared hand. On web this is what friends open from
// the link (no app needed); in the app, the same link opens here too.

import { Link, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { CommentsList } from '@/components/Comments';
import { HandHeader } from '@/components/HandHeader';
import { Replayer } from '@/components/Replayer';
import { Button, Empty, Row, T, Wordmark } from '@/components/ui';
import { anonId, fetchComments, fetchHand, postComment, reportHand, type Comment } from '@/lib/share-api';
import type { Hand } from '@/poker/types';
import { BRAND, C, R } from '@/theme';

export default function SharedHand() {
  const { id, q } = useLocalSearchParams<{ id: string; q?: string }>();
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
        <Empty title="Esta mão já não existe" body="O link pode estar errado ou a mão foi apagada." />
      ) : !hand ? (
        <T v="small">A carregar a mão…</T>
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
            <T v="h2">Regista as tuas mãos live em segundos</T>
            <T v="small">
              {BRAND.name} grava mãos em poucos toques, faz o replay e partilha com os teus amigos. Sessões, bankroll e notas de jogadores incluídos.
            </T>
            <Link href="/" asChild>
              <Button title="Experimentar grátis" />
            </Link>
          </View>
          <T v="h2">Comentários</T>
          <CommentsList shareId={id!} comments={comments} onPosted={(c) => setComments((x) => [...x, c])} />
          <Pressable
            disabled={reported}
            hitSlop={8}
            style={{ alignSelf: 'center', paddingTop: 8 }}
            onPress={() => {
              setReported(true);
              reportHand(id!, anonId()).catch(() => {});
            }}>
            <T v="tiny">{reported ? 'Obrigado, vamos rever esta mão.' : 'Denunciar esta mão'}</T>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
