// One tap per card: the whole deck as a 4×13 grid (suits × ranks), used cards
// greyed out. Faster than rank-then-suit pickers and it is what the eye scans
// fastest with a four-colour deck. Cards look like the replayer's: cream face,
// big rank in the suit colour, suit underneath.

import React, { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { displayRank, RANKS, SUIT_SYMBOL, SUITS } from '@/poker/cards';
import type { CardCode } from '@/poker/types';
import { C, ff } from '@/theme';

import { tap } from './ui';
import { cardName } from '@/poker/card-name';

const FACE = '#F5EDD8';
// Suit ink on the cream face: four colours, darker than the felt chips so they read on cream.
const INK: Record<string, string> = { s: '#1E1E1E', h: '#DC2626', d: '#2563EB', c: '#16A34A' };

export function CardPicker({
  used,
  selected = [],
  onPick,
}: {
  used: Set<string>;
  selected?: CardCode[];
  onPick: (c: CardCode) => void;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const gap = 3;
  const cw = w ? (w - gap * 12) / 13 : 0;
  return (
    <View onLayout={onLayout} style={{ gap }}>
      {w > 0 &&
        SUITS.map((s) => (
          <View key={s} style={{ flexDirection: 'row', gap }}>
            {RANKS.map((r) => {
              const c = r + s;
              const isSel = selected.includes(c);
              const isUsed = used.has(c) && !isSel;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={cardName(c)}
                  accessibilityState={{ selected: isSel, disabled: isUsed }}
                  disabled={isUsed}
                  onPress={() => {
                    tap('select');
                    onPick(c);
                  }}
                  style={({ pressed }) => ({
                    width: cw,
                    height: Math.min(50, cw * 1.45),
                    borderRadius: 6,
                    backgroundColor: isUsed ? C.surface2 : FACE,
                    opacity: isUsed ? 0.3 : pressed ? 0.7 : 1,
                    borderWidth: isSel ? 2.5 : 1,
                    borderColor: isSel ? C.accent : isUsed ? C.border : 'rgba(0,0,0,0.25)',
                    transform: [{ translateY: isSel ? -3 : 0 }],
                    alignItems: 'center',
                    justifyContent: 'center',
                  })}>
                  <Text style={{ color: isUsed ? C.muted : INK[s], fontWeight: '900', fontFamily: ff(900), fontSize: cw > 26 ? 17 : 14, lineHeight: cw > 26 ? 19 : 16, letterSpacing: -0.5 }}>
                    {displayRank(c)}
                  </Text>
                  <Text style={{ color: isUsed ? C.muted : INK[s], fontSize: cw > 26 ? 12 : 10, lineHeight: 13 }}>{SUIT_SYMBOL[s]}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
    </View>
  );
}
