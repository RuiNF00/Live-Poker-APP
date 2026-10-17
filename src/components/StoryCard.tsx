// The 9:16 frame that becomes an Instagram story. Always laid out at 360×640
// points so the capture is the same on every phone; the share code exports it
// at 1080×1920. Instagram covers roughly the top and bottom 14% of a story
// (profile bar, reply box), so nothing important sits there.

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { t } from '@/i18n';
import { amount, blindsLabel } from '@/poker/format';
import { STAGES, type Hand, type Suit } from '@/poker/types';
import { SUIT_SYMBOL } from '@/poker/cards';
import { positions } from '@/poker/engine';
import type { StoryMoment } from '@/story/moment';
import { BRAND, C, F, R, ff, posColor } from '@/theme';

import { ReplayerTable } from './replayer/ReplayerTable';
import { STAGE_RATIO } from './replayer/layout';
import { STREET_LABEL, viewAt } from './replayer/model';

export const STORY_W = 360;
export const STORY_H = 640;
/** A feed post (X, or another app) at 4:5, so X shows it whole in the timeline: 1080×1350 exported. */
export const POST_H = 450;

/** Where the voice chip sits, in story points. The waveform slot inside it is
 * left empty on the captured frame and drawn by the server while the voice plays. */
const VOICE_CHIP = { left: 190, top: 68, w: 148, h: 26 };
export const VOICE_SLOT = { x: VOICE_CHIP.left + 26, y: VOICE_CHIP.top + 5, w: VOICE_CHIP.w - 34, h: VOICE_CHIP.h - 10 };

/** The slot in pixels of the exported 1080×1920 frame. */
export function voiceSlotPx(scale = 1080 / 360) {
  return { x: VOICE_SLOT.x * scale, y: VOICE_SLOT.y * scale, w: VOICE_SLOT.w * scale, h: VOICE_SLOT.h * scale };
}

/** Hand video with the player's face: a circle top right, filled by the server with the face clip. */
const FACE = { d: 96, right: 18, top: 58 };
/** The circle inside the ring, in pixels of the exported 1080×1920 frame. */
export function faceSlotPx(scale = 1080 / 360) {
  const ring = 2;
  const d = Math.round((FACE.d - ring * 2) * scale / 2) * 2;
  return { x: Math.round((STORY_W - FACE.right - FACE.d + ring) * scale), y: Math.round((FACE.top + ring) * scale), d };
}

export const linkHost = BRAND.webUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

export function Mark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 2 64 64">
      <Path d="M32 12.5 L44.73 25.27 A18 18 0 1 1 19.27 25.27 Z" fill={C.accent} />
      <Path d="M24 36 H40 M24 42 H40 M24 48 H34" stroke={C.bg} strokeWidth={3.2} strokeLinecap="round" />
    </Svg>
  );
}

export function Wordmark({ size = 15 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Mark size={size + 4} />
      <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: size, color: C.text, letterSpacing: -0.3 }}>
        Sweat<Text allowFontScaling={false} style={{ color: C.accent }}>book</Text>
      </Text>
    </View>
  );
}

const PREVIEW_BARS = [0.3, 0.55, 0.8, 0.45, 0.95, 0.6, 0.35, 0.7, 1, 0.5, 0.25, 0.65, 0.85, 0.4, 0.6, 0.3, 0.75, 0.5, 0.9, 0.35, 0.55, 0.2, 0.45, 0.3];

