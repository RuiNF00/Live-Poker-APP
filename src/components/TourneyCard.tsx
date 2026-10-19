// "Currículo de torneios": a 9:16 card of a player's tournament record to post
// as a story. Laid out at 360×640 points and captured at 1080×1920 like the
// session cards. Amounts are hidden unless the player turns them on: the
// record (cashes, ITM, deepest runs) reads well without them.

import { FitText } from './FitText';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';

import { locale, t } from '@/i18n';
import { decimal, money, shortDate } from '@/poker/format';
import type { Score, Summary } from '@/store/tourney-stats';
import { MIN_SAMPLE } from '@/store/tourney-stats';
import { C, F, ff } from '@/theme';
import { ordinal } from '@/share/festival-card';

import { linkHost, POST_H, STORY_H, STORY_W, Wordmark } from './StoryCard';

export interface TourneyCardProps {
  name: string;
  sum: Summary;
  scores: Score[];
  currency: string;
  /** "Desde mar 2025": the oldest tournament in the record. */
  since: number;
  hideMoney: boolean;
  brand: boolean;
  /** 'post': 4:5 for X and other apps, with the best result only (three don't fit with the prizes line). */
  format?: 'story' | 'post';
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n)}%`);
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n)) + '%';

function Big({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 11, letterSpacing: 1.2, color: C.muted }}>{label.toUpperCase()}</Text>
      <FitText style={{ fontFamily: F.mono, fontSize: 30, letterSpacing: -1, color: tone ?? C.text }}>{value}</FitText>
    </View>
  );
}

export function TourneyCard({ name, sum, scores: all, currency, since, hideMoney, brand, format = 'story', ref }: TourneyCardProps) {
  const post = format === 'post';
  const scores = post ? all.slice(0, 1) : all;
  const roiOk = sum.roi !== null && sum.count >= MIN_SAMPLE;
  return (
    <View ref={ref} collapsable={false} style={{ width: STORY_W, height: post ? POST_H : STORY_H, backgroundColor: C.bg, overflow: 'hidden' }}>
      <LinearGradient colors={['#2A140B', C.bg, C.bg, C.bgDeep]} locations={[0, 0.35, 0.75, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: post ? 26 : 48, paddingBottom: post ? 18 : 28, gap: post ? 14 : 22 }}>
        <View style={{ gap: 6 }}>
          <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 12, letterSpacing: 2, color: C.accent }}>{t('CURRÍCULO DE TORNEIOS')}</Text>
          <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: C.text }} numberOfLines={2}>
            {name || t('O meu currículo')}
          </Text>
          <Text allowFontScaling={false} style={{ fontFamily: ff(600), fontSize: 13, color: C.textDim }}>{t('{n} torneios · desde {date}', { n: sum.count, date: shortDate(since) })}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Big label={t('Cashes')} value={String(sum.cashes)} />
          <Big label="ITM" value={pct(sum.itm)} />
          {roiOk ? <Big label="ROI" value={signed(sum.roi!)} tone={sum.roi! >= 0 ? C.good : C.bad} /> : <Big label={t('Lugar médio')} value={sum.avgFinish ? String(Math.round(sum.avgFinish)) : '—'} />}
        </View>

        {!hideMoney ? (
          <View style={{ gap: 2 }}>
            <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 11, letterSpacing: 1.2, color: C.muted }}>{t('EM PRÉMIOS')}</Text>
            <FitText style={{ fontFamily: F.mono, fontSize: 40, letterSpacing: -1.5, color: C.text }}>{money(sum.prizes, currency)}</FitText>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 11, letterSpacing: 1.2, color: C.muted }}>{t('MAIORES RESULTADOS')}</Text>
          {scores.length ? (
            scores.map((s, i) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: i === 0 ? 'rgba(255,106,61,0.14)' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: i === 0 ? 'rgba(255,106,61,0.35)' : 'rgba(255,255,255,0.06)' }}>
                <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 20, color: i === 0 ? C.accent : C.text, minWidth: 54 }}>{s.finish ? ordinal(s.finish) : '—'}</Text>
                <View style={{ flex: 1 }}>
                  <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 14, color: C.text }} numberOfLines={1}>
                    {s.name || t('Torneio')}
                  </Text>
                  <Text allowFontScaling={false} style={{ fontFamily: ff(600), fontSize: 12, color: C.textDim }} numberOfLines={1}>
                    {(s.field ? t('de {n}', { n: s.field.toLocaleString(locale) }) + ' · ' : '') + shortDate(s.at)}
                  </Text>
                </View>
                <Text allowFontScaling={false} style={{ fontFamily: F.mono, fontSize: 15, color: C.text }}>{hideMoney ? `${s.multiple >= 10 ? Math.round(s.multiple) : decimal(s.multiple)}×` : money(s.prize, currency)}</Text>
              </View>
            ))
          ) : (
            <Text allowFontScaling={false} style={{ fontFamily: ff(600), fontSize: 14, color: C.textDim }}>{t('O primeiro cash está para vir.')}</Text>
          )}
        </View>

        <View style={{ flex: 1 }} />
        {brand ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Wordmark size={15} />
            <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 10, letterSpacing: 0.6, color: C.muted }}>{linkHost}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
