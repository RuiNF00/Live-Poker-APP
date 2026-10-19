// The hand as a poster, like a collector card: hero's cards big, the board, the
// spot in a line and three numbers in big blinds. Laid out at 360×640 points
// (story) or 360×450 (4:5 post for X, WhatsApp and other apps, whose feeds cut a
// 9:16 story), captured at 1080 wide. No money and no won/lost badge: the bb
// line says how it went. A question poster stops at hero's decision and hides
// the rest of the board and the result.

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { t } from '@/i18n';
import { comboLabel, displayRank, SUIT_SYMBOL } from '@/poker/cards';
import { positions } from '@/poker/engine';
import { blindsLabel, shortDate } from '@/poker/format';
import { STAGES, type CardCode, type Hand, type Suit } from '@/poker/types';
import { posterStats, posterTitle } from '@/share/hand-poster';
import { storyMoment, type StoryMoment } from '@/story/moment';
import { posterLine } from '@/story/poster';
import { C, F, R, ff, posColor } from '@/theme';

import { FitText } from './FitText';
import { STREET_LABEL, viewAt } from './replayer/model';
import { Watermark } from './SessionCard';
import { linkHost, POST_H, STORY_H, STORY_W, Wordmark } from './StoryCard';

const CREAM = '#F6F2E8';

function BigCard({ card, w }: { card: CardCode; w: number }) {
  const col = C.suit[card[1] as Suit];
  return (
    <View style={{ width: w, height: Math.round(w * 1.4), borderRadius: w * 0.14, backgroundColor: CREAM, borderWidth: 1, borderColor: 'rgba(0,0,0,0.25)', padding: w * 0.09, justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
      <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: w * 0.5, lineHeight: w * 0.54, color: col, letterSpacing: -1 }}>
        {displayRank(card)}
      </Text>
      <Text allowFontScaling={false} style={{ alignSelf: 'flex-end', fontSize: w * 0.46, lineHeight: w * 0.5, color: col }}>
        {SUIT_SYMBOL[card[1] as Suit]}
      </Text>
    </View>
  );
}

