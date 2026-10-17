import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { autoTags, positions, replay } from '@/poker/engine';
import { blindsLabel, shortDate, timeOf } from '@/poker/format';
import { STAGES, type Hand } from '@/poker/types';
import { C, S } from '@/theme';

import { CardRow } from './PlayingCard';
import { Badge, Card, Pill, Row, T } from './ui';

/** Title block of a hand: hero's cards and position, the game, tags and notes. */
export function HandHeader({ hand, quiz }: { hand: Hand; quiz?: boolean }) {
  const pos = positions(hand.players.length, hand.button);
  const g = hand.game;
  const stage = STAGES.find((s) => s.id === g.stage)?.label;
  const hero = hand.players[hand.hero];
  const auto = React.useMemo(() => (quiz ? [] : autoTags(hand, replay(hand))).filter((tg) => !hand.tags.includes(tg)), [hand, quiz]);
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
            {[blindsLabel(hand), g.level ? t('Nível {n}', { n: g.level }) : '', stage, g.playersLeft ? t('{n} restantes', { n: g.playersLeft }) : '', t('{n} jog.', { n: hand.players.length })]
              .filter(Boolean)
              .join(' · ')}
          </T>
        </View>
        {hero.cards?.length === 2 ? <CardRow cards={hero.cards} size="md" gap={3} /> : null}
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
