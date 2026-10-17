// The felt. Shared by hand entry (live state) and the replayer (any step), and
// rendered on web for shared links. Portrait oval, hero always at the bottom,
// seats placed clockwise on an ellipse so any table size from 2 to 10 works.
// Look follows the stats-app replayer: dark felt, thin accent rail, compact
// name/stack plates with cards tucked behind, action pills and a dealer disc.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { t } from '@/i18n';
import type { CardCode } from '@/poker/types';
import { C, ff } from '@/theme';

import { PlayingCard } from './PlayingCard';

export interface SeatView {
  name: string;
  pos: string;
  stack: string;
  /** Cards to show face up; `null` = face down, `undefined` = no cards. */
  cards?: CardCode[] | null;
  folded?: boolean;
  acting?: boolean;
  hero?: boolean;
  bet?: string;
  action?: { label: string; color: string } | null;
  winner?: string | null;
  allIn?: boolean;
  handName?: string | null;
}

export const ASPECT = 1.18;

/** "BTN, Ana, stack 45 bb, a jogar": what VoiceOver reads for a seat. */
export function seatLabel(s: SeatView): string {
  const parts = [s.pos && s.pos !== s.name ? s.pos : '', s.hero ? t('Tu') : s.name, s.allIn ? 'all-in' : t('stack {stack}', { stack: s.stack })];
  if (s.bet) parts.push(t('fichas na mesa {amount}', { amount: s.bet }));
  if (s.action) parts.push(s.action.label);
  if (s.folded && s.action?.label.toLowerCase() !== 'fold') parts.push('fold');
  if (s.acting) parts.push(t('a jogar'));
  if (s.winner) parts.push(s.winner);
  return parts.filter(Boolean).join(', ');
}

function seatXY(k: number, n: number, rx = 41, ry = 40) {
  const a = ((90 + (k * 360) / n) * Math.PI) / 180;
  return { x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a) };
}

// Bets sit between the seat and the middle: just clear of the seat box (its
// cards and plate), and kept clear of the board strip.
// The felt is a fixed diagram: seat, pot and bet text grow with Larger Text only
// this far, or seats overlap the pot. VoiceOver reads every seat in full (seatLabel).
const TABLE_SCALE = 1.3;
const SEAT_HALF_W = 44;
const SEAT_HALF_H = 34;
const BET_HALF_W = 30;
const BET_HALF_H = 11;
function betXY(k: number, n: number, w: number, h: number, scale: number) {
  const seat = seatXY(k, n);
  const sx = (seat.x / 100) * w;
  // The seat box is drawn from 38px above its point; its middle sits a bit higher.
  const sy = (seat.y / 100) * h - 5 * scale;
  const dx = w / 2 - sx;
  const dy = h * 0.47 - sy;
  const gap = 4;
  const tx = Math.abs(dx) > 0.5 ? (SEAT_HALF_W * scale + BET_HALF_W + gap) / Math.abs(dx) : Infinity;
  // Hero's cards are drawn bigger and stand taller over the plate.
  const halfH = (SEAT_HALF_H + (k === 0 ? 14 : 0)) * scale;
  const ty = Math.abs(dy) > 0.5 ? (halfH + BET_HALF_H + gap) / Math.abs(dy) : Infinity;
  const t = Math.min(Math.max(Math.min(tx, ty), 0.3), 0.62);
  const x = ((sx + dx * t) / Math.max(w, 1)) * 100;
  let y = ((sy + dy * t) / Math.max(h, 1)) * 100;
  // Over the board strip: step above or below it rather than sideways, which
  // would push the chip back onto a side seat.
  const half = ((w < 360 ? 166 : 216) / 2 / Math.max(w, 1)) * 100 + 4;
  if (y > 33 && y < 55 && Math.abs(x - 50) < half) y = y < 44 ? 33 : 57;
  // The dealer button goes beside the bet, across the seat-to-middle line,
  // and also steps off the board strip.
  const len = Math.hypot(dx, dy) || 1;
  const dealer = { x: x + ((-dy / len) * 44 * 100) / Math.max(w, 1), y: y + ((dx / len) * 44 * 100) / Math.max(h, 1) };
  if (dealer.y > 33 && dealer.y < 55 && Math.abs(dealer.x - 50) < half + 4) dealer.y = dealer.y < 44 ? 33 : 57;
  return { x, y, dealer };
}

