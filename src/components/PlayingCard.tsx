import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

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

// Cards fill long lists (every hand row has up to seven), so each size and
// suit gets its styles built once instead of on every render.
const faceCache = new Map<string, ReturnType<typeof faceStyles>>();
function faceStyles(size: CardSize, suit: Suit) {
  const d = DIM[size];
  const col = C.suit[suit];
  return StyleSheet.create({
    face: {
      width: d.w,
      height: d.h,
      borderRadius: d.r,
      backgroundColor: '#F6F2E8',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.25)',
      paddingTop: size === 'xs' ? 1 : 2,
      paddingLeft: size === 'xs' ? 3 : size === 'sm' ? 4 : 5,
      overflow: 'hidden',
      // The smallest cards sit inside list rows: no shadow there, it costs a
      // paint per card while scrolling and barely shows at that size.
      ...(size === 'xs' ? null : { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }),
    },
    // 8% of the suit colour over the cream, without an extra opacity layer.
    tint: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', backgroundColor: col + '14' },
    rank: { color: col, fontSize: d.rank, fontWeight: '800', fontFamily: ff(800), lineHeight: d.rank * 1.08, letterSpacing: -0.5 },
    rank10: { letterSpacing: -1.5 },
    suit: { color: col, fontSize: d.suit, lineHeight: d.suit * 1.1, position: 'absolute', right: size === 'xs' ? 2 : 4, bottom: size === 'xs' ? 1 : 3 },
  });
}
function stylesFor(size: CardSize, suit: Suit) {
  const k = size + suit;
  let v = faceCache.get(k);
  if (!v) faceCache.set(k, (v = faceStyles(size, suit)));
  return v;
}

const fx = StyleSheet.create({ dim: { opacity: 0.35 }, highlight: { borderWidth: 2, borderColor: C.accent } });

export const PlayingCard = React.memo(function PlayingCard({
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
            backgroundColor: '#1A2521',
            borderWidth: 1,
            borderColor: 'rgba(255,106,61,0.55)',
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
  // Cream face with a 4-colour rank, like a real deck under casino light.
  const suit = card[1] as Suit;
  const st = stylesFor(size, suit);
  const rank = displayRank(card);
  return (
    <View style={[st.face, highlight && fx.highlight, dim && fx.dim, style]}>
      {size === 'xs' ? null : <View style={st.tint} />}
      <Text maxFontSizeMultiplier={1.3} style={[st.rank, rank.length > 1 && st.rank10]}>{rank}</Text>
      <Text maxFontSizeMultiplier={1.3} style={st.suit}>{SUIT_SYMBOL[suit]}</Text>
    </View>
  );
});

const row = StyleSheet.create({ row: { flexDirection: 'row' } });

export function CardRow({ cards, size = 'sm', gap = 3 }: { cards: CardCode[]; size?: CardSize; gap?: number }) {
  return (
    <View style={[row.row, { gap }]}>
      {cards.map((c, i) => (
        <PlayingCard key={c + i} card={c} size={size} />
      ))}
    </View>
  );
}
