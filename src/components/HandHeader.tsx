import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { autoTags, positions, replay } from '@/poker/engine';
import { amount, blindsLabel, shortDate, timeOf } from '@/poker/format';
import { STAGES, type Hand } from '@/poker/types';
import { C, S } from '@/theme';

import { CardRow } from './PlayingCard';
import { Badge, Card, Pill, Row, T } from './ui';

/** Title block of a hand: hero's cards and position, the game, tags and notes. */
export function HandHeader({ hand, quiz, inBB = false }: { hand: Hand; quiz?: boolean; inBB?: boolean }) {
  const pos = positions(hand.players.length, hand.button);
  const g = hand.game;
  const stage = STAGES.find((s) => s.id === g.stage)?.label;
  const hero = hand.players[hand.hero];
  const r = replay(hand);
  const auto = (quiz ? [] : autoTags(hand, r)).filter((tg) => !hand.tags.includes(tg));
  // Hero's own result; hidden in quiz mode so it doesn't give the answer away.
  const net = !quiz && r.result?.resolved ? r.result.net[hand.hero] : undefined;
  return (
    <View style={{ gap: S.md }}>
      <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Row gap={6}>
            <Badge label={pos[hand.hero]} />
            <T v="monoS">
              {comboLabel(hero.cards)} · {shortDate(hand.createdAt)} {timeOf(hand.createdAt)}
            </T>
          </Row>
          <T v="h1" numberOfLines={2}>
            {hand.title || g.name || (g.kind === 'mtt' ? t('Torneio') : 'Cash')}
          </T>
          <T v="small">
            {[blindsLabel(hand), g.kind === 'mtt' && g.level ? t('Nível {n}', { n: g.level }) : '', stage, g.kind === 'mtt' && g.playersLeft ? t('{n} restantes', { n: g.playersLeft }) : '', t('{n} jog.', { n: hand.players.length })]
              .filter(Boolean)
              .join(' · ')}
          </T>
        </View>
        {hero.cards?.length === 2 || net !== undefined ? (
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            {hero.cards?.length === 2 ? <CardRow cards={hero.cards} size="md" gap={3} /> : null}
            {net !== undefined ? (
              <T v="monoL" color={net > 0 ? C.good : net < 0 ? C.bad : C.textDim} accessibilityLabel={t('Resultado')}>
                {(net > 0 ? '+' : '') + amount(net, hand, inBB)}
              </T>
            ) : null}
          </View>
        ) : null}
      </Row>
      {hand.tags.length + auto.length > 0 && (
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          {hand.tags.map((tg) => (
            <Pill key={tg} label={t(tg)} color={C.accent} />
          ))}
          {auto.map((tg) => (
            <Pill key={tg} label={t(tg)} />
          ))}
        </Row>
      )}
      {hand.notes && !quiz ? (
        <Card tone="inset" style={{ flexDirection: 'row', gap: 10, paddingVertical: 12 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.muted} style={{ marginTop: 2 }} />
          <T v="callout" style={{ flex: 1, color: C.text }}>
            {hand.notes}
          </T>
        </Card>
      ) : null}
    </View>
  );
}
