import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardRow } from '@/components/PlayingCard';
import { Button, Chip, Empty, Row, T, Wordmark } from '@/components/ui';
import { comboLabel } from '@/poker/cards';
import { positions, replay } from '@/poker/engine';
import { amount, blindsLabel, duration, shortDate, timeOf } from '@/poker/format';
import { sampleHand } from '@/poker/sample';
import { DEFAULT_TAGS, type Hand } from '@/poker/types';
import { uid, useStore } from '@/store/store';
import { BRAND, C, R, ff } from '@/theme';

export default function HandsScreen() {
  const insets = useSafeAreaInsets();
  const { hands, activeSession, saveHand, settings, draft } = useStore();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return [...hands]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((h) => (!tag || h.tags.includes(tag)) && (!qq || [h.game.name, h.notes, h.title, comboLabel(h.players[h.hero].cards), ...h.players.map((p) => p.name)].join(' ').toLowerCase().includes(qq)));
  }, [hands, q, tag]);

  const usedTags = useMemo(() => DEFAULT_TAGS.filter((t) => hands.some((h) => h.tags.includes(t))), [hands]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      <FlatList
        data={rows}
        keyExtractor={(h) => h.id}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Wordmark />
              <T v="small">{hands.length} mãos</T>
            </Row>
            {draft ? (
              <Pressable onPress={() => router.push('/hand/new')} style={{ backgroundColor: 'rgba(245,184,61,0.12)', borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: 'rgba(245,184,61,0.4)' }}>
                <T v="small" color={C.warn} style={{ fontWeight: '800', fontFamily: ff(800) }}>
                  Tens uma mão a meio — toca para continuar
                </T>
              </Pressable>
            ) : null}
            {activeSession ? (
              <Pressable onPress={() => router.push('/session')} style={{ backgroundColor: C.accentSoft, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: 'rgba(255,106,61,0.35)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />
                <View style={{ flex: 1 }}>
                  <T v="small" color={C.accent} style={{ fontWeight: '800', fontFamily: ff(800) }}>
                    Sessão em curso · {duration(Date.now() - activeSession.startedAt)}
                  </T>
                  <T v="tiny">
                    {activeSession.name || 'Sem nome'} · stack {amount(activeSession.stack, { game: { bb: activeSession.bb } as Hand['game'] }, false)}
                  </T>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.accent} />
              </Pressable>
            ) : null}
            {hands.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: 10, borderWidth: 1, borderColor: C.border }}>
                  <Ionicons name="search" size={16} color={C.muted} />
                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder="Procurar torneio, jogador, mão (AKs)…"
                    placeholderTextColor={C.muted}
                    style={{ flex: 1, color: C.text, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15 }}
                  />
                </View>
                {usedTags.length > 0 && (
                  <Row style={{ flexWrap: 'wrap' }} gap={6}>
                    {usedTags.map((t) => (
                      <Chip key={t} label={t} active={tag === t} onPress={() => setTag(tag === t ? null : t)} />
                    ))}
                  </Row>
                )}
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          hands.length === 0 ? (
            <Empty
              title="Regista a tua primeira mão"
              body="Toca no + em baixo: posição, cartas e ação em poucos toques. Depois vês o replay e partilhas com quem quiseres."
              action={
                <View style={{ gap: 8, width: '100%', marginTop: 8 }}>
                  <Button title="Nova mão" onPress={() => router.push('/hand/new')} />
                  <Button
                    title="Ver uma mão de exemplo"
                    kind="ghost"
                    onPress={() => {
                      const h = sampleHand(uid('h_'));
                      saveHand(h);
                      router.push({ pathname: '/hand/[id]', params: { id: h.id } });
                    }}
                  />
                </View>
              }
            />
          ) : (
            <Empty title="Nada encontrado" />
          )
        }
        renderItem={({ item }) => <HandRow hand={item} inBB={settings.inBB} />}
      />
    </View>
  );
}

function HandRow({ hand, inBB }: { hand: Hand; inBB: boolean }) {
  const r = useMemo(() => replay(hand), [hand]);
  const pos = positions(hand.players.length, hand.button);
  const net = r.result?.net[hand.hero];
  const hero = hand.players[hand.hero];
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/hand/[id]', params: { id: hand.id } })}
      style={({ pressed }) => ({ backgroundColor: C.surface, borderRadius: R.lg, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border, opacity: pressed ? 0.8 : 1 })}>
      {hero.cards?.length === 2 ? <CardRow cards={hero.cards} size="sm" gap={2} /> : <View style={{ width: 62 }} />}
      <View style={{ flex: 1, gap: 3 }}>
        <Row gap={6}>
          <T v="body" style={{ fontWeight: '800', fontFamily: ff(800) }}>
            {comboLabel(hero.cards)} {pos[hand.hero]}
          </T>
          {hand.board.length ? (
            <T v="tiny" numberOfLines={1}>
              {hand.board.map((c) => c[0] + ({ s: '♠', h: '♥', d: '♦', c: '♣' } as Record<string, string>)[c[1]]).join(' ')}
            </T>
          ) : null}
        </Row>
        <T v="small" numberOfLines={1}>
          {(hand.game.name || (hand.game.kind === 'mtt' ? 'Torneio' : 'Cash')) + ' · ' + blindsLabel(hand)}
        </T>
        {hand.tags.length ? (
          <T v="tiny" color={C.accent} numberOfLines={1}>
            {hand.tags.join(' · ')}
          </T>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        {net !== undefined ? (
          <T v="mono" color={net > 0 ? C.good : net < 0 ? C.bad : C.textDim}>
            {(net > 0 ? '+' : '') + amount(net, hand, inBB)}
          </T>
        ) : null}
        <T v="tiny">
          {shortDate(hand.createdAt)} {timeOf(hand.createdAt)}
        </T>
        {hand.shareId ? <Ionicons name="link" size={12} color={C.muted} /> : null}
      </View>
    </Pressable>
  );
}
