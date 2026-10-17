// The story of a festival plan ("O meu plano"): the festival, then each
// planned day with its times and events, for friends going too. Laid out at
// 360×640 points and captured at 1080×1920 like the other stories. Buy-ins
// only when the player turns them on; never a total or the bankroll.

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { t } from '@/i18n';
import { fitPlan, type PlanDay } from '@/share/festival-plan';
import { C, R, ff } from '@/theme';

import { Logo } from './FestivalCard';
import { linkHost, STORY_H, STORY_W } from './StoryCard';

const SIDE = 26;
export function FestivalPlanCard({ name, dates, days, buyIns = false, ref }: { name: string; dates: string; days: PlanDay[]; buyIns?: boolean; ref?: React.Ref<React.ComponentRef<typeof View>> }) {
  const fit = fitPlan(days);
  return (
    <View ref={ref} collapsable={false} style={{ width: STORY_W, height: STORY_H, overflow: 'hidden', backgroundColor: C.bgDeep }}>
      <LinearGradient colors={[C.bgDeep, C.bg, C.bg, C.bgDeep]} locations={[0, 0.3, 0.75, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      <Svg width={STORY_W} height={STORY_H} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          <RadialGradient id="planEmber" cx="50%" cy="22%" rx="80%" ry="30%">
            <Stop offset="0" stopColor={C.accent} stopOpacity="0.16" />
            <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={STORY_W} height={STORY_H} fill="url(#planEmber)" />
      </Svg>

      {/* Below Instagram's profile bar */}
      <View style={{ position: 'absolute', top: 70, left: SIDE, right: SIDE, height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo ink={false} />
        <View style={{ borderWidth: 1, borderColor: C.accentLine, borderRadius: R.pill, paddingHorizontal: 10, height: 22, justifyContent: 'center' }}>
          <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.2, color: C.text }}>
            {t('O MEU PLANO')}
          </Text>
        </View>
      </View>

      <View style={{ position: 'absolute', top: 112, left: SIDE, right: SIDE, gap: 4 }}>
        <Text allowFontScaling={false} numberOfLines={2} style={{ fontFamily: ff(800), fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: C.text }}>
          {name}
        </Text>
        {dates ? (
          <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 11, letterSpacing: 1.2, color: C.accent }}>
            {dates}
          </Text>
        ) : null}
      </View>

      <View style={{ position: 'absolute', top: 196, left: SIDE, right: SIDE, gap: 10 }}>
        {fit.days.map((d) => (
          <View key={d.day} style={{ gap: 4 }}>
            <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10.5, letterSpacing: 1.1, color: C.textDim }}>
              {d.label.toUpperCase()}
            </Text>
            {d.rows.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 13, color: C.accent, width: 40, fontVariant: ['tabular-nums'] }}>
                  {r.time}
                </Text>
                <Text allowFontScaling={false} numberOfLines={1} style={{ flex: 1, fontFamily: ff(700), fontSize: 13, color: C.text }}>
                  {r.title}
                  {r.flight ? <Text style={{ color: C.textDim, fontFamily: ff(600) }}>{` · ${r.flight}`}</Text> : null}
                </Text>
                {buyIns && r.buyIn ? (
                  <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 12, color: C.textDim, fontVariant: ['tabular-nums'] }}>
                    {r.buyIn}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ))}
        {fit.more ? (
          <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 12, color: C.textDim }}>
            {fit.more === 1 ? t('+1 torneio') : t('+{n} torneios', { n: fit.more })}
          </Text>
        ) : null}
      </View>

      <View style={{ position: 'absolute', bottom: 92, left: SIDE, right: SIDE, alignItems: 'center', gap: 4 }}>
        <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 13, color: C.text }}>
          {t('Vens também?')}
        </Text>
        <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 11, color: C.textDim, letterSpacing: 0.4 }}>
          {t('Feito com')} <Text style={{ fontFamily: ff(800), color: C.accent }}>Sweatbook</Text>
          {` · ${linkHost}`}
        </Text>
      </View>
    </View>
  );
}
