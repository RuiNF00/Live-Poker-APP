// The replayer's table for a phone held upright: charcoal felt with a thin rail,
// seats placed by hand for every table size (layout.ts), ivory cards, chip stacks
// and an action badge on each plate. Visual base: the stats-app replayer.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { t } from '@/i18n';
import { pct } from '@/poker/format';
import { BRAND, C, F, ff, posColor } from '@/theme';

import { ChipStack } from './ChipStack';
import { BOARD_Y, boardScale, BRAND_Y, cardShow, dealerSpot, EDGE, POT_Y, scaleFor, seatCenter, SIZE, STAGE_RATIO, tableMap } from './layout';
import { spokenTable, type BadgeKind, type RpSeat, type RpView } from './model';
import { FlipIn, FlyingChips, RiseIn, useReduceMotion, type Flight } from './motion';
import { progressAt, type MotionAnim, type MotionStep } from './timeline';
import { RpCard } from './RpCard';


export const BADGE: Record<BadgeKind, { bg: string; fg: string }> = {
  fold: { bg: '#3A3A42', fg: '#CCC' },
  check: { bg: '#27AE60', fg: '#000' },
  call: { bg: '#2ECC71', fg: '#000' },
  bet: { bg: '#F39C12', fg: '#000' },
  raise: { bg: '#F39C12', fg: '#000' },
  allin: { bg: '#E74C3C', fg: '#fff' },
};