export interface StoryCardProps {
  hand: Hand;
  moment: StoryMoment;
  comment: string;
  inBB: boolean;
  /** Sweatbook wordmark and site name. Free stories always carry it. */
  brand?: boolean;
  /** Voice story: 'preview' draws sample bars in the chip, 'slot' leaves them for the video render. */
  voice?: 'preview' | 'slot' | null;
  /** Video frame: the replay at this step (see story/reel.ts), ending on the result. */
  step?: number;
  /** Video frame mid-animation: ms into the step's motion (see replayer/timeline.ts). */
  at?: number;
  /** Question story for Instagram: the options make way for the player's own Poll sticker.
   * 'hint' marks the space (preview only), 'empty' leaves it clean for the capture. */
  poll?: 'hint' | 'empty' | null;
  /** Hand video with the face clip: 'preview' shows a placeholder, 'slot' leaves the circle for the server. */
  face?: 'preview' | 'slot' | null;
  onLayout?: (e: LayoutChangeEvent) => void;
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

const GUTTER = 22;
/** Width the replayer table is designed for (layout.ts scales around 366). */
const TABLE_NATIVE_W = 344;

function MetaPill({ label, color, mono }: { label: string; color?: string; mono?: boolean }) {
  return (
    <View style={{ height: 22, paddingHorizontal: 9, borderRadius: R.pill, justifyContent: 'center', backgroundColor: color ? color + '24' : 'rgba(238,242,239,0.07)', borderWidth: 1, borderColor: color ? color + '40' : C.hairline }}>
      <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: mono ? F.mono : ff(700), fontSize: mono ? 10.5 : 11, color: color ?? C.textDim, letterSpacing: mono ? 0 : 0.1 }}>
        {label}
      </Text>
    </View>
  );
}

