// The pieces every share card uses: the story and post sizes, the link host and the
// Sweatbook mark. Kept apart from StoryCard.tsx so the cards don't bring the whole story frame
// (and the launch chunk) with them.

import React from 'react';
import { Text, View } from 'react-native';
import { Path, Svg } from '@/components/svg';

// Only share images use these, and those look the same in either theme: the dark palette, never the live `C`.
import { t } from '@/i18n';
import { BRAND, DARK as C, ff } from '@/theme';

export const STORY_W = 360;
export const STORY_H = 640;
/** A feed post (X, or another app) at 4:5, so X shows it whole in the timeline: 1080×1350 exported. */
export const POST_H = 450;

export const linkHost = BRAND.webUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

export const MARK_VIEWBOX = '6 4 56 56';
export const MARK_ARROW = 'M12.13 27.78 L11.63 30.48 L11.53 33.23 L11.8 35.99 L12.46 38.69 L13.47 41.28 L14.83 43.73 L16.52 45.97 L18.5 47.97 L20.73 49.69 L23.19 51.09 L25.82 52.16 L28.57 52.86 L31.4 53.19 L34.26 53.13 L37.09 52.69 L39.85 51.86 L42.47 50.67 L44.92 49.14 L47.14 47.28 L49.09 45.14 L50.75 42.75 L52.07 40.15 L53.03 37.39 L53.61 34.53 L53.8 31.6 L53.6 28.67 L53 25.78 L52.02 23 L50.66 20.36 L48.97 17.93 L46.95 15.74 L44.66 13.85 L42.13 12.27 L39.4 11.04 L36.52 10.2 L33.56 9.74 L33.22 14.6 L35.55 14.88 L37.83 15.47 L40.02 16.37 L42.08 17.55 L43.96 19 L45.63 20.7 L47.07 22.61 L48.23 24.7 L49.11 26.93 L49.69 29.27 L49.94 31.67 L49.87 34.09 L49.47 36.48 L48.76 38.81 L47.73 41.02 L46.42 43.09 L44.83 44.96 L43.01 46.61 L40.97 48 L38.76 49.11 L36.41 49.91 L33.97 50.39 L31.48 50.54 L28.98 50.36 L26.53 49.84 L24.15 49 L21.91 47.84 L19.84 46.38 L17.97 44.66 L16.34 42.69 L14.99 40.52 L13.94 38.18 L13.2 35.71 L12.8 33.16 L12.73 30.56 L12.99 27.96 A0.44 0.44 0 0 0 12.13 27.78 Z M26.4 11.69 L33.38 17.69 L34.14 6.71 Z';
export const MARK_CLUB = 'M26.62 24.71 a5.38 5.38 0 1 0 10.75 0 a5.38 5.38 0 1 0 -10.75 0 Z M20.98 32.77 a5.38 5.38 0 1 0 10.75 0 a5.38 5.38 0 1 0 -10.75 0 Z M32.27 32.77 a5.38 5.38 0 1 0 10.75 0 a5.38 5.38 0 1 0 -10.75 0 Z M28.77 26.59 L27.7 33.58 L36.3 33.58 L35.23 26.59 Z M32 30.89 C31.73 37.07 30.39 40.56 26.89 42.98 Q32 42.17 37.11 42.98 C33.61 40.56 32.27 37.07 32 30.89 Z';
export const MARK_PLAY = 'M30.39 27.8 Q30.39 26.99 31.09 27.39 L34.82 29.62 Q35.49 30.03 34.82 30.43 L31.09 32.66 Q30.39 33.06 30.39 32.26 Z';

/** Sweatbook mark: a club with a play button inside a replay arrow. */
export function Mark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox={MARK_VIEWBOX}>
      <Path d={MARK_ARROW} fill={C.accent} />
      <Path d={MARK_CLUB} fill={C.text} />
      <Path d={MARK_PLAY} fill={C.accent} />
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

// The session card's logo and watermark, here so the month, year and hand cards use them without SessionCard.tsx.
export function Logo({ size, color, cut }: { size: number; color: string; cut: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Svg width={size + 4} height={size + 4} viewBox={MARK_VIEWBOX}>
        <Path d={MARK_ARROW} fill={color} />
        <Path d={MARK_CLUB} fill={color} />
        <Path d={MARK_PLAY} fill={cut} />
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