/** Same marks as the tags beside the two boards. */
const RUN_MARK = { 1: '①', 2: '②' } as const;
/** The table is a drawing scaled to the screen width: its labels grow a little with the system text size, never past their plates (the info bar and the screen reader carry the same facts at full size). */
const TABLE_TEXT = 1.2;

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
            <Text maxFontSizeMultiplier={TABLE_TEXT} style={{ color: '#F5EDD8', fontFamily: F.mono, fontSize: 9 * k }}>{j + 1}</Text>
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
  onSwipe,
  animate = false,
  motion,
  at,
}: {
  view: RpView;
  /** Live motion between steps (the in-app replayer). Off for still renders such as Story frames. */
  animate?: boolean;
  /** The step's entry from `motionTimeline`, passed only when it was reached going forward. */
  motion?: MotionStep;
  /** A still frame `at` ms into the step's animations (deterministic capture). Also read from `view.motion`. */
  at?: number;
  heroIndex: number;
  button: number;
  onTapLeft?: () => void;
  onTapRight?: () => void;
  /** A sideways swipe on the table: 1 = towards the next street (finger moves left), -1 = back. */
  onSwipe?: (dir: 1 | -1) => void;
}) {
  const [w, setW] = useState(0);
  const h = w * STAGE_RATIO;
  const k = scaleFor(w || 366);
  const n = view.seats.length;
  const map = tableMap(n);
  const vis = (i: number) => (i - heroIndex + n) % n;

  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  // A clear sideways swipe changes street; anything shorter stays a tap, and vertical drags scroll the page.
  const swipeRef = useRef(onSwipe);
  // On the web a press still lands after the swipe ends: that one is swallowed.
  const swipedAt = useRef(0);
  useEffect(() => {
    swipeRef.current = onSwipe;
  });
  const [swipe] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => !!swipeRef.current && Math.abs(g.dx) > 24 && Math.abs(g.dx) > 2 * Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) <= 40) return;
        swipedAt.current = Date.now();
        swipeRef.current?.(g.dx < 0 ? 1 : -1);
      },
    }),
  );


  const bestEquity = Math.max(-1, ...view.seats.map((s) => s.equity ?? -1));
  const boardW = SIZE.boardCardW * k * boardScale(n);
  const boardH = SIZE.boardCardH * k * boardScale(n);
  // Seats as drawn: pulled in from the sides so no plate touches the screen edge.
  const seatPt = (i: number) => {
    const c = seatCenter(map.seats[vis(i)], w);
    return { x: (c.x / w) * 100, y: map.seats[vis(i)].y };
  };

  // Motion between steps, from the shared timeline: bets gather into the pot when a street is
  // dealt, the pot slides to the winner. A still frame draws the same flights at one moment.
  const still = at != null ? { anims: motion?.anims ?? view.motion?.anims ?? [], at } : (view.motion ?? null);
  const reduce = useReduceMotion() || !animate || !!still;
  const [flights, setFlights] = useState<Flight[]>([]);
  const land = useCallback((id: string) => setFlights((fs) => fs.filter((f) => f.id !== id)), []);
  const flightsFor = (anims: MotionAnim[], tag: string): Flight[] => {
    const potAt = { x: w / 2, y: (POT_Y / 100) * h };
    const out: Flight[] = [];
    for (const a of anims) {
      if (a.kind === 'potGather')
        for (const b of a.bets) out.push({ id: `${tag}g${b.seat}`, amount: b.amount, from: { x: (map.bets[vis(b.seat)].x / 100) * w, y: (map.bets[vis(b.seat)].y / 100) * h }, to: potAt, delay: a.start, dur: a.dur });
      if (a.kind === 'chipsToWinner') {
        const p = seatPt(a.seat);
        out.push({ id: `${tag}w${a.seat}`, amount: a.amount, from: potAt, to: { x: (p.x / 100) * w, y: (p.y / 100) * h }, delay: a.start, dur: a.dur });
      }
    }
    return out;
  };
  useEffect(() => {
    if (!motion || reduce || !w) return;
    const next = flightsFor(motion.anims, `${motion.k}.${Date.now().toString(36)}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next.length) setFlights((fs) => [...fs, ...next]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion]);
  const stillFlights = still && w ? flightsFor(still.anims, 's') : [];
  const riseAt = (c: number) => (still?.anims ?? motion?.anims)?.find((x) => x.kind === 'boardRise' && x.card === c);

  return (
    <View onLayout={onLayout} {...swipe.panHandlers} style={{ width: '100%', height: h || undefined, aspectRatio: w ? undefined : 1 / STAGE_RATIO }}>
      {w > 0 && (
        <Pressable
          style={{ flex: 1 }}
          onPress={(e) => {
            if (Date.now() - swipedAt.current < 400) return;
            if (e.nativeEvent.locationX < w * 0.35) onTapLeft?.();
            else onTapRight?.();
          }}
          accessibilityLabel={spokenTable(view)}
          accessibilityHint={onTapRight ? t('Toca duas vezes para avançar.') : undefined}
          // The swipe has a screen-reader twin: VoiceOver's actions rotor (swipe up or down) changes street.
          accessibilityActions={[
            { name: 'activate' },
            ...(onSwipe
              ? [
                  { name: 'nextStreet', label: t('Próxima street') },
                  { name: 'prevStreet', label: t('Street anterior') },
                ]
              : []),
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'nextStreet') onSwipe?.(1);
            else if (e.nativeEvent.actionName === 'prevStreet') onSwipe?.(-1);
            else onTapRight?.();
          }}>
          <Felt w={w} h={h} />

          <Text maxFontSizeMultiplier={TABLE_TEXT}
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
                <RiseIn key={view.board[c]} reduce={reduce} delay={riseAt(c)?.start ?? 0} p={still ? (riseAt(c) ? progressAt(riseAt(c)!, still.at) : 1) : undefined}>
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
                <Text maxFontSizeMultiplier={TABLE_TEXT} style={{ color: '#3B3424', fontSize: 10 * k, fontFamily: ff(800) }}>D</Text>
              </View>
            );
          })()}

          {flights.map((f) => (
            <FlyingChips key={f.id} f={f} size={12 * k} onDone={land} />
          ))}
          {stillFlights.map((f) => (
            <FlyingChips key={f.id} f={f} size={12 * k} p={progressAt({ start: f.delay ?? 0, dur: f.dur ?? 1 }, still!.at)} />
          ))}

          {/* seats */}
          {view.seats.map((s) => (
            <Seat key={'s' + s.i} seat={s} x={(seatPt(s.i).x / 100) * w} y={(seatPt(s.i).y / 100) * h} w={w} k={k} bestEquity={bestEquity} reduce={reduce} />
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
      <Text maxFontSizeMultiplier={TABLE_TEXT} allowFontScaling={false} style={{ color: '#F5EDD8', fontFamily: F.mono, fontSize: (strong ? 12 : 10.5) * k, fontVariant: ['tabular-nums'] }}>
        {text}
      </Text>
    </View>
  );
}

function Seat({ seat: s, x, y, w, k, bestEquity, reduce }: { seat: RpSeat; x: number; y: number; w: number; k: number; bestEquity: number; reduce: boolean }) {
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
          <Text maxFontSizeMultiplier={TABLE_TEXT} allowFontScaling={false} style={{ color: C.muted, fontFamily: ff(800), fontSize: 11 * k, letterSpacing: 1, marginBottom: 2 }}>
            FOLD
          </Text>
        ) : s.cards !== undefined ? (
          <View style={{ flexDirection: 'row', position: 'absolute', top: 0 }}>
            {(s.cards ?? [null, null]).map((c, ci) => (
              // Keyed by the card, so a hand turned face up at showdown remounts and flips; hero's are known from the start.
              <FlipIn key={c ?? `back${ci}`} reduce={reduce || s.hero || !c} delay={ci * 70}>
                <RpCard
                  card={c}
                  faceDown={!c}
                  w={cw}
                  h={ch}
                  style={{ marginLeft: ci ? -cw * (s.cards && s.cards.length > 2 ? 0.55 : 0.18) : 0, transform: [{ rotate: ci % 2 ? '4deg' : '-4deg' }] }}
                />
              </FlipIn>
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
          <Text maxFontSizeMultiplier={TABLE_TEXT} allowFontScaling={false} numberOfLines={1} style={{ flexShrink: 1, color: C.text, fontFamily: ff(600), fontSize: 10.5 * k, letterSpacing: -0.1 }}>
            {s.name}
          </Text>
          {s.pos && s.pos !== s.name ? (
            <View style={{ backgroundColor: pos.bg, borderRadius: 3, paddingHorizontal: 2.5 * k, flexShrink: 0 }}>
              <Text maxFontSizeMultiplier={TABLE_TEXT} allowFontScaling={false} style={{ color: pos.fg, fontFamily: ff(800), fontSize: 8 * k }}>
                {s.pos}
              </Text>
            </View>
          ) : null}
        </View>
        <Text maxFontSizeMultiplier={TABLE_TEXT} allowFontScaling={false} numberOfLines={1} style={{ color: s.stack === 'ALL-IN' ? C.allin : C.text, fontFamily: F.mono, fontSize: 11.5 * k, fontVariant: ['tabular-nums'] }}>
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
            <Text maxFontSizeMultiplier={TABLE_TEXT} allowFontScaling={false} numberOfLines={1} style={{ color: badge.fg, fontFamily: F.mono, fontSize: 8.5 * k }}>
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
          <Text maxFontSizeMultiplier={TABLE_TEXT} allowFontScaling={false} style={{ color: s.equity >= bestEquity ? '#06200F' : '#F5EDD8', fontFamily: F.mono, fontSize: 9 * k }}>
            {s.equity >= bestEquity ? '★ ' : ''}
            {pct(s.equity)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
