// The replayer's table for a phone held upright: charcoal felt with a thin rail,
// seats placed by hand for every table size (layout.ts), ivory cards, chip stacks
// and an action badge on each plate. Visual base: the stats-app replayer.

import React, { useEffect, useState } from 'react';
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BRAND, C, F, ff } from '@/theme';

import { ChipStack } from './ChipStack';
import { BOARD_Y, BRAND_Y, dealerSpot, POT_Y, scaleFor, SIZE, STAGE_RATIO, tableMap } from './layout';
import type { BadgeKind, RpSeat, RpView } from './model';
import { RpCard, SERIF } from './RpCard';

export const POS_COLOR: Record<string, { bg: string; fg: string }> = {
  BTN: { bg: '#C8A84E', fg: '#111' },
  CO: { bg: '#3B82F6', fg: '#fff' },
  HJ: { bg: '#8B5CF6', fg: '#fff' },
  LJ: { bg: '#A855F7', fg: '#fff' },
  MP: { bg: '#A855F7', fg: '#fff' },
  UTG: { bg: '#EF4444', fg: '#fff' },
  'UTG+1': { bg: '#F87171', fg: '#fff' },
  'UTG+2': { bg: '#FB923C', fg: '#fff' },
  SB: { bg: '#6B7280', fg: '#fff' },
  BB: { bg: '#6B7280', fg: '#fff' },
};

export const BADGE: Record<BadgeKind, { bg: string; fg: string }> = {
  fold: { bg: '#3A3A42', fg: '#CCC' },
  check: { bg: '#27AE60', fg: '#000' },
  call: { bg: '#2ECC71', fg: '#000' },
  bet: { bg: '#F39C12', fg: '#000' },
  raise: { bg: '#F39C12', fg: '#000' },
  allin: { bg: '#E74C3C', fg: '#fff' },
};


