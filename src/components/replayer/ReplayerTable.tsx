// The replayer's table for a phone held upright: charcoal felt with a thin rail,
// seats placed by hand for every table size (layout.ts), ivory cards, chip stacks
// and an action badge on each plate. Visual base: the stats-app replayer.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { t } from '@/i18n';
import { pct } from '@/poker/format';
import { BRAND, C, F, ff, posColor } from '@/theme';

import { ChipStack } from './ChipStack';
import { BOARD_Y, boardScale, BRAND_Y, cardShow, dealerSpot, EDGE, POT_Y, scaleFor, seatCenter, SIZE, STAGE_RATIO, tableMap } from './layout';
import type { BadgeKind, RpSeat, RpView } from './model';
import type { Street } from '@/poker/types';
import { FlyingChips, RiseIn, useReduceMotion, type Flight } from './motion';
import { RpCard } from './RpCard';


export const BADGE: Record<BadgeKind, { bg: string; fg: string }> = {
  fold: { bg: '#3A3A42', fg: '#CCC' },
  check: { bg: '#27AE60', fg: '#000' },
  call: { bg: '#2ECC71', fg: '#000' },
  bet: { bg: '#F39C12', fg: '#000' },
  raise: { bg: '#F39C12', fg: '#000' },
  allin: { bg: '#E74C3C', fg: '#fff' },
};


const STREET_NO: Record<Street, number> = { preflop: 0, flop: 1, turn: 2, river: 3 };

/** Same marks as the tags beside the two boards. */
const RUN_MARK = { 1: '①', 2: '②' } as const;

