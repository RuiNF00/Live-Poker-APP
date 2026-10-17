import React from 'react';
import { View } from 'react-native';

import { comboLabel } from '@/poker/cards';
import { positions } from '@/poker/engine';
import { blindsLabel, shortDate, timeOf } from '@/poker/format';
import { STAGES, type Hand } from '@/poker/types';
import { C, R, ff } from '@/theme';

import { CardRow } from './PlayingCard';
import { Row, T } from './ui';

export function HandHeader({ hand }: { hand: Hand }) {
  const pos = positions(hand.players.length, hand.button);
  const g = hand.game;
  const stage = STAGES.find((s) => s.id === g.stage)?.label;
  const hero = hand.players[hand.hero];
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h1" numberOfLines={1}>
            {hand.title || g.name || (g.kind === 'mtt' ? 'Torneio' : 'Cash')}
          </T>
          <T v="small">
            {[blindsLabel(hand), g.level ? `Nível ${g.level}` : '', stage, g.playersLeft ? `${g.playersLeft} restantes` : '', `${hand.players.length} jog.`]
              .filter(Boolean)
              .join(' · ')}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {hero.cards?.length === 2 ? <CardRow cards={hero.cards} size="sm" /> : null}
          <T v="tiny">
            {pos[hand.hero]} · {comboLabel(hero.cards)} · {shortDate(hand.createdAt)} {timeOf(hand.createdAt)}
          </T>
        </View>
      </Row>
      {hand.tags.length > 0 && (
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          {hand.tags.map((t) => (
            <View key={t} style={{ backgroundColor: C.accentSoft, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
              <T v="tiny" color={C.accent} style={{ fontWeight: '800', fontFamily: ff(800) }}>
                {t}
              </T>
            </View>
          ))}
        </Row>
      )}
      {hand.notes ? (
        <T v="small" style={{ color: C.text, lineHeight: 19 }}>
          {hand.notes}
        </T>
      ) : null}
    </View>
  );
}
