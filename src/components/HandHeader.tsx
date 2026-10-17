import React from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { comboLabel } from '@/poker/cards';
import { autoTags, positions, replay } from '@/poker/engine';
import { blindsLabel, shortDate, timeOf } from '@/poker/format';
import { STAGES, type Hand } from '@/poker/types';
import { C, R, ff } from '@/theme';

import { CardRow } from './PlayingCard';
import { Row, T } from './ui';

export function HandHeader({ hand, quiz }: { hand: Hand; quiz?: boolean }) {
  const pos = positions(hand.players.length, hand.button);
  const g = hand.game;
  const stage = STAGES.find((s) => s.id === g.stage)?.label;
  const hero = hand.players[hand.hero];
  const auto = React.useMemo(() => (quiz ? [] : autoTags(hand, replay(hand))).filter((tg) => !hand.tags.includes(tg)), [hand, quiz]);
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h1" numberOfLines={1}>
            {hand.title || g.name || (g.kind === 'mtt' ? t('Torneio') : 'Cash')}
          </T>
          <T v="small">
            {[blindsLabel(hand), g.level ? t('Nível {n}', { n: g.level }) : '', stage, g.playersLeft ? t('{n} restantes', { n: g.playersLeft }) : '', t('{n} jog.', { n: hand.players.length })]
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
      {hand.tags.length + auto.length > 0 && (
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          {hand.tags.map((tg) => (
            <View key={tg} style={{ backgroundColor: C.accentSoft, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
              <T v="tiny" color={C.accent} style={{ fontWeight: '800', fontFamily: ff(800) }}>
                {t(tg)}
              </T>
            </View>
          ))}
          {auto.map((tg) => (
            <View key={tg} style={{ borderColor: C.border, borderWidth: 1, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 2 }}>
              <T v="tiny">{t(tg)}</T>
            </View>
          ))}
        </Row>
      )}
      {hand.notes && !quiz ? (
        <T v="small" style={{ color: C.text, lineHeight: 19 }}>
          {hand.notes}
        </T>
      ) : null}
    </View>
  );
}