/** Fades a card or chip in when it first appears. */
function Appear({ children, style }: { children: React.ReactNode; style?: object }) {
  const [o] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(o, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [o]);
  return <Animated.View style={[style, { opacity: o, transform: [{ translateY: o.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }]}>{children}</Animated.View>;
}

export function ReplayerTable({
  view,
  heroIndex,
  button,
  onTapLeft,
  onTapRight,
}: {
  view: RpView;
  heroIndex: number;
  button: number;
  onTapLeft?: () => void;
  onTapRight?: () => void;
}) {
  const [w, setW] = useState(0);
  const h = w * STAGE_RATIO;
  const k = scaleFor(w || 366);
  const n = view.seats.length;
  const map = tableMap(n);
  const vis = (i: number) => (i - heroIndex + n) % n;

  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));

  const boardW = SIZE.boardCardW * k;
  const boardH = SIZE.boardCardH * k;

  return (
    <View onLayout={onLayout} style={{ width: '100%', height: h || undefined, aspectRatio: w ? undefined : 1 / STAGE_RATIO }}>
      {w > 0 && (
        <Pressable
          style={{ flex: 1 }}
          onPress={(e) => (e.nativeEvent.locationX < w * 0.35 ? onTapLeft?.() : onTapRight?.())}
          accessibilityRole="button"
          accessibilityLabel="Mesa">
          <Felt w={w} h={h} />

          <Text
            style={{
              position: 'absolute',
              top: (BRAND_Y / 100) * h - 8,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: 'rgba(245,237,216,0.16)',
              fontFamily: SERIF,
              fontSize: 13 * k,
              letterSpacing: 7 * k,
            }}>
            {BRAND.name.toUpperCase()}
          </Text>
          {/* board */}
          <View style={{ position: 'absolute', left: 0, right: 0, top: (BOARD_Y / 100) * h - boardH / 2, flexDirection: 'row', justifyContent: 'center', gap: SIZE.boardGap * k }}>
            {[0, 1, 2, 3, 4].map((c) =>
              view.board[c] ? (
                <Appear key={view.board[c]}>
                  <RpCard card={view.board[c]} w={boardW} h={boardH} />
                </Appear>
              ) : (
                <View key={'slot' + c} style={{ width: boardW, height: boardH, borderRadius: boardW * 0.14, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(245,237,216,0.12)' }} />
              ),
            )}
          </View>

          {/* pot */}
          {view.pot > 0 ? (
            <View style={{ position: 'absolute', left: 0, right: 0, top: (POT_Y / 100) * h - 13 * k, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
                <ChipStack amount={view.pot} size={13 * k} />
                <Pill text={view.potLabel} k={k} strong />
              </View>
            </View>
          ) : null}

          {/* bets */}
          {view.seats.map((s) =>
            s.bet > 0 && s.betLabel ? (
              <View
                key={'b' + s.i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (map.bets[vis(s.i)].x / 100) * w - (SIZE.betW * k) / 2,
                  top: (map.bets[vis(s.i)].y / 100) * h - (SIZE.betH * k) / 2,
                  width: SIZE.betW * k,
                  height: SIZE.betH * k,
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: 3,
                }}>
                <ChipStack amount={s.bet} size={11 * k} />
                <Pill text={s.betLabel} k={k} />
              </View>
            ) : null,
          )}

          {/* dealer button */}
          {(() => {
            const d = dealerSpot(map.seats[vis(button)], map.bets[vis(button)]);
            const size = 18 * k;
            return (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (d.x / 100) * w - size / 2,
                  top: (d.y / 100) * h - size / 2,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: '#F4EFE1',
                  borderWidth: 1,
                  borderColor: '#B9AF92',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ color: '#3B3424', fontSize: 10 * k, fontFamily: SERIF, fontWeight: '700' }}>D</Text>
              </View>
            );
          })()}

          {/* seats */}
          {view.seats.map((s) => (
            <Seat key={'s' + s.i} seat={s} x={(map.seats[vis(s.i)].x / 100) * w} y={(map.seats[vis(s.i)].y / 100) * h} k={k} />
          ))}
        </Pressable>
      )}
    </View>
  );
}

function Felt({ w, h }: { w: number; h: number }) {
  const r = w * 0.44;
  return (
    <Svg width={w} height={h} style={{ position: 'absolute' }}>
      <Defs>
        <RadialGradient id="felt" cx="50%" cy="42%" rx="62%" ry="58%">
          <Stop offset="0%" stopColor="#1C211E" />
          <Stop offset="45%" stopColor="#121614" />
          <Stop offset="80%" stopColor="#0A0C0B" />
          <Stop offset="100%" stopColor="#060706" />
        </RadialGradient>
      </Defs>
      <Rect x={w * 0.035} y={h * 0.03} width={w * 0.93} height={h * 0.94} rx={r} fill="url(#felt)" stroke="rgba(255,106,61,0.45)" strokeWidth={1.2} />
      <Rect x={w * 0.065} y={h * 0.055} width={w * 0.87} height={h * 0.89} rx={r * 0.92} fill="none" stroke="rgba(255,106,61,0.18)" strokeWidth={1} />
      <Rect x={w * 0.012} y={h * 0.012} width={w * 0.976} height={h * 0.976} rx={r * 1.05} fill="none" stroke="rgba(245,237,216,0.07)" strokeWidth={6} />
    </Svg>
  );
}

function Pill({ text, k, strong }: { text: string; k: number; strong?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(14,12,10,0.88)',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: strong ? 'rgba(255,106,61,0.5)' : 'rgba(255,201,120,0.28)',
        paddingHorizontal: 6 * k,
        paddingVertical: 1.5 * k,
      }}>
      <Text allowFontScaling={false} style={{ color: '#F5EDD8', fontFamily: F.mono, fontSize: (strong ? 12 : 10.5) * k, fontVariant: ['tabular-nums'] }}>
        {text}
      </Text>
    </View>
  );
}

