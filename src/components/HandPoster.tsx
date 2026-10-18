// The hand as a poster: a collector-card look for the feed, built from the hand
// alone (hero's cards big, the board, three numbers in big blinds). No money and
// no won/lost badge: the bb line says how it went. Laid out at 360×640 points
// (story) or 360×450 (4:5 post) like the other share cards, captured at 1080 wide.

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { t } from '@/i18n';
import { comboLabel, displayRank, SUIT_SYMBOL } from '@/poker/cards';
import { positions } from '@/poker/engine';
import { blindsLabel, shortDate } from '@/poker/format';
import { posterStats } from '@/share/hand-poster';
import { STAGES, type CardCode, type Hand, type Suit } from '@/poker/types';
import { C, F, R, ff, posColor } from '@/theme';

import { FitText } from './FitText';
import { Logo, Watermark } from './SessionCard';
import { POST_H, STORY_H, STORY_W } from './StoryCard';

export interface HandPosterProps {
  hand: Hand;
  /** Sweatbook wordmark and "Feito com Sweatbook". Free posters always carry it. */
  brand?: boolean;
  /** 'post': 4:5 for the feed and X. */
  format?: 'story' | 'post';
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

const CREAM = '#F6F2E8';

function BigCard({ card, w }: { card: CardCode; w: number }) {
  const h = Math.round(w * 1.4);
  const col = C.suit[card[1] as Suit];
  return (
    <View style={{ width: w, height: h, borderRadius: w * 0.14, backgroundColor: CREAM, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)', padding: w * 0.09, justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
      <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: w * 0.5, lineHeight: w * 0.54, color: col, letterSpacing: -1 }}>
        {displayRank(card)}
      </Text>
      <Text allowFontScaling={false} style={{ alignSelf: 'flex-end', fontSize: w * 0.46, lineHeight: w * 0.5, color: col }}>
        {SUIT_SYMBOL[card[1] as Suit]}
      </Text>
    </View>
  );
}

function SmallCard({ card, w }: { card: CardCode; w: number }) {
  const col = C.suit[card[1] as Suit];
  return (
    <View style={{ width: w, height: Math.round(w * 1.36), borderRadius: 5, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
      <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: w * 0.5, lineHeight: w * 0.56, color: col }}>
        {displayRank(card)}
      </Text>
      <Text allowFontScaling={false} style={{ fontSize: w * 0.38, lineHeight: w * 0.42, color: col }}>
        {SUIT_SYMBOL[card[1] as Suit]}
      </Text>
    </View>
  );
}

export function HandPoster({ hand, brand = true, format = 'story', ref }: HandPosterProps) {
  const g = hand.game;
  const post = format === 'post';
  const H = post ? POST_H : STORY_H;
  const hero = hand.players[hand.hero];
  const cards = (hero?.cards ?? []).filter(Boolean) as CardCode[];
  const pos = positions(hand.players.length, hand.button)[hand.hero];
  const title = g.name || (g.kind === 'mtt' ? t('Torneio') : 'Cash');
  const stage = STAGES.find((s) => s.id === g.stage)?.label;
  const sub = [blindsLabel(hand), g.level ? t('Nível {n}', { n: g.level }) : null, stage ?? null].filter(Boolean).join(' · ');
  const stats = posterStats(hand);
  const boards = [hand.board, hand.board2].filter((b): b is CardCode[] => !!b && b.length > 0);
  const tags = hand.tags.slice(0, 3);
  // Story: clear of Instagram's profile and reply bars; post: tighter.
  const pad = post ? 18 : 74;
  const cardW = post ? 76 : 86;
  const frameH = post ? H - pad * 2 : H - pad - 124;

  return (
    <View ref={ref} collapsable={false} style={{ width: STORY_W, height: H, overflow: 'hidden', backgroundColor: C.bgDeep }}>
      <LinearGradient colors={[C.bgDeep, C.bg, C.bgDeep]} locations={[0, 0.5, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      <Svg width={STORY_W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="34%" rx="70%" ry="36%">
            <Stop offset="0" stopColor={C.accent} stopOpacity="0.22" />
            <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={STORY_W} height={H} fill="url(#glow)" />
      </Svg>

      {/* The collector card */}
      <View style={{ position: 'absolute', top: pad, left: 22, right: 22, height: frameH, borderRadius: 26, borderWidth: 1.5, borderColor: C.accentLine, backgroundColor: 'rgba(12,19,17,0.72)', padding: 18, gap: post ? 10 : 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {brand ? <Logo size={12} color={C.accent} cut={C.bg} /> : <View />}
          <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.4, color: C.textDim }}>{shortDate(hand.createdAt).toUpperCase()}</Text>
        </View>

        <View style={{ gap: 3 }}>
          <Text allowFontScaling={false} numberOfLines={2} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: post ? 22 : 26, lineHeight: post ? 26 : 30, color: C.text, letterSpacing: -0.6 }}>
            {title}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 11, color: C.textDim }}>
            {sub}
          </Text>
        </View>

        {/* Hero's cards, big, with the seat and the combo */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {cards.length ? cards.map((c, i) => <View key={c + i} style={{ transform: [{ rotate: i === 0 ? '-6deg' : '6deg' }] }}><BigCard card={c} w={cardW} /></View>) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {pos ? (
              <View style={{ paddingHorizontal: 9, height: 24, borderRadius: R.pill, justifyContent: 'center', backgroundColor: posColor(pos) + '2A', borderWidth: 1, borderColor: posColor(pos) + '66' }}>
                <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 12, color: posColor(pos) }}>{pos}</Text>
              </View>
            ) : null}
            {cards.length === 2 ? <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 18, color: C.text }}>{comboLabel(cards)}</Text> : null}
          </View>
        </View>

        {boards.length ? (
          <View style={{ gap: 6, alignItems: 'center' }}>
            {boards.map((b, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
                {b.map((c, j) => <SmallCard key={c + j} card={c} w={boards.length > 1 ? 28 : 34} />)}
              </View>
            ))}
          </View>
        ) : null}

        {stats.length ? (
          <View style={{ flexDirection: 'row', gap: 10, borderTopWidth: 1, borderColor: C.border, paddingTop: 12 }}>
            {stats.map((x) => (
              <View key={x.key} style={{ flex: 1, gap: 2 }}>
                <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(800), fontSize: 9.5, letterSpacing: 1.3, color: C.textDim }}>{x.label.toUpperCase()}</Text>
                <FitText style={{ fontFamily: F.mono, fontSize: 22, lineHeight: 28, color: x.tone === 'good' ? C.good : x.tone === 'bad' ? C.bad : C.text }}>{x.value}</FitText>
              </View>
            ))}
          </View>
        ) : null}

        {tags.length && !post ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {tags.map((x) => (
              <View key={x} style={{ height: 22, paddingHorizontal: 9, borderRadius: R.pill, justifyContent: 'center', backgroundColor: 'rgba(238,242,239,0.07)', borderWidth: 1, borderColor: C.hairline }}>
                <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(700), fontSize: 11, color: C.textDim }}>{t(x)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* Above Instagram's reply bar */}
      {brand && !post ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 74 }}><Watermark color={C.accent} dim={C.textDim} /></View> : null}
    </View>
  );
}
