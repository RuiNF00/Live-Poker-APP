// The 9:16 frame that becomes an Instagram story. Always laid out at 360×640
// points so the capture is the same on every phone; the share code exports it
// at 1080×1920. Instagram covers roughly the top and bottom 14% of a story
// (profile bar, reply box), so nothing important sits there.

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { amount, blindsLabel } from '@/poker/format';
import { STAGES, type Hand, type Street } from '@/poker/types';
import { seatViews } from '@/poker/view';
import type { StoryMoment } from '@/story/moment';
import { BRAND, C, F, ff } from '@/theme';

import { Table } from './Table';

export const STORY_W = 360;
export const STORY_H = 640;

const STREET_PT: Record<Street, string> = { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River' };

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
      <Text style={{ fontFamily: ff(800), fontWeight: '800', fontSize: size, color: C.text, letterSpacing: -0.3 }}>
        Sweat<Text style={{ color: C.accent }}>book</Text>
      </Text>
    </View>
  );
}

export interface StoryCardProps {
  hand: Hand;
  moment: StoryMoment;
  comment: string;
  inBB: boolean;
  /** Sweatbook wordmark and site name. Free stories always carry it. */
  brand?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

export function StoryCard({ hand, moment, comment, inBB, brand = true, onLayout, ref }: StoryCardProps) {
  const g = hand.game;
  const st = moment.step.state;
  const isQ = moment.mode === 'question';
  const result = isQ ? null : moment.replay.result;
  const views = seatViews(hand, st, { inBB, reveal: !isQ, result, hideActing: !isQ });
  if (result) {
    views.forEach((v, k) => {
      v.stack = amount(st.stacks[k] + result.won[k], hand, inBB);
      v.allIn = false;
    });
  }
  const stage = STAGES.find((s) => s.id === g.stage)?.label;
  const meta = [g.name || (g.kind === 'mtt' ? 'Torneio' : 'Cash'), blindsLabel(hand), stage].filter(Boolean).join('  ·  ');
  const text = comment.trim();
  const long = text.length > 90;
  const heroNet = result ? result.net[hand.hero] : 0;
  const tableW = text ? 276 : 316;

  return (
    <View ref={ref} collapsable={false} onLayout={onLayout} style={{ width: STORY_W, height: STORY_H, backgroundColor: C.bg, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#0C1311', '#0F2019', '#123227', '#0C1311']}
        locations={[0, 0.35, 0.62, 1]}
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      />

      {/* Below Instagram's profile bar */}
      <View style={{ position: 'absolute', top: 70, left: 22, right: 22, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: brand ? 'space-between' : 'flex-end' }}>
          {brand ? <Wordmark size={13} /> : null}
          <View style={{ backgroundColor: isQ ? C.accent : C.surface3, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1, color: isQ ? C.accentInk : C.text }}>
              {isQ ? 'O QUE FAZIAS?' : 'MÃO JOGADA'}
            </Text>
          </View>
        </View>
        <Text numberOfLines={1} style={{ fontFamily: F.monoRegular, fontSize: 10, color: C.muted, letterSpacing: 0.2 }}>
          {meta.toUpperCase()}
        </Text>
        {text ? (
          <Text
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ fontFamily: ff(800), fontWeight: '800', fontSize: long ? 19 : 23, lineHeight: long ? 23 : 27, color: C.text, letterSpacing: -0.4, marginTop: 2 }}>
            {text}
          </Text>
        ) : null}
      </View>

      <View style={{ position: 'absolute', width: tableW, left: (STORY_W - tableW) / 2, top: text ? 204 : 124 }}>
        <Table
          seats={views}
          hero={hand.hero}
          button={hand.button}
          board={hand.board.slice(0, st.boardCount)}
          pot={moment.pot}
          narration={isQ ? STREET_PT[moment.street] + (moment.toCall ? ' · para pagar ' + moment.toCall : '') : undefined}
        />
      </View>

      {/* Above Instagram's reply bar */}
      <View style={{ position: 'absolute', left: 22, right: 22, top: text ? 532 : 486, gap: 8 }}>
        {isQ ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {moment.options.map((o) => (
              <View
                key={o.label}
                style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: C.borderStrong, backgroundColor: 'rgba(22,32,29,0.92)', paddingVertical: 10, alignItems: 'center' }}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: ff(800), fontSize: 14, color: C.text }}>
                  {o.label}
                </Text>
              </View>
            ))}
          </View>
        ) : result ? (
          <View style={{ alignItems: 'center', marginTop: 14 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 22, color: heroNet > 0 ? C.good : heroNet < 0 ? C.bad : C.text }}>
              {heroNet > 0 ? '+' : heroNet < 0 ? '−' : ''}
              {amount(Math.abs(heroNet), hand, inBB)}
            </Text>
            <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>{heroNet > 0 ? 'Hero leva o pote' : 'Resultado do Hero'}</Text>
          </View>
        ) : null}
        <Text style={{ textAlign: 'center', fontFamily: ff(700), fontSize: 12, color: C.textDim }}>
          {isQ ? 'Vota e vê o que aconteceu ' : 'Replay completo '}
          <Text style={{ color: C.accent }}>{brand ? 'em ' + linkHost : 'no link'}</Text>
        </Text>
      </View>
    </View>
  );
}
