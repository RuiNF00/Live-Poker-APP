import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePro } from '@/billing/pro';
import { CardRow } from '@/components/PlayingCard';
import { Button, Chip, Empty, Row, T, Wordmark } from '@/components/ui';
import { t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { positions, replay, isComplete } from '@/poker/engine';
import { amount, blindsLabel, duration, shortDate, timeOf } from '@/poker/format';
import { DEFAULT_TAGS, type Hand } from '@/poker/types';
import { useStore } from '@/store/store';
import { BRAND, C, R, ff } from '@/theme';

export default function HandsScreen() {
  const insets = useSafeAreaInsets();
  const { hands, activeSession, settings, draft, setDraft } = useStore();
  const { handsLeft, paywall } = usePro();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return [...hands]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((h) => (!tag || h.tags.includes(tag)) && (!qq || [h.game.name, h.notes, h.title, comboLabel(h.players[h.hero].cards), ...h.players.map((p) => p.name)].join(' ').toLowerCase().includes(qq)));
  }, [hands, q, tag]);

  const usedTags = useMemo(() => DEFAULT_TAGS.filter((tg) => hands.some((h) => h.tags.includes(tg))), [hands]);

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
              <Row gap={12}>
                <T v="small">{hands.length === 1 ? t('1 mão') : t('{n} mãos', { n: hands.length })}</T>
                <Pressable hitSlop={10} onPress={() => router.push('/settings')} accessibilityLabel={t('Definições')}>
                  <Ionicons name="settings-outline" size={21} color={C.textDim} />
                </Pressable>
              </Row>
            </Row>
            {handsLeft !== null && hands.length > 0 ? (
              <Pressable
                onPress={() => paywall(handsLeft === 0 ? 'hands' : 'generic')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: R.md, padding: 10, borderWidth: 1, borderColor: handsLeft === 0 ? 'rgba(255,106,61,0.45)' : C.border }}>
                <Ionicons name="flash" size={14} color={C.accent} />
                <T v="small" style={{ flex: 1 }}>
                  {handsLeft === 0 ? t('Já usaste as mãos grátis de hoje') : handsLeft === 1 ? t('1 mão grátis hoje') : t('{n} mãos grátis hoje', { n: handsLeft })}
                </T>
                <T v="small" color={C.accent} style={{ fontWeight: '800', fontFamily: ff(800) }}>
                  {t('Pro sem limites')}
                </T>
              </Pressable>
            ) : null}
            {draft && (draft.actions.length || draft.players[draft.hero].cards?.length) ? (
              <Pressable onPress={() => router.push('/hand/new')} style={{ backgroundColor: 'rgba(245,184,61,0.12)', borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: 'rgba(245,184,61,0.4)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T v="small" color={C.warn} style={{ flex: 1, fontWeight: '800', fontFamily: ff(800) }}>
                  {t('Tens uma mão a meio — toca para continuar')}
                </T>
                <Pressable hitSlop={8} onPress={() => setDraft(null)}>
                  <T v="tiny">{t('Descartar')}</T>
                </Pressable>
              </Pressable>
            ) : null}
            {activeSession ? (
              <Pressable onPress={() => router.push('/session')} style={{ backgroundColor: C.accentSoft, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: 'rgba(255,106,61,0.35)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />
                <View style={{ flex: 1 }}>
                  <T v="small" color={C.accent} style={{ fontWeight: '800', fontFamily: ff(800) }}>
                    {t('Sessão em curso')} · {duration(Date.now() - activeSession.startedAt)}
                  </T>
                  <T v="tiny">
                    {activeSession.name || t('Sem nome')} · stack {amount(activeSession.stack, { game: { bb: activeSession.bb } as Hand['game'] }, false)}
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
                    placeholder={t('Procurar torneio, jogador, mão (AKs)…')}
                    placeholderTextColor={C.muted}
                    style={{ flex: 1, color: C.text, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15 }}
                  />
                </View>
                {usedTags.length > 0 && (
                  <Row style={{ flexWrap: 'wrap' }} gap={6}>
                    {usedTags.map((tg) => (
                      <Chip key={tg} label={t(tg)} active={tag === tg} onPress={() => setTag(tag === tg ? null : tg)} />
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
              title={t('Regista a tua primeira mão')}
              body={t('Toca no + em baixo: posição, cartas e ação em poucos toques. Depois vês o replay e partilhas com quem quiseres.')}
              action={
                <View style={{ gap: 8, width: '100%', marginTop: 8 }}>
                  <Button title={t('Nova mão')} onPress={() => router.push('/hand/new')} />
                  <Button
                    title={t('Ver uma mão de exemplo')}
                    kind="ghost"
                    onPress={() => router.push({ pathname: '/hand/[id]', params: { id: 'sample' } })}
                  />
                </View>
              }
            />
          ) : (
            <Empty title={t('Nada encontrado')} />
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
  const net = r.result?.resolved ? r.result.net[hand.hero] : undefined;
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
          {(hand.game.name || (hand.game.kind === 'mtt' ? t('Torneio') : 'Cash')) + ' · ' + blindsLabel(hand)}
        </T>
        {!isComplete(hand, r) ? (
          <T v="tiny" color={C.warn}>
            {t('Por completar')}
          </T>
        ) : null}
        {hand.tags.length ? (
          <T v="tiny" color={C.accent} numberOfLines={1}>
            {hand.tags.map((x) => t(x)).join(' · ')}
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
