// The festival recap as an Instagram carousel for the feed: up to five 4:5
// slides (the summary, the best hand on the replayer table, the events, the
// trip day by day and a closing Sweatbook slide). Laid out at 360×450 points
// and captured at 1080×1350. Like the story, no amount shows unless the player
// turns it on, and only the trip's own name is on it, never the venue.

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { locale, t } from '@/i18n';
import { positions, replay } from '@/poker/engine';
import { chips, rawMoney } from '@/poker/format';
import { biLabel, dayKey, tripWeeks, type SlideKind, moneyLabel, resultParts, type EventRow, type FestivalRecap, type RecapStat } from '@/share/festival-card';
import { C, F, R, ff, posColor } from '@/theme';

import { dateRange, dayTicks, Logo } from './FestivalCard';
import { STAGE_RATIO } from './replayer/layout';
import { viewAt } from './replayer/model';
import { ReplayerTable } from './replayer/ReplayerTable';
import { linkHost, Mark } from './StoryCard';

export const SLIDE_W = 360;
export const SLIDE_H = 450;
const SIDE = 28;

export interface SlideProps {
  kind: SlideKind;
  index: number;
  count: number;
  recap: FestivalRecap;
  stats: RecapStat[];
  events: EventRow[];
  showMoney?: boolean;
  showResult?: boolean;
  brand?: boolean;
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

const Kicker = ({ children, color = C.textDim }: { children: React.ReactNode; color?: string }) => (
  <Text style={{ fontFamily: ff(800), fontSize: 11, letterSpacing: 1.6, color }}>{children}</Text>
);

function Backdrop({ glow }: { glow: string }) {
  return (
    <>
      <LinearGradient colors={[C.bgDeep, C.bg, C.bg, C.bgDeep]} locations={[0, 0.3, 0.75, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      <Svg width={SLIDE_W} height={SLIDE_H} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Defs>
          <RadialGradient id={'g' + glow} cx="50%" cy={glow} rx="80%" ry="45%">
            <Stop offset="0" stopColor={C.accent} stopOpacity="0.16" />
            <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={'f' + glow} cx="50%" cy="100%" rx="70%" ry="35%">
            <Stop offset="0" stopColor="#1F5A47" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#0C1311" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={SLIDE_W} height={SLIDE_H} fill={`url(#g${glow})`} />
        <Rect x="0" y="0" width={SLIDE_W} height={SLIDE_H} fill={`url(#f${glow})`} />
      </Svg>
    </>
  );
}

/** Logo on the left, "2/5" on the right: a feed post has no Instagram bars over it. */
function Top({ brand, index, count, label }: { brand: boolean; index: number; count: number; label: string }) {
  return (
    <View style={{ position: 'absolute', top: 22, left: SIDE, right: SIDE, height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {brand ? <Logo ink={false} /> : <Kicker>{label}</Kicker>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {brand ? <Kicker>{label}</Kicker> : null}
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>
          {index + 1}/{count}
        </Text>
      </View>
    </View>
  );
}

function Summary({ recap: r, stats, showMoney, showResult, last }: { recap: FestivalRecap; stats: RecapStat[]; showMoney: boolean; showResult: boolean; last: boolean }) {
  const ticks = dayTicks(r);
  const v = r.result?.value ?? r.money;
  const tone = v > 0 ? C.good : v < 0 ? C.bad : C.text;
  const lead = showResult && r.result ? resultParts(r.result) : showResult && showMoney ? { num: moneyLabel(r), unit: '' } : null;
  return (
    <View style={{ position: 'absolute', top: 62, bottom: 26, left: SIDE, right: SIDE, gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Kicker>{dateRange(r.from, r.to)}</Kicker>
        <Text numberOfLines={2} style={{ fontFamily: ff(800), fontWeight: '800', fontSize: 27, lineHeight: 31, color: C.text, letterSpacing: -0.7 }}>
          {r.title}
        </Text>
        <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
          {ticks.map((on, i) => (
            <View key={i} style={{ flex: 1, maxWidth: 14, height: 6, borderRadius: 3, backgroundColor: on ? C.accent : 'rgba(238,242,239,0.10)' }} />
          ))}
        </View>
      </View>
      {lead ? (
        <View>
          <Kicker>{t('RESULTADO')}</Kicker>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: lead.num.length > 7 ? 40 : 52, lineHeight: 58, color: tone, letterSpacing: -2 }}>
              {lead.num}
            </Text>
            {lead.unit ? <Text style={{ fontFamily: ff(800), fontSize: 22, color: tone, letterSpacing: -0.4 }}>{lead.unit}</Text> : null}
          </View>
          {showMoney && r.result ? (
            <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 15, color: C.textDim }}>
              {t('{v} no póquer', { v: moneyLabel(r) })}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={{ height: 1, backgroundColor: C.border }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 }}>
        {stats.map((x) => (
          <View key={x.key} style={{ width: '50%', gap: 2 }}>
            <Text style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.4, color: C.textDim }}>{x.label.toUpperCase()}</Text>
            <Text numberOfLines={1} style={{ fontFamily: x.key === 'place' ? ff(800) : F.mono, fontSize: 23, lineHeight: 28, color: x.tone === 'good' ? C.good : C.text }}>
              {x.value}
            </Text>
          </View>
        ))}
      </View>
      {last ? null : (
        <Text style={{ marginTop: 'auto', alignSelf: 'flex-end', fontFamily: ff(700), fontSize: 12, color: C.muted }}>{t('Desliza')} →</Text>
      )}
    </View>
  );
}

const TABLE_W = 296;

function BestHandSlide({ recap: r }: { recap: FestivalRecap }) {
  const b = r.bestHand!;
  const h = b.hand;
  const rp = replay(h);
  const last = rp.steps.length - 1;
  // The end of the hand, cards face up, in big blinds: the same table as the in-app replayer.
  const view = viewAt(h, rp, last, { inBB: true, reveal: true, atEnd: true });
  const pos = positions(h.players.length, h.button)[h.hero];
  return (
    <>
      <View style={{ position: 'absolute', top: 54, left: SIDE, right: SIDE, height: 26, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: ff(800), fontSize: 14, color: posColor(pos) }}>{pos}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.textDim }}>{`${chips(h.game.sb)}/${chips(h.game.bb)}`}</Text>
        <Text numberOfLines={1} style={{ flex: 1, textAlign: 'right', fontFamily: F.mono, fontSize: 20, color: C.good }}>
          +{Math.round(b.bb)} bb
        </Text>
      </View>
      {/* The hero's badge on the table already names the made hand. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 84, left: (SLIDE_W - TABLE_W) / 2, width: TABLE_W, height: TABLE_W * STAGE_RATIO }}>
        <ReplayerTable view={view} heroIndex={h.hero} button={h.button} />
      </View>
    </>
  );
}

const shortDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${d.toLocaleDateString(locale, { month: 'short' }).replace('.', '')}`.toUpperCase();
};

function EventsSlide({ recap: r, events, showMoney, showResult }: { recap: FestivalRecap; events: EventRow[]; showMoney: boolean; showResult: boolean }) {
  return (
    <View style={{ position: 'absolute', top: 62, bottom: 22, left: SIDE, right: SIDE }}>
      <Text style={{ fontFamily: ff(800), fontWeight: '800', fontSize: 24, color: C.text, letterSpacing: -0.5, marginBottom: 10 }}>
        {r.cashes ? t('{c} de {n} nos prémios', { c: r.cashes, n: r.events }) : r.events === 1 ? t('1 evento') : t('{n} eventos', { n: r.events })}
      </Text>
      {events.map((e, i) => (
        <View
          key={e.id}
          style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: e.cashed ? C.good : 'rgba(238,242,239,0.16)' }} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: ff(800), fontSize: 15, color: C.text }}>
              {e.name}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>{shortDay(e.day)}</Text>
          </View>
          {e.finish ? (
            <Text style={{ fontFamily: ff(800), fontSize: 15, color: e.cashed ? C.text : C.textDim }}>
              {e.field ? `${e.finish}º/${e.field}` : `${e.finish}º`}
            </Text>
          ) : null}
          {showResult && (e.bi !== null || showMoney) ? (
            <View style={{ minWidth: 70, alignItems: 'flex-end' }}>
              {e.bi !== null ? (
                <Text style={{ fontFamily: F.mono, fontSize: 15, color: e.bi > 0 ? C.good : C.textDim }}>{biLabel(e.bi)}</Text>
              ) : null}
              {showMoney ? (
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.muted }}>{(e.money > 0 ? '+' : '') + rawMoney(Math.round(e.money), r.currency)}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
      {r.events > events.length ? (
        <Text style={{ marginTop: 'auto', fontFamily: ff(700), fontSize: 12, color: C.muted }}>
          {t('Os {k} melhores de {n} eventos', { k: events.length, n: r.events })}
        </Text>
      ) : null}
    </View>
  );
}

function DaysSlide({ recap: r }: { recap: FestivalRecap }) {
  const weeks = tripWeeks(r.from, r.to);
  const total = weeks.flat().filter((x) => x !== null).length;
  const cell = weeks.length > 5 ? 34 : 38;
  const gap = 5;
  // 5 Jan 2026 is a Monday.
  const names = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(locale, { weekday: 'narrow' }).toUpperCase());
  const grid = 7 * cell + 6 * gap;
  return (
    <View style={{ position: 'absolute', top: 58, bottom: 20, left: SIDE, right: SIDE }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 46, lineHeight: 52, color: C.accent, letterSpacing: -1.5 }}>{r.days}</Text>
        <Text style={{ fontFamily: ff(800), fontSize: 18, color: C.text }}>{total === 1 ? t('de 1 dia à mesa') : t('de {n} dias à mesa', { n: total })}</Text>
      </View>
      <View style={{ width: grid, alignSelf: 'center', marginVertical: 'auto', gap }}>
        <View style={{ flexDirection: 'row', gap }}>
          {names.map((n, i) => (
            <Text key={i} style={{ width: cell, textAlign: 'center', fontFamily: ff(800), fontSize: 10, color: C.muted }}>
              {n}
            </Text>
          ))}
        </View>
        {weeks.map((w, i) => (
          <View key={i} style={{ flexDirection: 'row', gap }}>
            {w.map((ms, j) => {
              if (ms === null) return <View key={j} style={{ width: cell, height: cell }} />;
              const k = dayKey(ms);
              const on = r.played.has(k);
              return (
                <View
                  key={j}
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: R.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? C.accent : 'rgba(238,242,239,0.05)',
                    borderWidth: on ? 0 : 1,
                    borderColor: C.border,
                  }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 13, color: on ? C.accentInk : C.muted }}>{new Date(ms).getDate()}</Text>
                  {r.cashedOn.has(k) ? (
                    <View style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: on ? C.accentInk : C.good }} />
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
        <Legend color={C.accent} label={t('Dia de jogo')} />
        {r.cashedOn.size ? <Legend color={C.accentInk} ring label={t('Prémio')} /> : null}
      </View>
    </View>
  );
}

function Legend({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: ring ? 6 : 3, backgroundColor: ring ? C.accent : color, alignItems: 'center', justifyContent: 'center' }}>
        {ring ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} /> : null}
      </View>
      <Text style={{ fontFamily: ff(700), fontSize: 12, color: C.textDim }}>{label}</Text>
    </View>
  );
}

function CloseSlide() {
  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: SIDE, right: SIDE, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <Mark size={72} />
      <Text style={{ fontFamily: ff(800), fontWeight: '800', fontSize: 34, color: C.text, letterSpacing: -1 }}>
        Sweat<Text style={{ color: C.accent }}>book</Text>
      </Text>
      <Text style={{ fontFamily: ff(700), fontSize: 16, lineHeight: 22, color: C.textDim, textAlign: 'center', maxWidth: 270 }}>
        {t('As tuas mãos e sessões ao vivo, revistas em 30 segundos.')}
      </Text>
      <View style={{ marginTop: 10, borderWidth: 1, borderColor: C.accentLine, borderRadius: R.pill, paddingHorizontal: 16, height: 34, justifyContent: 'center' }}>
        <Text style={{ fontFamily: ff(800), fontSize: 14, color: C.text }}>{linkHost}</Text>
      </View>
      <Text style={{ fontFamily: ff(700), fontSize: 12, color: C.muted }}>{t('Link na legenda')}</Text>
    </View>
  );
}

const LABEL: Record<SlideKind, () => string> = {
  summary: () => t('RESUMO DO FESTIVAL'),
  hand: () => t('MELHOR MÃO'),
  events: () => t('EVENTOS'),
  days: () => t('DIAS DE JOGO'),
  close: () => '',
};

const GLOW: Record<SlideKind, string> = { summary: '30%', hand: '55%', events: '20%', days: '35%', close: '45%' };

export function FestivalSlide({ kind, index, count, recap, stats, events, showMoney = false, showResult = true, brand = true, ref }: SlideProps) {
  return (
    <View ref={ref} collapsable={false} style={{ width: SLIDE_W, height: SLIDE_H, overflow: 'hidden', backgroundColor: C.bgDeep }}>
      <Backdrop glow={GLOW[kind]} />
      {kind === 'close' ? null : <Top brand={brand} index={index} count={count} label={LABEL[kind]()} />}
      {kind === 'summary' ? <Summary recap={recap} stats={stats} showMoney={showMoney} showResult={showResult} last={count === 1} /> : null}
      {kind === 'hand' ? <BestHandSlide recap={recap} /> : null}
      {kind === 'events' ? <EventsSlide recap={recap} events={events} showMoney={showMoney} showResult={showResult} /> : null}
      {kind === 'days' ? <DaysSlide recap={recap} /> : null}
      {kind === 'close' ? <CloseSlide /> : null}
    </View>
  );
}
