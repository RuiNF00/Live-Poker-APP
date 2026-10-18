// One hand as a 4:5 poster, like a trading card: hero's two cards big, the
// board under them, the spot in a line and three numbers. Goes to X, WhatsApp
// and other apps (a 9:16 story gets cut in their feeds). Never shows who won
// money: the result is the hand's own chips or bb, as on the replayer.

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { t } from '@/i18n';
import { displayRank, SUIT_SYMBOL } from '@/poker/cards';
import { blindsLabel } from '@/poker/format';
import { positions } from '@/poker/engine';
import type { CardCode, Hand, Suit } from '@/poker/types';
import type { StoryMoment } from '@/story/moment';
import { posterLine } from '@/story/poster';
import { C, F, R, ff, posColor } from '@/theme';

import { FitText } from './FitText';
import { STREET_LABEL, viewAt } from './replayer/model';
import { linkHost, POST_H, STORY_W, Wordmark } from './StoryCard';

const PAD = 24;
const INNER = STORY_W - 2 * PAD;

/** A cream card face drawn at poster size: rank and suit in a corner, a big suit in the middle. */
function BigCard({ card, w, tilt = 0 }: { card: CardCode; w: number; tilt?: number }) {
  const h = Math.round(w * 1.4);
  const suit = card[1] as Suit;
  const col = C.suit[suit];
  const rank = displayRank(card);
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: w * 0.11,
        backgroundColor: '#F6F2E8',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.25)',
        overflow: 'hidden',
        transform: tilt ? [{ rotate: `${tilt}deg` }] : undefined,
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', backgroundColor: col + '14' }} />
      <View style={{ position: 'absolute', left: w * 0.1, top: w * 0.06, alignItems: 'center' }}>
        <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: w * 0.36, lineHeight: w * 0.4, color: col, letterSpacing: rank.length > 1 ? -2 : -0.5 }}>
          {rank}
        </Text>
        <Text allowFontScaling={false} style={{ fontSize: w * 0.2, lineHeight: w * 0.22, color: col }}>{SUIT_SYMBOL[suit]}</Text>
      </View>
      <Text allowFontScaling={false} style={{ position: 'absolute', right: w * 0.1, bottom: w * 0.04, fontSize: w * 0.52, lineHeight: w * 0.6, color: col }}>
        {SUIT_SYMBOL[suit]}
      </Text>
    </View>
  );
}

