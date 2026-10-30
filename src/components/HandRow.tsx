// One hand in a list: hero cards, position, game, result and board.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CardRow, PlayingCard } from '@/components/PlayingCard';
import { Badge, Pill, Row, T } from '@/components/ui';
import { t } from '@/i18n';
import { cardName, comboLabel } from '@/poker/cards';
import { positions } from '@/poker/engine';
import { amount, blindsLabel, timeOf } from '@/poker/format';
import type { Hand } from '@/poker/types';
import { handSummary } from '@/store/hand-summary';
import { C, R, SHADOW } from '@/theme';

const NARROW = Dimensions.get('window').width < 380;

// Replaying a hand is the costly part of a row: kept per hand version, in memory and on the
// phone (store/hand-summary), so rows and launches don't replay again.
export function rowSummary(hand: Hand): { net: number | undefined; done: boolean } {
  return handSummary(hand);
}

export const isIncomplete = (h: Hand) => !rowSummary(h).done;
export const netOf = (h: Hand) => rowSummary(h).net;

export const HandRow = React.memo(function HandRow({ hand, inBB, picking = false, picked = false, onPick, coach = 0, queue, snippet }: { hand: Hand; inBB: boolean; picking?: boolean; picked?: boolean; onPick?: (id: string) => void; coach?: number; queue?: boolean; snippet?: string | null }) {
  const { net, done } = rowSummary(hand);
  const heroPos = positions(hand.players.length, hand.button)[hand.hero];
  // Next to a full board only two tags fit on the line at 390 pt.
  // A 360-wide phone fits a full board and one tag (plus the +n) on the line; so does big system text.
  const win = useWindowDimensions();
  const bigText = win.fontScale >= 1.4;
  // At 1.3× and up on a 375-pt phone the drawn cards left «AKo» a letter wide: the combo says them.
  const noArt = win.width / win.fontScale < 300;
  const maxTags = Math.max(1, (hand.board.length > 3 || !done ? 2 : 3) - (NARROW || bigText ? 1 : 0));
  const hero = hand.players[hand.hero];
  // Read as one line: the cards by name (not the drawing and then «AKo» again), where, the result and
  // what the pills say, instead of each piece of the row in turn.
  const label = [
    hero.cards?.length ? hero.cards.map(cardName).join(', ') : t('Sem cartas'),
    heroPos,
    hand.game.name || hand.game.venue || (hand.game.kind === 'mtt' ? t('Torneio') : 'Cash'),
    blindsLabel(hand),
    net !== undefined ? `${t('Resultado')}: ${(net > 0 ? '+' : '') + amount(net, hand, inBB)}` : '',
    timeOf(hand.createdAt),
    hand.board.length ? `${t('Mesa')}: ${hand.board.map(cardName).join(', ')}` : '',
    coach ? (coach === 1 ? t('1 comentário do coach') : t('{n} comentários do coach', { n: coach })) : '',
    !done ? t('Por completar') : '',
    ...hand.tags.map((x) => t(x)),
    hand.shareId ? t('Partilhada') : '',
    snippet ?? '',
  ].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={picking ? { selected: picked } : undefined}
      // An unfinished hand opens where it stopped: finishing it is why it's tapped.
      onPress={() => (picking && onPick ? onPick(hand.id) : done ? router.push({ pathname: '/hand/[id]', params: queue ? { id: hand.id, q: 'all' } : { id: hand.id } }) : router.push({ pathname: '/hand/new', params: { edit: hand.id } }))}
      onLongPress={onPick ? () => onPick(hand.id) : undefined}
      // The long press that starts picking, for VoiceOver and TalkBack too.
      accessibilityActions={picking || !onPick ? undefined : [{ name: 'longpress', label: t('Selecionar') }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onPick?.(hand.id)}
      delayLongPress={350}
      style={({ pressed }) => (picked ? rowSt.picked : pressed ? rowSt.pressed : rowSt.row)}>
      <Row gap={12}>
        {picking ? <Ionicons name={picked ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={picked ? C.accent : C.muted} /> : null}
        {noArt ? null : hero.cards?.length === 2 ? <CardRow cards={hero.cards} size="sm" gap={2} /> : <View style={rowSt.noCards} />}
        <View style={rowSt.main}>
          <Row gap={6}>
            <T v="h3" numberOfLines={1} style={rowSt.combo}>
              {comboLabel(hero.cards) || t('Sem cartas')}
            </T>
            <Badge label={heroPos} />
          </Row>
          <T v="small" numberOfLines={1}>
            {/* With no game name the venue says where it was, which «Cash» alone never does. */}
            {(hand.game.name || hand.game.venue || (hand.game.kind === 'mtt' ? t('Torneio') : 'Cash')) + ' · ' + blindsLabel(hand)}
          </T>
        </View>
        <View style={rowSt.side}>
          {net !== undefined ? (
            <T v="mono" color={net > 0 ? C.good : net < 0 ? C.bad : C.textDim}>
              {(net > 0 ? '+' : '') + amount(net, hand, inBB)}
            </T>
          ) : (
            <T v="mono" color={C.muted}>
              —
            </T>
          )}
          <T v="monoS">{timeOf(hand.createdAt)}</T>
        </View>
      </Row>
      {snippet ? (
        // The search found this in a note: show the line, so the reason the hand is here is on the row.
        <Row gap={6}>
          <Ionicons name="chatbubble-ellipses-outline" size={13} color={C.muted} />
          <T v="small" numberOfLines={1} style={rowSt.snippet}>
            {snippet}
          </T>
        </Row>
      ) : null}
      {hand.board.length || hand.tags.length || !done || hand.shareId || coach ? (
        <Row gap={6} style={rowSt.wrap}>
          {hand.board.length ? (
            <Row gap={2} style={rowSt.board}>
              {hand.board.map((c, i) => (
                <PlayingCard key={c + i} card={c} size="xs" />
              ))}
            </Row>
          ) : null}
          {coach ? <Pill icon="school" label={coach === 1 ? t('1 comentário do coach') : t('{n} comentários do coach', { n: coach })} color={C.accent} /> : null}
          {!done ? <Pill label={t('Por completar')} color={C.warn} /> : null}
          {hand.tags.slice(0, maxTags).map((x) => (
            <Pill key={x} label={t(x)} />
          ))}
          {hand.tags.length > maxTags ? <Pill label={`+${hand.tags.length - maxTags}`} /> : null}
          {hand.shareId ? <Pill icon="link" label={t('Partilhada')} color={C.info} /> : null}
        </Row>
      ) : null}
    </Pressable>
  );
});

const rowBase = { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 12, gap: 10, ...SHADOW };
const rowSt = StyleSheet.create({
  row: rowBase,
  pressed: { ...rowBase, backgroundColor: C.surface2 },
  picked: { ...rowBase, backgroundColor: C.accentSoft, borderColor: C.accentLine },
  noCards: { width: 62, height: 42, borderRadius: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: C.borderStrong },
  main: { flex: 1, gap: 3 },
  side: { alignItems: 'flex-end', gap: 4 },
  combo: { fontSize: 16 },
  wrap: { flexWrap: 'wrap' },
  board: { marginRight: 4 },
  snippet: { flex: 1, fontStyle: 'italic' },
});