/** A board card or, before it comes, its place. */
function SmallCard({ card, w }: { card?: CardCode; w: number }) {
  const h = Math.round(w * 1.36);
  if (!card) return <View style={{ width: w, height: h, borderRadius: 5, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(238,242,239,0.18)' }} />;
  const col = C.suit[card[1] as Suit];
  return (
    <View style={{ width: w, height: h, borderRadius: 5, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
      <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: w * 0.5, lineHeight: w * 0.56, color: col }}>
        {displayRank(card)}
      </Text>
      <Text allowFontScaling={false} style={{ fontSize: w * 0.38, lineHeight: w * 0.42, color: col }}>
        {SUIT_SYMBOL[card[1] as Suit]}
      </Text>
    </View>
  );
}

export interface HandPosterProps {
  hand: Hand;
  /** The story's moment: a question stops at hero's decision. */
  moment: StoryMoment;
  comment: string;
  /** Sweatbook wordmark and site. Free posters always carry it. */
  brand?: boolean;
  /** 'post': 4:5 for X, WhatsApp and other apps. */
  format?: 'story' | 'post';
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

export function HandPoster({ hand, moment, comment, brand = true, format = 'story', ref }: HandPosterProps) {
  const g = hand.game;
  const post = format === 'post';
  const H = post ? POST_H : STORY_H;
  const isQ = moment.mode === 'question';
  const cards = (hand.players[hand.hero]?.cards ?? []).filter(Boolean) as CardCode[];
  const pos = positions(hand.players.length, hand.button)[hand.hero];
  // A typed name can carry the buy-in («Domingo €550»): the poster keeps the words, not the money.
  const title = posterTitle(g.name) || (g.kind === 'mtt' ? t('Torneio') : 'Cash');
  const stage = STAGES.find((s) => s.id === g.stage)?.label;
  const sub = [blindsLabel(hand), g.level ? t('Nível {n}', { n: g.level }) : null, stage ?? null].filter(Boolean).join(' · ');
  // A question shows the board as it was at hero's decision, with the cards still to come as empty places.
  const qBoard = isQ ? viewAt(hand, moment.replay, moment.stepIndex, { inBB: true, reveal: false, atEnd: false }).board : [];
  const boards: (CardCode | undefined)[][] = isQ ? [[0, 1, 2, 3, 4].map((i) => qBoard[i])] : [hand.board, hand.board2].filter((b): b is CardCode[] => !!b && b.length > 0);
  // Poster numbers are always in big blinds.
  const qm = isQ ? storyMoment(hand, 'question', true) : null;
  const stats: { key: string; label: string; value: string; tone?: 'good' | 'bad' | 'call' }[] = qm
    ? [
        { key: 'pot', label: t('Pote'), value: qm.pot },
        { key: 'street', label: t('Street'), value: STREET_LABEL[qm.street] },
        ...(qm.toCall ? [{ key: 'call', label: t('Para pagar'), value: qm.toCall, tone: 'call' as const }] : []),
      ]
    : posterStats(hand);
  const line = posterLine(hand, moment, comment);
  const tags = post || isQ ? [] : hand.tags.slice(0, 3);
  // Story: clear of Instagram's profile and reply bars; post: tighter.
  const pad = post ? 14 : 74;
  const side = post ? 14 : 22;
  const cardW = post ? (line ? 66 : 76) : line && tags.length ? 80 : 86;
  const frameH = post ? H - pad * 2 : H - pad - 110;
  const inner = STORY_W - 2 * side - 36;

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
      <View style={{ position: 'absolute', top: pad, left: side, right: side, height: frameH, borderRadius: 26, borderWidth: 1.5, borderColor: C.accentLine, backgroundColor: 'rgba(12,19,17,0.72)', padding: 18, gap: post ? 8 : 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {brand ? <Wordmark size={13} /> : <View />}
          <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.4, color: C.textDim }}>{shortDate(hand.createdAt).toUpperCase()}</Text>
        </View>

        <View style={{ gap: 3 }}>
          <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: post ? 20 : 24, lineHeight: post ? 24 : 29, color: C.text, letterSpacing: -0.6 }}>
            {title}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 11, color: C.textDim }}>
            {sub}
          </Text>
        </View>

        {/* Hero's cards, big, with the seat and the combo */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: post ? 6 : 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {cards.map((c, i) => (
              <View key={c + i} style={{ transform: [{ rotate: i === 0 ? '-6deg' : '6deg' }] }}>
                <BigCard card={c} w={cardW} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {pos ? (
              <View style={{ paddingHorizontal: 9, height: 22, borderRadius: R.pill, justifyContent: 'center', backgroundColor: posColor(pos) + '2A', borderWidth: 1, borderColor: posColor(pos) + '66' }}>
                <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 12, color: posColor(pos) }}>{pos}</Text>
              </View>
            ) : null}
            {cards.length === 2 ? <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 17, color: C.text }}>{comboLabel(cards)}</Text> : null}
          </View>
        </View>

        {boards.length ? (
          <View style={{ gap: 6, alignItems: 'center' }}>
            {boards.map((b, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
                {b.map((c, j) => (
                  <SmallCard key={j} card={c} w={boards.length > 1 ? 26 : post ? 30 : 34} />
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {line ? (
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} style={{ textAlign: 'center', fontFamily: ff(800), fontWeight: '800', fontSize: post ? 16 : 19, lineHeight: post ? 20 : 23, letterSpacing: -0.3, color: C.text }}>
              {line}
            </Text>
            {qm?.options.length ? (
              <FitText width={inner} style={{ textAlign: 'center', fontFamily: ff(700), fontSize: 12, color: C.accent }}>
                {/* qm, not the story's moment: the poster's options are in bb too, never money or chips. */}
                {qm.options.map((o) => o.label).join('  ·  ')}
              </FitText>
            ) : null}
          </View>
        ) : null}

        {stats.length ? (
          <View style={{ flexDirection: 'row', gap: 10, borderTopWidth: 1, borderColor: C.border, paddingTop: post ? 8 : 12 }}>
            {stats.map((x) => (
              <View key={x.key} style={{ flex: 1, gap: 2 }}>
                <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(800), fontSize: 9.5, letterSpacing: 1.3, color: C.textDim }}>{x.label.toUpperCase()}</Text>
                <FitText width={(inner - 20) / 3} style={{ fontFamily: x.key === 'street' ? ff(800) : F.mono, fontSize: post ? 18 : 22, lineHeight: post ? 23 : 28, color: x.tone === 'good' ? C.good : x.tone === 'bad' ? C.bad : x.tone === 'call' ? C.accent : C.text }}>
                  {x.value}
                </FitText>
              </View>
            ))}
          </View>
        ) : null}

        {tags.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {tags.map((x) => (
              <View key={x} style={{ height: 22, paddingHorizontal: 9, borderRadius: R.pill, justifyContent: 'center', backgroundColor: 'rgba(238,242,239,0.07)', borderWidth: 1, borderColor: C.hairline }}>
                <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(700), fontSize: 11, color: C.textDim }}>{t(x)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* Above Instagram's reply bar: where to vote on a question, the watermark otherwise. */}
      {post ? null : isQ ? (
        <View style={{ position: 'absolute', left: 22, right: 22, bottom: 80, alignItems: 'center' }}>
          <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(700), fontSize: 12, color: C.textDim }}>
            {t('Vota e vê o que aconteceu')} <Text allowFontScaling={false} style={{ color: C.text }}>{brand ? t('em {host}', { host: linkHost }) : t('no link')}</Text>
          </Text>
        </View>
      ) : brand ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 74 }}>
          <Watermark color={C.accent} dim={C.textDim} />
        </View>
      ) : null}
    </View>
  );
}
