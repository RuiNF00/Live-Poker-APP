// One tap per card: the whole deck as a 4×13 grid (suits × ranks), used cards
// greyed out. Faster than rank-then-suit pickers and it is what the eye scans
// fastest with a four-colour deck.

import React, { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { displayRank, RANKS, SUIT_SYMBOL, SUITS } from '@/poker/cards';
import type { CardCode } from '@/poker/types';
import { C } from '@/theme';

import { tap } from './ui';

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
                  disabled={isUsed}
                  onPress={() => {
                    tap('select');
                    onPick(c);
                  }}
                  style={({ pressed }) => ({
                    width: cw,
                    height: Math.min(48, cw * 1.38),
                    borderRadius: 5,
                    backgroundColor: isUsed ? C.surface2 : C.suit[s],
                    opacity: isUsed ? 0.35 : pressed ? 0.7 : 1,
                    borderWidth: isSel ? 2 : 0,
                    borderColor: C.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  })}>
                  <Text style={{ color: isUsed ? C.muted : '#fff', fontWeight: '900', fontSize: cw > 26 ? 15 : 13, letterSpacing: -0.5 }}>
                    {displayRank(c)}
                  </Text>
                  <Text style={{ color: isUsed ? C.muted : 'rgba(255,255,255,0.85)', fontSize: 9, lineHeight: 10 }}>{SUIT_SYMBOL[s]}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
    </View>
  );
}