function LinkGlyph({ size = 12, color = C.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function StoryCard({ hand, moment, comment, inBB, brand = true, voice = null, step, at, poll = null, face = null, onLayout, ref }: StoryCardProps) {
  const g = hand.game;
  const reel = step !== undefined;
  const isQ = !reel && moment.mode === 'question';
  const atEnd = reel ? step >= moment.replay.steps.length - 1 : !isQ;
  const result = atEnd ? moment.replay.result : null;
  // Same table as the in-app replayer, frozen at the story's moment.
  const view = viewAt(hand, moment.replay, reel ? step : moment.stepIndex, { inBB, reveal: !isQ && !reel, atEnd, at: reel ? at : undefined });
  const stage = STAGES.find((s) => s.id === g.stage)?.label;
  const heroPos = positions(hand.players.length, hand.button)[hand.hero];
  const title = g.name || (g.kind === 'mtt' ? t('Torneio') : 'Cash');
  const text = comment.trim();
  const long = text.length > 80;
  // A new street reads better as the cards that came than as its name twice.
  const shownStep = reel ? moment.replay.steps[step] : null;
  const dealt =
    shownStep?.kind === 'board'
      ? hand.board
          .slice(shownStep.state.boardCount <= 3 ? 0 : shownStep.state.boardCount - 1, shownStep.state.boardCount)
          .map((c) => c[0] + SUIT_SYMBOL[c[1] as Suit])
          .join('  ')
      : null;
  const heroNet = result?.resolved ? result.net[hand.hero] : 0;
  // Run it twice: hero's hand on each board.
  const heroSeat = view.seats.find((x) => x.hero);
  const heroHand = heroSeat?.handName && heroSeat.handName2
    ? `${t('Mesa')} 1 ${heroSeat.handName} · ${t('Mesa')} 2 ${heroSeat.handName2}`
    : (result?.handNames[hand.hero] ?? null);
  // A smaller table leaves room for Instagram's Poll sticker above the reply bar.
  const pollRoom = isQ && !!poll;
  const tableW = pollRoom ? (text ? 200 : 256) : text ? 250 : 320;
  const tableTop = text ? 240 : 160;
  const bottomTop = tableTop + tableW * STAGE_RATIO + 8;

  return (
    <View ref={ref} collapsable={false} onLayout={onLayout} style={{ width: STORY_W, height: STORY_H, backgroundColor: C.bgDeep, overflow: 'hidden' }}>
      <LinearGradient colors={[C.bgDeep, C.bg, C.bg, C.bgDeep]} locations={[0, 0.3, 0.75, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      {/* Felt light behind the table, like a lamp over the game. */}
      <Svg width={STORY_W} height={STORY_H} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          <RadialGradient id="lamp" cx="50%" cy={String((tableTop + (tableW * STAGE_RATIO) / 2) / STORY_H)} rx="62%" ry="38%">
            <Stop offset="0" stopColor="#1F5A47" stopOpacity="0.55" />
            <Stop offset="0.55" stopColor="#123327" stopOpacity="0.25" />
            <Stop offset="1" stopColor="#0C1311" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ember" cx="100%" cy="0%" rx="70%" ry="30%">
            <Stop offset="0" stopColor={C.accent} stopOpacity="0.10" />
            <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={STORY_W} height={STORY_H} fill="url(#lamp)" />
        <Rect x="0" y="0" width={STORY_W} height={STORY_H} fill="url(#ember)" />
      </Svg>

      {/* Below Instagram's profile bar */}
      <View style={{ position: 'absolute', top: 70, left: GUTTER, right: GUTTER, height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {brand ? <Wordmark size={14} /> : <View />}
        {voice || face ? null : reel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.accentLine, borderRadius: R.pill, paddingHorizontal: 10, height: 22 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
            <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.2, color: C.text }}>REPLAY</Text>
          </View>
        ) : isQ ? (
          <View style={{ backgroundColor: C.accent, borderRadius: R.pill, paddingHorizontal: 10, height: 22, justifyContent: 'center' }}>
            <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.2, color: C.accentInk }}>{t('O QUE FAZIAS?')}</Text>
          </View>
        ) : (
          <View style={{ borderWidth: 1, borderColor: C.borderStrong, borderRadius: R.pill, paddingHorizontal: 10, height: 22, justifyContent: 'center' }}>
            <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.2, color: C.textDim }}>{t('MÃO JOGADA')}</Text>
          </View>
        )}
      </View>

      <View style={{ position: 'absolute', top: 106, left: GUTTER, right: face ? FACE.right + FACE.d + 8 : GUTTER, gap: 8 }}>
        <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(800), fontSize: 11, letterSpacing: 1.4, color: C.muted }}>
          {title.toUpperCase()}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'nowrap', overflow: 'hidden' }}>
          <MetaPill label={heroPos} color={posColor(heroPos)} />
          <MetaPill label={blindsLabel(hand)} mono />
          {stage ? <MetaPill label={stage} /> : null}
          {g.playersLeft ? <MetaPill label={t('{n} restantes', { n: g.playersLeft })} /> : null}
        </View>
        {text ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <View style={{ width: 3, borderRadius: 2, backgroundColor: C.accent }} />
            <Text allowFontScaling={false}
              numberOfLines={3}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{ flex: 1, fontFamily: ff(800), fontWeight: '800', fontSize: long ? 18 : 21, lineHeight: long ? 22 : 25, color: C.text, letterSpacing: -0.5 }}>
              {text}
            </Text>
          </View>
        ) : null}
      </View>

      {voice ? (
        <View
          style={{
            position: 'absolute',
            left: VOICE_CHIP.left,
            top: VOICE_CHIP.top,
            width: VOICE_CHIP.w,
            height: VOICE_CHIP.h,
            borderRadius: R.pill,
            backgroundColor: 'rgba(255,106,61,0.12)',
            borderWidth: 1,
            borderColor: C.accentLine,
            justifyContent: 'center',
            paddingLeft: 8,
          }}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" fill={C.accent} />
          </Svg>
          {voice === 'preview' ? (
            <View
              style={{
                position: 'absolute',
                left: VOICE_SLOT.x - VOICE_CHIP.left - 1,
                top: VOICE_SLOT.y - VOICE_CHIP.top - 1,
                width: VOICE_SLOT.w,
                height: VOICE_SLOT.h,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              {PREVIEW_BARS.map((b, i) => (
                <View key={i} style={{ width: 2, height: b * VOICE_SLOT.h, borderRadius: 1, backgroundColor: C.accent }} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {face ? (
        <View
          style={{
            position: 'absolute',
            left: STORY_W - FACE.right - FACE.d,
            top: FACE.top,
            width: FACE.d,
            height: FACE.d,
            borderRadius: FACE.d / 2,
            borderWidth: 2,
            borderColor: C.accent,
            backgroundColor: face === 'preview' ? C.surface2 : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {face === 'preview' ? (
            <Svg width={40} height={40} viewBox="0 0 24 24">
              <Path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" fill={C.muted} />
            </Svg>
          ) : null}
        </View>
      ) : null}

      {/* Laid out at the replayer's phone width, then scaled to fit, so seats and cards keep their proportions. */}
      <View style={{ position: 'absolute', width: tableW, height: tableW * STAGE_RATIO, left: (STORY_W - tableW) / 2, top: tableTop }}>
        <View
          style={{
            position: 'absolute',
            width: TABLE_NATIVE_W,
            left: (tableW - TABLE_NATIVE_W) / 2,
            top: ((tableW - TABLE_NATIVE_W) * STAGE_RATIO) / 2,
            transform: [{ scale: tableW / TABLE_NATIVE_W }],
          }}>
          <ReplayerTable view={view} heroIndex={hand.hero} button={hand.button} />
        </View>
      </View>

      {/* Above Instagram's reply bar */}
      <View style={{ position: 'absolute', left: GUTTER, right: GUTTER, top: bottomTop, gap: 10 }}>
        {isQ && poll ? (
          // Instagram has no API for stickers: the player drops the Poll sticker here.
          <View
            style={{
              height: 80,
              borderRadius: R.lg,
              borderWidth: poll === 'hint' ? 1.5 : 0,
              borderStyle: 'dashed',
              borderColor: C.accentLine,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}>
            {poll === 'hint' ? (
              <>
                <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 12, color: C.accent }}>{t('Sticker Sondagem aqui')}</Text>
                <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(600), fontSize: 11, color: C.muted }}>
                  {moment.options.map((o) => o.label).join(' · ')}
                </Text>
              </>
            ) : null}
          </View>
        ) : isQ ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {moment.options.map((o, i) => (
              <View
                key={o.label}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: R.md,
                  borderWidth: 1,
                  borderColor: C.borderStrong,
                  backgroundColor: C.surface2,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingHorizontal: 6,
                  shadowColor: '#000',
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                }}>
                <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                  <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 9, color: C.muted }}>{String.fromCharCode(65 + i)}</Text>
                </View>
                <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, fontFamily: ff(800), fontSize: 14, color: C.text }}>
                  {o.label}
                </Text>
              </View>
            ))}
          </View>
        ) : reel && !atEnd ? (
          <View
            style={{
              height: 48,
              borderRadius: R.md,
              borderWidth: 1,
              borderColor: C.borderStrong,
              backgroundColor: C.surface2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              paddingHorizontal: 14,
            }}>
            <View style={{ gap: 1, flexShrink: 1 }}>
              <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.2, color: C.accent }}>{STREET_LABEL[view.street].toUpperCase()}</Text>
              <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(700), fontSize: 13, color: C.text }}>
                {dealt ?? view.narration}
              </Text>
            </View>
            <Text allowFontScaling={false} style={{ fontFamily: F.mono, fontSize: 16, color: C.textDim }}>{view.potLabel}</Text>
          </View>
        ) : result ? (
          <View
            style={{
              height: 48,
              borderRadius: R.md,
              borderWidth: 1,
              borderColor: heroNet > 0 ? 'rgba(74,222,128,0.30)' : C.borderStrong,
              backgroundColor: heroNet > 0 ? C.goodSoft : C.surface2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 14,
            }}>
            <View style={{ gap: 1 }}>
              <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.2, color: C.muted }}>{t('RESULTADO DO HERO')}</Text>
              <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontFamily: ff(700), fontSize: 12, color: C.textDim }}>
                {heroHand ?? (heroNet > 0 ? t('Hero leva o pote') : t('Pote {pot}', { pot: moment.pot }))}
              </Text>
            </View>
            <Text allowFontScaling={false} style={{ fontFamily: F.mono, fontSize: 22, color: heroNet > 0 ? C.good : heroNet < 0 ? C.bad : C.text }}>
              {heroNet > 0 ? '+' : heroNet < 0 ? '−' : ''}
              {amount(Math.abs(heroNet), hand, inBB)}
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <LinkGlyph />
          <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 12, color: C.textDim }}>
            {isQ ? (poll ? t('O que aconteceu') : t('Vota e vê o que aconteceu')) : t('Replay completo')}{' '}
            <Text allowFontScaling={false} style={{ color: C.text }}>{brand ? t('em {host}', { host: linkHost }) : t('no link')}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