function Seat({ seat: s, x, y, k }: { seat: RpSeat; x: number; y: number; k: number }) {
  const pw = SIZE.plateW * k;
  const ph = SIZE.plateH * k;
  const cw = (s.hero ? SIZE.heroCardW : SIZE.seatCardW) * k;
  const ch = (s.hero ? SIZE.heroCardH : SIZE.seatCardH) * k;
  const pos = POS_COLOR[s.pos] ?? { bg: '#4B5563', fg: '#fff' };
  const badge = s.won ? { bg: C.good, fg: '#06200F', label: s.won + (s.handName ? ` · ${s.handName}` : '') } : s.badge && !s.folded ? { ...BADGE[s.badge.kind], label: s.badge.label } : null;
  const border = s.won ? C.good : s.acting ? C.accent : s.hero ? 'rgba(245,237,216,0.55)' : 'rgba(245,237,216,0.14)';

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x - pw / 2, top: y - ph / 2 - ch * 0.7, width: pw, alignItems: 'center' }}>
      {/* cards, or the red FOLD of a player out of the hand */}
      <View style={{ height: ch * 0.7, width: pw, alignItems: 'center', justifyContent: 'flex-end', zIndex: 0 }}>
        {s.folded ? (
          <Text allowFontScaling={false} style={{ color: '#EF4444', fontFamily: ff(800), fontSize: 11 * k, letterSpacing: 1, marginBottom: 2 }}>
            FOLD
          </Text>
        ) : s.cards !== undefined ? (
          <View style={{ flexDirection: 'row', position: 'absolute', top: 0 }}>
            {(s.cards ?? [null, null]).map((c, ci) => (
              <RpCard
                key={ci}
                card={c}
                faceDown={!c}
                w={cw}
                h={ch}
                style={{ marginLeft: ci ? -cw * (s.cards && s.cards.length > 2 ? 0.55 : 0.18) : 0, transform: [{ rotate: ci % 2 ? '4deg' : '-4deg' }] }}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View
        style={{
          width: pw,
          height: ph,
          borderRadius: 8 * k,
          backgroundColor: s.won ? '#10261C' : '#0E0D0B',
          borderWidth: s.acting || s.won ? 1.5 : 1,
          borderColor: border,
          paddingHorizontal: 5 * k,
          justifyContent: 'center',
          opacity: s.folded ? 0.4 : 1,
          shadowColor: s.acting ? C.accent : '#000',
          shadowOpacity: s.acting ? 0.7 : 0.4,
          shadowRadius: s.acting ? 8 : 4,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
          <Text allowFontScaling={false} numberOfLines={1} style={{ flexShrink: 1, color: s.hero ? '#F5C27A' : '#EFE7D2', fontFamily: SERIF, fontSize: 11 * k }}>
            {s.name}
          </Text>
          {s.pos && s.pos !== s.name ? (
            <View style={{ backgroundColor: pos.bg, borderRadius: 3, paddingHorizontal: 3 * k }}>
              <Text allowFontScaling={false} style={{ color: pos.fg, fontFamily: ff(800), fontSize: 8 * k }}>
                {s.pos}
              </Text>
            </View>
          ) : null}
        </View>
        <Text allowFontScaling={false} numberOfLines={1} style={{ color: s.allIn ? '#F87171' : '#F5EDD8', fontFamily: F.mono, fontSize: 11.5 * k, fontVariant: ['tabular-nums'] }}>
          {s.stack}
        </Text>
      </View>

      {badge ? (
        <View
          style={{
            position: 'absolute',
            ...(s.hero ? { left: pw + 4, top: ch * 0.7 + ph / 2 - 8 * k } : { top: ch * 0.7 - 8 * k }),
            backgroundColor: badge.bg,
            borderRadius: 4,
            paddingHorizontal: 4 * k,
            paddingVertical: 1,
            maxWidth: s.hero ? 120 * k : pw + 10,
            zIndex: 3,
          }}>
          <Text allowFontScaling={false} numberOfLines={1} style={{ color: badge.fg, fontFamily: F.mono, fontSize: 8.5 * k }}>
            {badge.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