/** Run it twice: both boards stacked, smaller, each tagged with its number. */
function RunBoards({ boards, k, top, reduce }: { boards: string[][]; k: number; top: number; reduce: boolean }) {
  const cw = SIZE.boardCardW * 0.76 * k;
  const ch = SIZE.boardCardH * 0.76 * k;
  const gap = 3 * k;
  const tag = 14 * k;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: top - ch - gap / 2, alignItems: 'center', gap }}>
      {boards.map((b, j) => (
        <View key={j} accessibilityLabel={`Board ${j + 1}`} style={{ flexDirection: 'row', alignItems: 'center', gap: SIZE.boardGap * 0.76 * k, marginLeft: -(tag + 3 * k) }}>
          <View
            style={{
              width: tag,
              height: tag,
              marginRight: 3 * k,
              borderRadius: tag / 2,
              borderWidth: 1,
              borderColor: 'rgba(255,106,61,0.5)',
              backgroundColor: 'rgba(14,12,10,0.88)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: '#F5EDD8', fontFamily: F.mono, fontSize: 9 * k }}>{j + 1}</Text>
          </View>
          {b.map((c, i) => (
            <RiseIn key={`${i}-${c}`} reduce={reduce}>
              <RpCard card={c} w={cw} h={ch} />
            </RiseIn>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ReplayerTable({
  view,
  heroIndex,
  button,
  onTapLeft,
  onTapRight,
  animate = false,
}: {
  view: RpView;
  /** Live motion between steps (the in-app replayer). Off for still renders such as Story frames. */
  animate?: boolean;
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


  const bestEquity = Math.max(-1, ...view.seats.map((s) => s.equity ?? -1));
  const boardW = SIZE.boardCardW * k * boardScale(n);
  const boardH = SIZE.boardCardH * k * boardScale(n);
  // Seats as drawn: pulled in from the sides so no plate touches the screen edge.
  const seatPt = (i: number) => {
    const c = seatCenter(map.seats[vis(i)], w);
    return { x: (c.x / w) * 100, y: map.seats[vis(i)].y };
  };

  // Motion between steps: bets gather into the pot when a street is dealt, the pot slides to the winner.
  const reduce = useReduceMotion() || !animate;
  const [flights, setFlights] = useState<Flight[]>([]);
  const prev = useRef<RpView | null>(null);
  const land = useCallback((id: string) => setFlights((fs) => fs.filter((f) => f.id !== id)), []);
  useEffect(() => {
    const before = prev.current;
    prev.current = view;
    if (!before || reduce || !w) return;
    const potAt = { x: w / 2, y: (POT_Y / 100) * h };
    const next: Flight[] = [];
    const tag = Date.now().toString(36);
    // The action that closes a street sweeps every bet into the middle (only going forward).
    if (view.pot > before.pot && STREET_NO[view.street] >= STREET_NO[before.street] && !view.seats.some((s) => s.won)) {
      for (const s of before.seats)
        if (s.bet > 0 && view.seats[s.i].bet === 0) next.push({ id: `${tag}g${s.i}`, amount: s.bet, from: { x: (map.bets[vis(s.i)].x / 100) * w, y: (map.bets[vis(s.i)].y / 100) * h }, to: potAt });
    }
    const winners = view.seats.filter((s) => s.won);
    if (winners.length && !before.seats.some((s) => s.won) && view.pot > 0) {
      winners.forEach((s, j) => {
        const p = seatPt(s.i);
        next.push({ id: `${tag}w${s.i}`, amount: view.pot / winners.length, from: potAt, to: { x: (p.x / 100) * w, y: (p.y / 100) * h }, delay: j * 90 });
      });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next.length) setFlights((fs) => [...fs, ...next]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <View onLayout={onLayout} style={{ width: '100%', height: h || undefined, aspectRatio: w ? undefined : 1 / STAGE_RATIO }}>
      {w > 0 && (
        <Pressable
          style={{ flex: 1 }}
          onPress={(e) => (e.nativeEvent.locationX < w * 0.35 ? onTapLeft?.() : onTapRight?.())}
          accessibilityRole="button"
          accessibilityLabel={t('Mesa')}>
          <Felt w={w} h={h} />

          <Text
            style={{
              position: 'absolute',
              top: (BRAND_Y / 100) * h - 8,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: 'rgba(245,237,216,0.16)',
              fontFamily: ff(700),
              fontSize: 13 * k,
              letterSpacing: 7 * k,
            }}>
            {BRAND.name.toUpperCase()}
          </Text>
          {/* board */}
          {view.board2 ? (
            <RunBoards boards={[view.board, view.board2]} k={k} top={(BOARD_Y / 100) * h} reduce={reduce} />
          ) : (
          <View style={{ position: 'absolute', left: 0, right: 0, top: (BOARD_Y / 100) * h - boardH / 2, flexDirection: 'row', justifyContent: 'center', gap: SIZE.boardGap * k * boardScale(n) }}>
            {[0, 1, 2, 3, 4].map((c) =>
              view.board[c] ? (
                <RiseIn key={view.board[c]} reduce={reduce} delay={c < 3 ? c * 80 : 0}>
                  <RpCard card={view.board[c]} w={boardW} h={boardH} />
                </RiseIn>
              ) : (
                <View key={'slot' + c} style={{ width: boardW, height: boardH, borderRadius: boardW * 0.14, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(245,237,216,0.12)' }} />
              ),
            )}
          </View>
          )}

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
            const d = dealerSpot(seatPt(button), map.bets[vis(button)]);
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
                <Text style={{ color: '#3B3424', fontSize: 10 * k, fontFamily: ff(800) }}>D</Text>
              </View>
            );
          })()}

          {flights.map((f) => (
            <FlyingChips key={f.id} f={f} size={12 * k} onDone={land} />
          ))}

          {/* seats */}
          {view.seats.map((s) => (
            <Seat key={'s' + s.i} seat={s} x={(seatPt(s.i).x / 100) * w} y={(seatPt(s.i).y / 100) * h} w={w} k={k} bestEquity={bestEquity} />
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
          <Stop offset="0%" stopColor="#183A30" />
          <Stop offset="45%" stopColor="#11261F" />
          <Stop offset="80%" stopColor="#0A1713" />
          <Stop offset="100%" stopColor="#060D0B" />
        </RadialGradient>
      </Defs>
      <Rect x={w * 0.035} y={h * 0.03} width={w * 0.93} height={h * 0.94} rx={r} fill="url(#felt)" stroke={C.borderStrong} strokeWidth={1.2} />
      <Rect x={w * 0.065} y={h * 0.055} width={w * 0.87} height={h * 0.89} rx={r * 0.92} fill="none" stroke={C.border} strokeWidth={1} />
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

function Seat({ seat: s, x, y, w, k, bestEquity }: { seat: RpSeat; x: number; y: number; w: number; k: number; bestEquity: number }) {
  const pw = SIZE.plateW * k;
  const ph = SIZE.plateH * k;
  const cw = (s.hero ? SIZE.heroCardW : SIZE.seatCardW) * k;
  const ch = (s.hero ? SIZE.heroCardH : SIZE.seatCardH) * k;
  const pos = { bg: posColor(s.pos), fg: '#0C1311' };
  const winNote = s.run ? RUN_MARK[s.run] : s.handName;
  const badge = s.won ? { bg: C.good, fg: '#06200F', label: s.won + (winNote ? ` · ${winNote}` : '') } : s.badge && !s.folded ? { ...BADGE[s.badge.kind], label: s.badge.label } : null;
  // Room beside the plate before the stage edge, on the tighter side.
  const spare = Math.max(5, Math.min(x - pw / 2, w - x - pw / 2) - EDGE * k);
  const border = s.won ? C.good : s.acting ? C.accent : s.hero ? 'rgba(245,237,216,0.55)' : 'rgba(245,237,216,0.14)';

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x - pw / 2, top: y - ph / 2 - ch * cardShow(s.hero), width: pw, alignItems: 'center' }}>
      {/* cards, or the red FOLD of a player out of the hand */}
      <View style={{ height: ch * cardShow(s.hero), width: pw, alignItems: 'center', justifyContent: 'flex-end', zIndex: 0 }}>
        {s.folded ? (
          <Text allowFontScaling={false} style={{ color: C.muted, fontFamily: ff(800), fontSize: 11 * k, letterSpacing: 1, marginBottom: 2 }}>
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
          paddingHorizontal: 4 * k,
          justifyContent: 'center',
          opacity: s.folded ? 0.45 : 1,
          shadowColor: s.acting ? C.accent : '#000',
          shadowOpacity: s.acting ? 0.7 : 0.4,
          shadowRadius: s.acting ? 8 : 4,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Text allowFontScaling={false} numberOfLines={1} style={{ flexShrink: 1, color: C.text, fontFamily: ff(600), fontSize: 10.5 * k, letterSpacing: -0.1 }}>
            {s.name}
          </Text>
          {s.pos && s.pos !== s.name ? (
            <View style={{ backgroundColor: pos.bg, borderRadius: 3, paddingHorizontal: 2.5 * k, flexShrink: 0 }}>
              <Text allowFontScaling={false} style={{ color: pos.fg, fontFamily: ff(800), fontSize: 8 * k }}>
                {s.pos}
              </Text>
            </View>
          ) : null}
        </View>
        <Text allowFontScaling={false} numberOfLines={1} style={{ color: s.stack === 'ALL-IN' ? C.allin : C.text, fontFamily: F.mono, fontSize: 11.5 * k, fontVariant: ['tabular-nums'] }}>
          {s.stack}
        </Text>
      </View>

      {badge ? (
        // Hero's badge sits right of the plate; the others are centred above it. Either may be
        // wider than the plate, never past the stage edge, so a long result isn't cut.
        <View
          style={{
            position: 'absolute',
            zIndex: 3,
            ...(s.hero
              ? { left: pw + 4, top: ch * cardShow(s.hero) + ph / 2 - 8 * k, width: Math.max(pw, w - (x + pw / 2 + 4) - EDGE * k), alignItems: 'flex-start' }
              : { top: ch * cardShow(s.hero) - 8 * k, left: -spare, right: -spare, alignItems: 'center' }),
          }}>
          <View style={{ backgroundColor: badge.bg, borderRadius: 4, paddingHorizontal: 4 * k, paddingVertical: 1, maxWidth: '100%' }}>
            <Text allowFontScaling={false} numberOfLines={1} style={{ color: badge.fg, fontFamily: F.mono, fontSize: 8.5 * k }}>
              {badge.label}
            </Text>
          </View>
        </View>
      ) : null}

      {s.equity != null ? (
        <View
          accessibilityLabel={`Equity ${pct(s.equity)}${s.equity >= bestEquity ? `, ${t('a melhor')}` : ''}`}
          style={{
            position: 'absolute',
            ...(s.hero ? { right: pw + 4, top: ch * cardShow(s.hero) + ph / 2 - 8 * k } : { top: ch * cardShow(s.hero) + ph - 7 * k }),
            backgroundColor: s.equity >= bestEquity ? C.good : 'rgba(14,12,10,0.92)',
            borderRadius: 4,
            borderWidth: 1,
            borderColor: s.equity >= bestEquity ? C.good : 'rgba(245,237,216,0.25)',
            paddingHorizontal: 4 * k,
            zIndex: 3,
          }}>
          <Text allowFontScaling={false} style={{ color: s.equity >= bestEquity ? '#06200F' : '#F5EDD8', fontFamily: F.mono, fontSize: 9 * k }}>
            {s.equity >= bestEquity ? '★ ' : ''}
            {pct(s.equity)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
