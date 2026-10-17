// Shareable session cards (Hevy/Garmin/Strava style): three big numbers from
// the session in a few looks to swipe through, an optional milestone, and a
// transparent sticker to lay over a photo of the table. Full cards are laid
// out at 360×640 points and captured at 1080×1920 like the hand stories.

import { FitText } from './FitText';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { t } from '@/i18n';
import { shortDate } from '@/poker/format';
import type { CardStat, CardStyle, Milestone } from '@/share/session-card';
import type { Session } from '@/store/types';
import { C, F, R, ff } from '@/theme';

import { linkHost, POST_H, STORY_H, STORY_W } from './StoryCard';

/** The sticker is captured on its own, at this size in points. */
export const STICKER_W = 320;
export const STICKER_H = 180;

const INK = C.accentInk;

export function Logo({ size, color, cut }: { size: number; color: string; cut: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Svg width={size + 4} height={size + 4} viewBox="0 2 64 64">
        <Path d="M32 12.5 L44.73 25.27 A18 18 0 1 1 19.27 25.27 Z" fill={color} />
        <Path d="M24 36 H40 M24 42 H40 M24 48 H34" stroke={cut} strokeWidth={3.2} strokeLinecap="round" />
      </Svg>
      <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: size, color: color === C.accent ? C.text : color, letterSpacing: -0.3 }}>
        Sweat<Text allowFontScaling={false} style={{ color }}>book</Text>
      </Text>
    </View>
  );
}

/** "Feito com Sweatbook": always on free cards. */
export function Watermark({ color, dim }: { color: string; dim: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 11, color: dim, letterSpacing: 0.4 }}>
        {t('Feito com')} <Text allowFontScaling={false} style={{ fontFamily: ff(800), color }}>Sweatbook</Text>
      </Text>
      <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 10, color: dim, letterSpacing: 0.6 }}>{linkHost}</Text>
    </View>
  );
}

/** Places and room names read better in the brand font than in mono. */
const numFont = (x: CardStat) => (x.key === 'place' || x.key === 'venue' ? ff(800) : F.mono);

function toneColor(tone: CardStat['tone'], onAccent: boolean, base: string) {
  if (onAccent) return INK;
  return tone === 'good' ? C.good : tone === 'bad' ? C.bad : base;
}

