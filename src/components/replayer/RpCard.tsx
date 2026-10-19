// Ivory playing card with a bold rank, and a near-black back with the brand mark:
// the card style of the stats-app replayer, readable at a glance on a phone.

import React from 'react';
import { Platform, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { displayRank, SUIT_SYMBOL } from '@/poker/cards';
import type { CardCode, Suit } from '@/poker/types';
import { C, ff } from '@/theme';

export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: "Georgia, 'Times New Roman', serif" });

/** Four-colour deck on ivory: spades near-black, hearts red, diamonds blue, clubs green; each at 4.5:1 or better. */
const INK: Record<Suit, string> = { s: '#1E1E1E', h: '#C62828', d: '#2259D6', c: '#127A3A' };

export function RpCard({
  card,
  w,
  h,
  faceDown,
  style,
}: {
  card?: CardCode | null;
  w: number;
  h: number;
  faceDown?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const r = Math.round(w * 0.14);
  if (faceDown || !card) {
    return (
      <View
        style={[
          {
            width: w,
            height: h,
            borderRadius: r,
            backgroundColor: '#15110E',
            borderWidth: 1,
            borderColor: 'rgba(255,106,61,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
          },
          style,
        ]}>
        <View style={{ position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderRadius: r - 2, borderWidth: 1, borderColor: 'rgba(255,106,61,0.22)' }} />
        <Text allowFontScaling={false} style={{ color: C.accent, fontFamily: ff(800), fontSize: w * 0.46, opacity: 0.85 }}>S</Text>
      </View>
    );
  }
  const suit = card[1] as Suit;
  const ink = INK[suit];
  const rank = displayRank(card);
  return (
    <View
      style={[
        {
          width: w,
          height: h,
          borderRadius: r,
          backgroundColor: '#F6F0E1',
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.25)',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        },
        style,
      ]}>
      <Text
        allowFontScaling={false}
        style={{ color: ink, fontFamily: ff(800), fontSize: w * (rank.length > 1 ? 0.5 : 0.62), lineHeight: w * 0.7, letterSpacing: rank.length > 1 ? -1.5 : 0 }}>
        {rank}
      </Text>
      <Text allowFontScaling={false} style={{ color: ink, fontSize: w * 0.4, lineHeight: w * 0.46, marginTop: -w * 0.04 }}>
        {SUIT_SYMBOL[suit]}
      </Text>
    </View>
  );
}
