import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { displayRank, SUIT_SYMBOL } from '@/poker/cards';
import type { CardCode, Suit } from '@/poker/types';
import { C, ff } from '@/theme';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const DIM: Record<CardSize, { w: number; h: number; rank: number; suit: number; r: number }> = {
  xs: { w: 22, h: 30, rank: 13, suit: 10, r: 4 },
  sm: { w: 30, h: 42, rank: 17, suit: 13, r: 5 },
  md: { w: 40, h: 56, rank: 22, suit: 17, r: 6 },
  lg: { w: 52, h: 72, rank: 28, suit: 22, r: 8 },
};

export function PlayingCard({
  card,
  size = 'md',
  faceDown,
  dim,
  highlight,
  style,
}: {
  card?: CardCode;
  size?: CardSize;
  faceDown?: boolean;
  dim?: boolean;
  highlight?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const d = DIM[size];
  if (faceDown || !card) {
    return (
      <View
        style={[
          {
            width: d.w,
            height: d.h,
            borderRadius: d.r,
            backgroundColor: '#22302B',
            borderWidth: 1.5,
            borderColor: '#FF6A3D',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: dim ? 0.35 : 1,
          },
          style,
        ]}>
        <View
          style={{
            width: d.w - 8,
            height: d.h - 8,
            borderRadius: d.r - 2,
            borderWidth: 1,
            borderColor: 'rgba(255,106,61,0.45)',
            backgroundColor: '#1B2723',
          }}
        />
      </View>
    );
  }
  const suit = card[1] as Suit;
  const col = C.suit[suit];
  return (
    <View
      style={[
        {
          width: d.w,
          height: d.h,
          borderRadius: d.r,
          backgroundColor: col,
          borderWidth: highlight ? 2 : 1,
          borderColor: highlight ? C.accent : 'rgba(255,255,255,0.22)',
          paddingTop: size === 'xs' ? 1 : 3,
          paddingLeft: size === 'xs' ? 3 : 4,
          opacity: dim ? 0.35 : 1,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        },
        style,
      ]}>
      <Text style={{ color: '#fff', fontSize: d.rank, fontWeight: '900', fontFamily: ff(900), lineHeight: d.rank * 1.05, letterSpacing: -1 }}>
        {displayRank(card)}
      </Text>
      <Text
        style={{
          color: 'rgba(255,255,255,0.92)',
          fontSize: d.suit,
          lineHeight: d.suit * 1.1,
          position: 'absolute',
          right: size === 'xs' ? 2 : 4,
          bottom: size === 'xs' ? 1 : 3,
        }}>
        {SUIT_SYMBOL[suit]}
      </Text>
    </View>
  );
}

export function CardRow({ cards, size = 'sm', gap = 3 }: { cards: CardCode[]; size?: CardSize; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {cards.map((c, i) => (
        <PlayingCard key={c + i} card={c} size={size} />
      ))}
    </View>
  );
}
