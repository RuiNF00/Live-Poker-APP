// "O meu mês no póquer": one story card for a month, at 360×640 points like
// the year cards, captured at 1080×1920. Amounts go when money is hidden;
// the hours, sessions and BB/h say enough on their own.

import { FitText } from './FitText';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';

import { locale, t } from '@/i18n';
import { duration, rawMoney, shortDate } from '@/poker/format';
import { monthName, type MonthRecap } from '@/store/month-recap';
import { playedMs } from '@/store/session-math';
import { C, F, ff } from '@/theme';

import { Logo, Watermark } from './SessionCard';
import { POST_H, STORY_H, STORY_W } from './StoryCard';

const INK = C.accentInk;
const DIM = 'rgba(26,10,4,0.62)';
const LINE = 'rgba(26,10,4,0.16)';
const signed = (n: number, cur: string) => (n > 0 ? '+' : '') + rawMoney(Math.round(n), cur);

function Kicker({ children }: { children: string }) {
  return <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 11, letterSpacing: 1.6, color: DIM }}>{children.toUpperCase()}</Text>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.4, color: DIM }}>
        {label.toUpperCase()}
      </Text>
      <FitText style={{ fontFamily: F.mono, fontSize: 30, lineHeight: 36, color: INK }}>{value}</FitText>
    </View>
  );
}

export function MonthCard({
  r,
  hideMoney = true,
  brand = true,
  format = 'story',
  ref,
}: {
  r: MonthRecap;
  hideMoney?: boolean;
  brand?: boolean;
  /** 'post': 4:5 for X and other apps, without the room Instagram's bars need. */
  format?: 'story' | 'post';
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}) {
  const post = format === 'post';
  const bb = r.bbHourly !== null ? `${r.bbHourly > 0 ? '+' : ''}${r.bbHourly.toLocaleString(locale, { maximumFractionDigits: 1 })}` : null;
  const b = r.best && r.best.profit > 0 ? r.best : null;
  return (
    <View ref={ref} collapsable={false} style={{ width: STORY_W, height: post ? POST_H : STORY_H, overflow: 'hidden', backgroundColor: C.accent }}>
      <LinearGradient colors={['#FF7A4F', C.accent, '#E9542A']} locations={[0, 0.5, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />

      {/* Below Instagram's profile bar */}
      <View style={{ position: 'absolute', top: post ? 26 : 70, left: 26, right: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {brand ? <Logo size={14} color={INK} cut={C.accent} /> : <View />}
        <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.4, color: DIM }}>{t('O meu mês no póquer').toUpperCase()}</Text>
      </View>

      <View style={{ position: 'absolute', top: post ? 52 : 120, left: 26, right: 26, bottom: post ? 52 : 150, justifyContent: 'center', gap: post ? 12 : 18 }}>
        <View style={{ gap: 2 }}>
          <Kicker>{monthName(r.key, true)}</Kicker>
          <FitText style={{ fontFamily: F.mono, fontSize: 88, lineHeight: 98, color: INK, letterSpacing: -2 }}>{hideMoney ? `${Math.round(r.hours)}h` : signed(r.profit, r.currency)}</FitText>
          <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 13, color: DIM }}>{hideMoney ? t('na mesa') : t('{h} h na mesa', { h: Math.round(r.hours) })}</Text>
        </View>
        <View style={{ height: 1, backgroundColor: LINE }} />
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Stat label={t('Sessões')} value={String(r.sessions)} />
          {bb ? <Stat label={r.cashSessions === r.sessions ? 'BB/h' : t('BB/h cash')} value={bb} /> : r.mtts ? <Stat label="ITM" value={`${r.cashes}/${r.mtts}`} /> : null}
          {r.venues ? <Stat label={t('Salas')} value={String(r.venues)} /> : null}
        </View>
        {b ? (
          <View style={{ gap: 4 }}>
            <Kicker>{t('Melhor sessão')}</Kicker>
            <FitText style={{ fontFamily: F.mono, fontSize: 40, lineHeight: 46, color: INK, letterSpacing: -1 }}>{hideMoney ? duration(playedMs(b.session)) : signed(b.profit, r.currency)}</FitText>
            <Text allowFontScaling={false} numberOfLines={2} style={{ fontFamily: ff(700), fontSize: 13, lineHeight: 18, color: DIM }}>
              {[b.session.name || b.session.venue, shortDate(b.session.startedAt)].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Above Instagram's reply bar */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: post ? 20 : 74 }}>{brand ? <Watermark color={INK} dim={DIM} /> : null}</View>
    </View>
  );
}