export function Table({
  seats,
  hero,
  button,
  board,
  boardSlots = 5,
  pot,
  narration,
  onSeatPress,
  onSeatLongPress,
  footer,
  watermark,
}: {
  seats: SeatView[];
  hero: number;
  button: number;
  board: CardCode[];
  boardSlots?: number;
  pot?: string;
  narration?: string;
  onSeatPress?: (i: number) => void;
  onSeatLongPress?: (i: number) => void;
  footer?: React.ReactNode;
  watermark?: string;
}) {
  const [w, setW] = useState(0);
  const n = seats.length;
  const h = w * ASPECT;
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const scale = w ? Math.min(1, w / 400) : 1;
  const cardSize = n > 7 && w < 380 ? 'xs' : 'sm';

  return (
    <View onLayout={onLayout} style={{ width: '100%', height: h || undefined, aspectRatio: w ? undefined : 1 / ASPECT }}>
      {w > 0 && (
        <>
          {/* rail + felt */}
          <View style={[styles.rail, { borderRadius: w }]} />
          <View style={[styles.felt, { borderRadius: w }]}>
            <View style={[styles.feltLine, { borderRadius: w }]} />
          </View>
          {watermark ? (
            <Text maxFontSizeMultiplier={TABLE_SCALE} style={[styles.watermark, { top: h * 0.235, fontSize: 13 * scale }]}>{watermark.toUpperCase()}</Text>
          ) : null}

          {/* board */}
          <View style={[styles.board, { top: h * 0.43 }]}>
            {Array.from({ length: boardSlots }).map((_, i) =>
              board[i] ? (
                <PlayingCard key={board[i]} card={board[i]} size={w < 360 ? 'sm' : 'md'} />
              ) : (
                <View key={'slot' + i} style={[styles.slot, w < 360 ? { width: 30, height: 42 } : null]} />
              ),
            )}
          </View>
          {pot ? (
            <View style={[styles.potWrap, { top: h * 0.43 + (w < 360 ? 50 : 64) }]}>
              <View style={styles.pot}>
                <View style={styles.potChip} />
                <Text maxFontSizeMultiplier={TABLE_SCALE} style={styles.potText}>{pot}</Text>
              </View>
            </View>
          ) : null}
          {narration ? (
            <View style={[styles.potWrap, { top: h * 0.43 - (w < 360 ? 52 : 60) }]}>
              <Text maxFontSizeMultiplier={TABLE_SCALE} style={styles.narration} numberOfLines={1}>
                {narration}
              </Text>
            </View>
          ) : null}

          {/* bets + dealer */}
          {seats.map((s, i) => {
            const k = (i - hero + n) % n;
            const b = betXY(k, n, w, h, scale);
            const isBtn = i === button;
            return (
              <React.Fragment key={'b' + i}>
                {s.bet && !s.folded ? (
                  <View style={[styles.bet, { left: (b.x / 100) * w, top: (b.y / 100) * h }]}>
                    <View style={styles.betChip} />
                    <Text maxFontSizeMultiplier={TABLE_SCALE} style={styles.betText}>{s.bet}</Text>
                  </View>
                ) : null}
                {isBtn ? (
                  <View
                    style={[
                      styles.dealer,
                      {
                        left: (b.dealer.x / 100) * w,
                        top: (b.dealer.y / 100) * h,
                      },
                    ]}>
                    <Text maxFontSizeMultiplier={TABLE_SCALE} style={styles.dealerText}>D</Text>
                  </View>
                ) : null}
              </React.Fragment>
            );
          })}

          {/* seats */}
          {seats.map((s, i) => {
            const k = (i - hero + n) % n;
            const p = seatXY(k, n);
            return (
              <Pressable
                key={'s' + i}
                accessibilityRole="button"
                accessibilityLabel={seatLabel(s)}
                accessibilityState={{ disabled: !onSeatPress && !onSeatLongPress }}
                // The long press (edit the seat) as a screen-reader action.
                accessibilityActions={onSeatLongPress ? [{ name: 'longpress', label: t('Editar lugar') }] : undefined}
                onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onSeatLongPress?.(i)}
                disabled={!onSeatPress && !onSeatLongPress}
                onPress={() => onSeatPress?.(i)}
                onLongPress={onSeatLongPress ? () => onSeatLongPress(i) : undefined}
                style={[styles.seat, { left: (p.x / 100) * w, top: (p.y / 100) * h, transform: [{ translateX: -44 }, { translateY: -38 }, { scale }] }]}>
                <View style={[styles.cards, { opacity: s.folded ? 0.25 : 1 }]}>
                  {s.cards === undefined ? null : s.cards === null ? (
                    <>
                      <PlayingCard faceDown size={cardSize} style={{ transform: [{ rotate: '-5deg' }] }} />
                      <PlayingCard faceDown size={cardSize} style={{ marginLeft: -10, transform: [{ rotate: '5deg' }] }} />
                    </>
                  ) : (
                    s.cards.map((c, ci) => (
                      <PlayingCard
                        key={c}
                        card={c}
                        size={s.hero ? 'md' : cardSize}
                        style={{ marginLeft: ci ? (s.hero ? -6 : -8) : 0, transform: [{ rotate: ci ? '4deg' : '-4deg' }] }}
                      />
                    ))
                  )}
                </View>
                <View
                  style={[
                    styles.plate,
                    s.hero && styles.plateHero,
                    s.acting && styles.plateActing,
                    s.winner ? styles.plateWinner : null,
                    s.folded && { opacity: 0.45 },
                  ]}>
                  <View style={styles.plateTop}>
                    <Text maxFontSizeMultiplier={TABLE_SCALE} style={[styles.name, s.hero && { color: C.accent }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    {s.pos && s.pos !== s.name ? (
                      <View style={styles.pos}>
                        <Text maxFontSizeMultiplier={TABLE_SCALE} style={styles.posText}>{s.pos}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text maxFontSizeMultiplier={TABLE_SCALE} style={[styles.stack, s.allIn && { color: C.allin }]}>{s.allIn ? 'ALL-IN' : s.stack}</Text>
                </View>
                {s.action ? (
                  <View style={[styles.action, { backgroundColor: s.action.color }]}>
                    <Text maxFontSizeMultiplier={TABLE_SCALE} style={styles.actionText} numberOfLines={1}>
                      {s.action.label}
                    </Text>
                  </View>
                ) : null}
                {s.winner ? (
                  <View style={styles.win}>
                    <Text maxFontSizeMultiplier={TABLE_SCALE} style={styles.winText} numberOfLines={1}>
                      {s.winner}
                    </Text>
                  </View>
                ) : s.handName ? (
                  <Text maxFontSizeMultiplier={TABLE_SCALE} style={styles.handName} numberOfLines={1}>
                    {s.handName.split(/[,:]/)[0]}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          {footer}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: '3%',
    right: '3%',
    top: '6%',
    bottom: '6%',
    backgroundColor: C.rail,
    borderWidth: 1,
    borderColor: C.railLine,
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  felt: {
    position: 'absolute',
    left: '6.5%',
    right: '6.5%',
    top: '9%',
    bottom: '9%',
    backgroundColor: C.felt,
    borderWidth: 1,
    borderColor: 'rgba(238,242,239,0.18)',
    overflow: 'hidden',
  },
  feltLine: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    top: '4%',
    bottom: '4%',
    borderWidth: 1,
    borderColor: 'rgba(238,242,239,0.10)',
  },
  watermark: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(238,242,239,0.22)',
    fontWeight: '800', fontFamily: ff(800),
    letterSpacing: 6,
  },
  board: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    transform: [{ translateY: -28 }],
  },
  slot: {
    width: 40,
    height: 56,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(238,242,239,0.22)',
  },
  potWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(238,242,239,0.3)',
  },
  potChip: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.chip, borderWidth: 2, borderColor: C.accent },
  potText: { color: C.text, fontWeight: '800', fontFamily: ff(800), fontSize: 13, fontVariant: ['tabular-nums'] },
  narration: { color: C.textDim, fontSize: 12, fontWeight: '700', fontFamily: ff(700), letterSpacing: 0.3 },
  bet: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    transform: [{ translateX: -26 }, { translateY: -10 }],
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  betChip: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.bet, borderWidth: 2, borderColor: '#FFF3' },
  betText: { color: '#FFE7B0', fontWeight: '800', fontFamily: ff(800), fontSize: 12, fontVariant: ['tabular-nums'] },
  dealer: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F4EFE1',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -11 }, { translateY: -11 }],
    borderWidth: 1,
    borderColor: '#B9AF92',
  },
  dealerText: { color: '#3B3424', fontWeight: '900', fontFamily: ff(900), fontSize: 12 },
  seat: { position: 'absolute', width: 88, alignItems: 'center' },
  cards: { flexDirection: 'row', height: 40, alignItems: 'flex-end', marginBottom: -12, zIndex: 0 },
  plate: {
    width: 88,
    backgroundColor: '#0E1110',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(238,242,239,0.16)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    zIndex: 1,
  },
  plateHero: { borderColor: 'rgba(238,242,239,0.6)' },
  plateActing: { borderColor: C.warn, borderWidth: 2 },
  plateWinner: { borderColor: C.good, borderWidth: 2, backgroundColor: '#10261C' },
  plateTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  name: { color: C.text, fontSize: 11, fontWeight: '700', fontFamily: ff(700), flexShrink: 1 },
  pos: { backgroundColor: C.surface3, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  posText: { color: C.textDim, fontSize: 9, fontWeight: '800', fontFamily: ff(800) },
  stack: { color: '#CFE9DC', fontSize: 12, fontWeight: '800', fontFamily: ff(800), fontVariant: ['tabular-nums'] },
  action: { marginTop: 3, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, maxWidth: 96 },
  actionText: { color: '#0A0C0B', fontSize: 10, fontWeight: '900', fontFamily: ff(900), letterSpacing: 0.3 },
  win: { marginTop: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: C.good },
  winText: { color: '#06200F', fontSize: 10, fontWeight: '900', fontFamily: ff(900) },
  handName: { marginTop: 2, color: C.textDim, fontSize: 10, fontWeight: '700', fontFamily: ff(700) },
});