/** A board card or, before it comes, its place. */
function BoardSlot({ card, w }: { card?: CardCode; w: number }) {
  if (card) return <BigCard card={card} w={w} />;
  return <View style={{ width: w, height: Math.round(w * 1.4), borderRadius: w * 0.11, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(238,242,239,0.18)' }} />;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(800), fontSize: 9, letterSpacing: 1.3, color: C.muted }}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

export interface HandPosterProps {
  hand: Hand;
  moment: StoryMoment;
  comment: string;
  inBB: boolean;
  /** Sweatbook wordmark and site name. Free posters always carry it. */
  brand?: boolean;
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

export function HandPoster({ hand, moment, comment, inBB, brand = true, ref }: HandPosterProps) {
  const isQ = moment.mode === 'question';
  const view = viewAt(hand, moment.replay, moment.stepIndex, { inBB, reveal: !isQ, atEnd: !isQ });
  const heroPos = positions(hand.players.length, hand.button)[hand.hero];
  const heroCards = hand.players[hand.hero]?.cards ?? [];
  const title = hand.game.name || (hand.game.kind === 'mtt' ? t('Torneio') : 'Cash');
  // Who hero is up against at this moment, with their cards when shown down.
  const rivals = view.seats.filter((s) => !s.hero && !s.folded);
  const shown = isQ ? [] : rivals.filter((s) => s.cards && s.cards.length);
  const line = posterLine(hand, moment, comment);
  const long = line.length > 60;

  return (
    <View ref={ref} collapsable={false} style={{ width: STORY_W, height: POST_H, backgroundColor: C.bgDeep, overflow: 'hidden' }}>
      <LinearGradient colors={[C.bg, C.bgDeep]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      {/* Felt light behind the cards. */}
      <Svg width={STORY_W} height={POST_H} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          <RadialGradient id="felt" cx="50%" cy="38%" rx="62%" ry="42%">
            <Stop offset="0" stopColor="#1F5A47" stopOpacity="0.6" />
            <Stop offset="0.6" stopColor="#123327" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#0C1311" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={STORY_W} height={POST_H} fill="url(#felt)" />
      </Svg>
      {/* The card's frame. */}
      <View style={{ position: 'absolute', left: 10, top: 10, right: 10, bottom: 10, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(238,242,239,0.12)' }} />
      <View style={{ position: 'absolute', left: 10, top: 10, width: 36, height: 36, borderTopLeftRadius: 18, borderLeftWidth: 2, borderTopWidth: 2, borderColor: C.accent }} />

      <View style={{ position: 'absolute', top: 26, left: PAD, right: PAD, height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {brand ? <Wordmark size={13} /> : <View />}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pill label={heroPos} color={posColor(heroPos)} />
          <Pill label={blindsLabel(hand)} mono />
        </View>
      </View>
      <View style={{ position: 'absolute', top: 56, left: PAD, right: PAD }}>
        <FitText style={{ fontFamily: ff(800), fontSize: 10.5, letterSpacing: 1.4, color: C.muted }} width={INNER}>
          {title.toUpperCase()}
        </FitText>
      </View>

      <View style={{ position: 'absolute', top: 80, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        {heroCards.slice(0, 2).map((c, i) => (
          <BigCard key={c} card={c} w={84} tilt={i === 0 ? -4 : 4} />
        ))}
      </View>
      <View style={{ position: 'absolute', top: 212, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <BoardSlot key={i} card={view.board[i]} w={42} />
        ))}
      </View>

      <View style={{ position: 'absolute', top: 284, left: PAD, right: PAD, height: 58, justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} style={{ textAlign: 'center', fontFamily: ff(800), fontWeight: '800', fontSize: long ? 16 : 20, lineHeight: long ? 20 : 24, letterSpacing: -0.4, color: C.text }}>
          {line}
        </Text>
        {isQ && moment.options.length ? (
          <FitText width={INNER} style={{ textAlign: 'center', fontFamily: ff(700), fontSize: 12, color: C.accent }}>
            {moment.options.map((o) => o.label).join('  ·  ')}
          </FitText>
        ) : null}
      </View>

      <View style={{ position: 'absolute', top: 352, left: PAD, right: PAD, flexDirection: 'row', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(238,242,239,0.10)' }}>
        <Stat label={t('Pote')}>
          <FitText width={(INNER - 20) / 3} style={{ fontFamily: F.mono, fontSize: 15, color: C.text }}>{moment.pot}</FitText>
        </Stat>
        <Stat label={t('Street')}>
          <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(700), fontSize: 15, color: C.text }}>{STREET_LABEL[moment.street]}</Text>
        </Stat>
        {isQ && moment.toCall ? (
          <Stat label={t('Para pagar')}>
            <FitText width={(INNER - 20) / 3} style={{ fontFamily: F.mono, fontSize: 15, color: C.accent }}>{moment.toCall}</FitText>
          </Stat>
        ) : (
          <Stat label={t('Contra')}>
            {shown.length ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 13, color: posColor(shown[0].pos) }}>{shown[0].pos}</Text>
                {(shown[0].cards ?? []).slice(0, 2).map((c) => (
                  <MiniCard key={c} card={c} />
                ))}
              </View>
            ) : (
              <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(700), fontSize: 15, color: C.text }}>
                {rivals.length ? rivals.map((s) => s.pos).join(', ') : '—'}
              </Text>
            )}
          </Stat>
        )}
      </View>

      <View style={{ position: 'absolute', left: PAD, right: PAD, bottom: 26, alignItems: 'center' }}>
        <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(700), fontSize: 11.5, color: C.textDim }}>
          {isQ ? t('Vota e vê o que aconteceu') : t('Replay completo')}{' '}
          <Text allowFontScaling={false} style={{ color: C.text }}>{brand ? t('em {host}', { host: linkHost }) : t('no link')}</Text>
        </Text>
      </View>
    </View>
  );
}

function Pill({ label, color, mono }: { label: string; color?: string; mono?: boolean }) {
  return (
    <View style={{ height: 22, paddingHorizontal: 9, borderRadius: R.pill, justifyContent: 'center', backgroundColor: color ? color + '24' : 'rgba(238,242,239,0.07)', borderWidth: 1, borderColor: color ? color + '40' : C.hairline }}>
      <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: mono ? F.mono : ff(700), fontSize: mono ? 10.5 : 11, color: color ?? C.textDim }}>
        {label}
      </Text>
    </View>
  );
}

function MiniCard({ card }: { card: CardCode }) {
  const suit = card[1] as Suit;
  return (
    <View style={{ width: 18, height: 24, borderRadius: 3, backgroundColor: '#F6F2E8', alignItems: 'center', justifyContent: 'center' }}>
      <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, lineHeight: 11, color: C.suit[suit] }}>{displayRank(card)}</Text>
      <Text allowFontScaling={false} style={{ fontSize: 8, lineHeight: 9, color: C.suit[suit] }}>{SUIT_SYMBOL[suit]}</Text>
    </View>
  );
}
