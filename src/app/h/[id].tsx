// Public replay page for a shared hand. On web this is what friends open from
// the link (no app needed); in the app, the same link opens here too.

import { Link, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { CommentsList } from '@/components/Comments';
import { HandHeader } from '@/components/HandHeader';
import { Replayer } from '@/components/Replayer';
import { Button, Empty, Row, T } from '@/components/ui';
import { fetchComments, fetchHand, type Comment } from '@/lib/share-api';
import type { Hand } from '@/poker/types';
import { BRAND, C, R } from '@/theme';

export default function SharedHand() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [hand, setHand] = useState<Hand | null>(null);
  const [err, setErr] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);

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
          <T v="h2">{BRAND.name}</T>
        </Row>
        <T v="tiny">{BRAND.tagline}</T>
      </Row>
      {err ? (
        <Empty title="Esta mão já não existe" body="O link pode estar errado ou a mão foi apagada." />
      ) : !hand ? (
        <T v="small">A carregar a mão…</T>
      ) : (
        <>
          <HandHeader hand={hand} />
          <Replayer hand={hand} autoPlay />
          <View style={{ backgroundColor: C.accentSoft, borderRadius: R.lg, padding: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(61,220,151,0.35)' }}>
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
        </>
      )}
    </ScrollView>
  );
}