export interface SessionCardProps {
  session: Session;
  stats: CardStat[];
  look: CardStyle;
  milestone?: Milestone | null;
  hideMoney?: boolean;
  /** Stack card mid-festival: no venue, so the post doesn't say where the player is right now. */
  hideVenue?: boolean;
  /** Sweatbook wordmark and "Feito com Sweatbook". Free cards always carry it. */
  brand?: boolean;
  /** 'post': 4:5 for X and other apps, without the room Instagram's bars need. */
  format?: 'story' | 'post';
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

export function SessionCard(props: SessionCardProps) {
  return props.look === 'sticker' ? <SessionSticker {...props} /> : <FullCard {...props} />;
}

function FullCard({ session: s, stats, look, milestone, hideMoney, hideVenue, brand = true, format = 'story', ref }: SessionCardProps) {
  const accent = look === 'brasa';
  const fg = accent ? INK : C.text;
  const dim = accent ? 'rgba(26,10,4,0.62)' : C.textDim;
  const line = accent ? 'rgba(26,10,4,0.16)' : C.border;
  const title = s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash');
  const showMilestone = !!milestone;
  const [lead, ...rest] = stats;
  const post = format === 'post';
  const H = post ? POST_H : STORY_H;
  // Story: clear of Instagram's profile and reply bars. Post: nothing on top, so it sits tighter.
  const at = post
    ? { head: 26, title: 62, milestone: 146, numbers: showMilestone ? 196 : 150, mark: 22 }
    : { head: 70, title: 118, milestone: 206, numbers: 268, mark: 74 };

  return (
    <View ref={ref} collapsable={false} style={{ width: STORY_W, height: H, overflow: 'hidden', backgroundColor: accent ? C.accent : C.bgDeep }}>
      {accent ? (
        <LinearGradient colors={['#FF7A4F', C.accent, '#E9542A']} locations={[0, 0.5, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      ) : (
        <>
          <LinearGradient colors={[C.bgDeep, C.bg, C.bg, C.bgDeep]} locations={[0, 0.3, 0.75, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
          <Svg width={STORY_W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>
              <RadialGradient id="ember" cx="50%" cy="42%" rx="75%" ry="40%">
                <Stop offset="0" stopColor={C.accent} stopOpacity="0.16" />
                <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={STORY_W} height={H} fill="url(#ember)" />
          </Svg>
        </>
      )}

      {/* Below Instagram's profile bar */}
      <View style={{ position: 'absolute', top: at.head, left: 26, right: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {brand ? <Logo size={14} color={accent ? INK : C.accent} cut={accent ? C.accent : C.bg} /> : <View />}
        <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.4, color: dim }}>{shortDate(s.startedAt).toUpperCase()}</Text>
      </View>

      <View style={{ position: 'absolute', top: at.title, left: 26, right: 26, gap: 6 }}>
        <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(800), fontSize: 11, letterSpacing: 1.6, color: dim }}>
          {((!hideVenue && s.venue) || (s.kind === 'mtt' ? t('Torneio') : 'Cash')).toUpperCase()}
        </Text>
        <Text allowFontScaling={false} numberOfLines={2} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: 26, lineHeight: 30, color: fg, letterSpacing: -0.6 }}>
          {title}
        </Text>
      </View>

      {showMilestone ? (
        <View style={{ position: 'absolute', top: at.milestone, left: 26, right: 26, flexDirection: 'row' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingHorizontal: 12,
              height: 30,
              borderRadius: R.pill,
              backgroundColor: accent ? INK : C.accent,
            }}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M7 4h10v3a5 5 0 0 1-10 0V4Zm-3 1h3v2a3 3 0 0 1-3-2Zm16 0h-3v2a3 3 0 0 0 3-2ZM10 13h4v3h3v3H7v-3h3v-3Z" fill={accent ? C.accent : INK} />
            </Svg>
            <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 12, color: accent ? C.accent : INK }}>
              {milestone!.title}
              {milestone!.detail && !(milestone!.money && hideMoney) ? ' · ' + milestone!.detail : ''}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Three big numbers, the first one hero-sized. */}
      <View style={{ position: 'absolute', top: at.numbers, left: 26, right: 26, gap: 20 }}>
        {lead ? (
          <View style={{ gap: 2 }}>
            <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 11, letterSpacing: 1.6, color: dim }}>{lead.label.toUpperCase()}</Text>
            <FitText style={{ fontFamily: numFont(lead), fontSize: 64, lineHeight: 72, color: toneColor(lead.tone, accent, fg), letterSpacing: -2 }}>{lead.value}</FitText>
          </View>
        ) : null}
        <View style={{ height: 1, backgroundColor: line }} />
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {rest.map((x) => (
            <View key={x.key} style={{ flex: 1, gap: 4 }}>
              <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.4, color: dim }}>{x.label.toUpperCase()}</Text>
              <FitText style={{ fontFamily: numFont(x), fontSize: 30, lineHeight: 36, color: toneColor(x.tone, accent, fg) }}>{x.value}</FitText>
            </View>
          ))}
        </View>
      </View>

      {/* Above Instagram's reply bar */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: at.mark }}>{brand ? <Watermark color={accent ? INK : C.accent} dim={dim} /> : null}</View>
    </View>
  );
}

/** Transparent sticker for a photo of the table: no background outside the panel. */
function SessionSticker({ session: s, stats, hideVenue, brand = true, ref }: SessionCardProps) {
  const title = s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash');
  return (
    <View ref={ref} collapsable={false} style={{ width: STICKER_W, height: STICKER_H, backgroundColor: 'transparent' }}>
      <View
        style={{
          flex: 1,
          borderRadius: 22,
          backgroundColor: 'rgba(8,14,12,0.78)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.14)',
          paddingHorizontal: 18,
          paddingVertical: 14,
          justifyContent: 'space-between',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text allowFontScaling={false} numberOfLines={1} style={{ flexShrink: 1, fontFamily: ff(800), fontSize: 14, color: C.text }}>
            {title}
          </Text>
          {brand ? <Logo size={11} color={C.accent} cut={C.bg} /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {stats.map((x) => (
            <View key={x.key} style={{ flex: 1, gap: 2 }}>
              <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(800), fontSize: 9, letterSpacing: 1.2, color: C.textDim }}>
                {x.label.toUpperCase()}
              </Text>
              <FitText style={{ fontFamily: numFont(x), fontSize: 20, color: toneColor(x.tone, false, C.text) }}>{x.value}</FitText>
            </View>
          ))}
        </View>
        <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 10, color: C.textDim }}>
          {[hideVenue ? null : s.venue, shortDate(s.startedAt)].filter(Boolean).join(' · ')}
          {brand ? '  ·  ' + linkHost : ''}
        </Text>
      </View>
    </View>
  );
}
