// One card of "O meu ano no póquer", laid out at 360×640 points like the
// session cards and captured at 1080×1920 for an Instagram story. Each card
// says one thing with one big number; amounts go when money is hidden.

import { FitText } from './FitText';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { locale, t } from '@/i18n';
import { blindsLabel, chips, duration, pct, rawMoney, shortDate } from '@/poker/format';
import { playedMs } from '@/store/session-math';
import type { StakeRow, YearCardKind, YearReview } from '@/share/year-review';
import { countryName, flag } from '@/tax/countries';
import { C, F, R, ff } from '@/theme';

import { PlayingCard } from './PlayingCard';
import { Logo, Watermark } from './SessionCard';
import { STORY_H, STORY_W } from './StoryCard';

const INK = C.accentInk;
const LOOK: Record<YearCardKind, 'noite' | 'brasa'> = { year: 'brasa', best: 'noite', stakes: 'noite', bankroll: 'noite', pot: 'noite', streak: 'brasa' };

const oneDecimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
const signed = (n: number, cur: string) => (n > 0 ? '+' : '') + rawMoney(Math.round(n), cur);
const toneOf = (n: number) => (n > 0 ? C.good : n < 0 ? C.bad : undefined);

/** With money hidden two tournament stakes would both read "Torneios": `other` tells them apart by buy-in. */
export function stakeName(x: StakeRow, cur: string, hideMoney: boolean, other?: StakeRow | null): string {
  if (x.kind === 'cash') return `${chips(x.sb)}/${chips(x.bb)}`;
  if (!hideMoney) return `MTT ${rawMoney(x.buyIn, cur)}`;
  if (other?.kind === 'mtt' && other.buyIn !== x.buyIn) return x.buyIn > other.buyIn ? t('Torneios mais caros') : t('Torneios mais baratos');
  return t('Torneios');
}

const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');

/** The rate of a stake: money per hour, or with money hidden bb/h (cash) and ROI (tournaments). */
export function stakeRate(x: StakeRow, cur: string, hideMoney: boolean): string | null {
  if (!hideMoney) return signed(x.hourly, cur) + '/h';
  if (x.bbPerHour !== null) return sign(x.bbPerHour) + oneDecimal.format(Math.abs(x.bbPerHour)) + ' bb/h';
  if (x.roi !== null) return sign(x.roi) + pct(Math.abs(x.roi)) + ' ROI';
  return null;
}

export interface YearCardProps {
  review: YearReview;
  kind: YearCardKind;
  hideMoney?: boolean;
  /** Sweatbook wordmark and the "Feito com Sweatbook" footer. Free cards always carry it. */
  brand?: boolean;
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

export function YearCard({ review: r, kind, hideMoney = true, brand = true, ref }: YearCardProps) {
  const accent = LOOK[kind] === 'brasa';
  const fg = accent ? INK : C.text;
  const dim = accent ? 'rgba(26,10,4,0.62)' : C.textDim;
  const line = accent ? 'rgba(26,10,4,0.16)' : C.border;
  const p = { r, fg, dim, line, accent, hideMoney };

  return (
    <View ref={ref} collapsable={false} style={{ width: STORY_W, height: STORY_H, overflow: 'hidden', backgroundColor: accent ? C.accent : C.bgDeep }}>
      {accent ? (
        <LinearGradient colors={['#FF7A4F', C.accent, '#E9542A']} locations={[0, 0.5, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
      ) : (
        <>
          <LinearGradient colors={[C.bgDeep, C.bg, C.bg, C.bgDeep]} locations={[0, 0.3, 0.75, 1]} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
          <Svg width={STORY_W} height={STORY_H} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>
              <RadialGradient id="yember" cx="50%" cy="45%" rx="75%" ry="40%">
                <Stop offset="0" stopColor={C.accent} stopOpacity="0.16" />
                <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={STORY_W} height={STORY_H} fill="url(#yember)" />
          </Svg>
        </>
      )}

      {/* Below Instagram's profile bar */}
      <View style={{ position: 'absolute', top: 70, left: 26, right: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {brand ? <Logo size={14} color={accent ? INK : C.accent} cut={accent ? C.accent : C.bg} /> : <View />}
        <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.4, color: dim }}>{t('O meu ano no póquer').toUpperCase()}</Text>
      </View>

      <View style={{ position: 'absolute', top: 120, left: 26, right: 26, bottom: 150, justifyContent: 'center' }}>
        {kind === 'year' ? <YearBody {...p} /> : kind === 'best' ? <BestBody {...p} /> : kind === 'stakes' ? <StakesBody {...p} /> : kind === 'bankroll' ? <BankrollBody {...p} /> : kind === 'pot' ? <PotBody {...p} /> : <StreakBody {...p} />}
      </View>

      {/* Above Instagram's reply bar */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 74 }}>{brand ? <Watermark color={accent ? INK : C.accent} dim={dim} /> : null}</View>
    </View>
  );
}

interface BodyProps {
  r: YearReview;
  fg: string;
  dim: string;
  line: string;
  accent: boolean;
  hideMoney: boolean;
}

function Kicker({ children, dim }: { children: string; dim: string }) {
  return <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 11, letterSpacing: 1.6, color: dim }}>{children.toUpperCase()}</Text>;
}

function Big({ children, color, size = 64, font = F.mono }: { children: string; color: string; size?: number; font?: string }) {
  return (
    <FitText style={{ fontFamily: font, fontSize: size, lineHeight: size * 1.12, color, letterSpacing: size > 40 ? -2 : -0.5 }}>{children}</FitText>
  );
}

function Caption({ children, dim }: { children: string; dim: string }) {
  return (
    <Text allowFontScaling={false} numberOfLines={2} style={{ fontFamily: ff(700), fontSize: 13, lineHeight: 18, color: dim }}>
      {children}
    </Text>
  );
}

function Stat({ label, value, fg, dim }: { label: string; value: string; fg: string; dim: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(800), fontSize: 10, letterSpacing: 1.4, color: dim }}>
        {label.toUpperCase()}
      </Text>
      <FitText style={{ fontFamily: F.mono, fontSize: 30, lineHeight: 36, color: fg }}>{value}</FitText>
    </View>
  );
}

function YearBody({ r, fg, dim, line, hideMoney }: BodyProps) {
  const flags = r.countries.map(flag).join(' ');
  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 2 }}>
        <Kicker dim={dim}>{t('Horas na mesa em {year}', { year: r.year })}</Kicker>
        <Big color={fg} size={88}>{`${Math.round(r.hours)}h`}</Big>
      </View>
      <View style={{ height: 1, backgroundColor: line }} />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Stat label={t('Sessões')} value={String(r.sessions)} fg={fg} dim={dim} />
        <Stat label={t('Salas')} value={String(r.venues)} fg={fg} dim={dim} />
        {r.hands ? <Stat label={t('Mãos')} value={String(r.hands)} fg={fg} dim={dim} /> : null}
      </View>
      {/* Hours and sessions count every currency; money is one currency only, so it says which. */}
      {!hideMoney ? (
        <View style={{ gap: 2 }}>
          <Kicker dim={dim}>{t('Resultado em {currency}', { currency: r.currency })}</Kicker>
          <Big color={toneOf(r.profit) ?? fg} size={40}>{signed(r.profit, r.currency)}</Big>
        </View>
      ) : null}
      {r.countries.length ? (
        <View style={{ gap: 6 }}>
          <Kicker dim={dim}>{r.countries.length === 1 ? t('1 país') : t('{n} países', { n: r.countries.length })}</Kicker>
          <Text allowFontScaling={false} style={{ fontSize: 28, lineHeight: 34 }}>{flags}</Text>
          {r.countries.length <= 3 ? <Caption dim={dim}>{r.countries.map(countryName).join(' · ')}</Caption> : null}
        </View>
      ) : r.topVenue ? (
        <View style={{ gap: 4 }}>
          <Kicker dim={dim}>{t('A tua sala')}</Kicker>
          <Text allowFontScaling={false} numberOfLines={1} style={{ fontFamily: ff(800), fontSize: 26, color: fg }}>
            {r.topVenue}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function BestBody({ r, fg, dim, line, hideMoney }: BodyProps) {
  const b = r.best;
  const sc = r.score;
  const place = sc?.session.finish ? (sc.session.field ? `${sc.session.finish}º/${sc.session.field}` : `${sc.session.finish}º`) : null;
  return (
    <View style={{ gap: 18 }}>
      {b ? (
        <View style={{ gap: 4 }}>
          <Kicker dim={dim}>{t('Melhor sessão')}</Kicker>
          <Big color={hideMoney ? fg : C.good}>{hideMoney ? duration(playedMs(b.session)) : signed(b.profit, r.currency)}</Big>
          <Caption dim={dim}>{[b.session.name || b.session.venue, shortDate(b.session.startedAt)].filter(Boolean).join(' · ')}</Caption>
        </View>
      ) : null}
      {b && sc ? <View style={{ height: 1, backgroundColor: line }} /> : null}
      {sc && (!hideMoney || place) ? (
        <View style={{ gap: 4 }}>
          <Kicker dim={dim}>{t('Maior prémio em torneio')}</Kicker>
          <Big color={fg} size={b ? 44 : 64}>{hideMoney ? place! : rawMoney(sc.prize, r.currency)}</Big>
          <Caption dim={dim}>{[sc.session.name, !hideMoney && place, sc.session.venue].filter(Boolean).join(' · ')}</Caption>
        </View>
      ) : null}
    </View>
  );
}

function StakeLine({ label, x, other, r, fg, dim, hideMoney }: { label: string; x: StakeRow; other?: StakeRow | null } & BodyProps) {
  const rate = stakeRate(x, r.currency, hideMoney);
  const v = hideMoney ? (x.bbPerHour ?? x.roi ?? 0) : x.hourly;
  return (
    <View style={{ gap: 4 }}>
      <Kicker dim={dim}>{label}</Kicker>
      <FitText style={{ fontFamily: F.mono, fontSize: 44, lineHeight: 50, color: fg, letterSpacing: -1 }}>{stakeName(x, r.currency, hideMoney, other)}</FitText>
      {rate ? <Text allowFontScaling={false} style={{ fontFamily: F.mono, fontSize: 24, lineHeight: 30, color: toneOf(v) ?? fg }}>{rate}</Text> : null}
      <Caption dim={dim}>{x.sessions === 1 ? t('1 sessão · {h}h', { h: Math.round(x.hours) }) : t('{n} sessões · {h}h', { n: x.sessions, h: Math.round(x.hours) })}</Caption>
    </View>
  );
}

function StakesBody(p: BodyProps) {
  const { r, fg, dim, line, hideMoney } = p;
  return (
    <View style={{ gap: 18 }}>
      {r.bestStake ? <StakeLine {...p} label={r.worstStake ? t('Onde ganhaste mais') : t('A tua stake')} x={r.bestStake} other={r.worstStake} /> : null}
      {r.worstStake ? <View style={{ height: 1, backgroundColor: line }} /> : null}
      {r.worstStake ? <StakeLine {...p} label={r.worstStake.hourly < 0 ? t('Onde custou mais') : t('Onde ganhaste menos')} x={r.worstStake} other={r.bestStake} /> : null}
      {!hideMoney && r.hourly !== null ? (
        <View style={{ marginTop: 14, gap: 2 }}>
          <Kicker dim={dim}>{t('Por hora no ano')}</Kicker>
          <Big color={toneOf(r.hourly) ?? fg} size={r.bestStake ? 40 : 64}>{signed(r.hourly, r.currency) + '/h'}</Big>
        </View>
      ) : hideMoney && !r.bestStake ? (
        <View style={{ gap: 2 }}>
          <Kicker dim={dim}>{t('Horas na mesa')}</Kicker>
          <Big color={fg}>{`${Math.round(r.hours)}h`}</Big>
        </View>
      ) : null}
    </View>
  );
}

const MONTH = (m: number, style: 'long' | 'narrow') => {
  const n = new Date(2026, m, 1).toLocaleDateString(locale, { month: style });
  return n.charAt(0).toUpperCase() + n.slice(1);
};
const DAY = 86_400_000;

/** The year as a bankroll: twelve months as bars, the best one, and the deepest fall and whether it was won back. */
function BankrollBody({ r, fg, dim, line, hideMoney }: BodyProps) {
  const max = Math.max(1, ...r.months.map((m) => Math.abs(m.profit)));
  const BAR = 54;
  const d = r.downswing;
  return (
    <View style={{ gap: 18 }}>
      {r.bestMonth ? (
        <View style={{ gap: 2 }}>
          <Kicker dim={dim}>{t('Melhor mês')}</Kicker>
          <Big color={fg} size={56} font={ff(800)}>
            {MONTH(r.bestMonth.month, 'long')}
          </Big>
          <Caption dim={dim}>{hideMoney ? t('{h} h na mesa', { h: Math.round(r.months[r.bestMonth.month].hours) }) : signed(r.bestMonth.profit, r.currency)}</Caption>
        </View>
      ) : null}
      {/* Up and down from a middle line; heights are relative, so they show the shape and never an amount. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {r.months.map((m) => (
          <View key={m.month} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ height: BAR * 2 + 1, width: '100%', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', left: 0, right: 0, top: BAR, height: 1, backgroundColor: line }} />
              {m.sessions ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 2,
                    right: 2,
                    borderRadius: 3,
                    height: Math.max(3, (Math.abs(m.profit) / max) * BAR),
                    backgroundColor: m.profit >= 0 ? C.good : C.bad,
                    ...(m.profit >= 0 ? { bottom: BAR + 1 } : { top: BAR + 1 }),
                  }}
                />
              ) : null}
            </View>
            <Text allowFontScaling={false} style={{ fontFamily: ff(800), fontSize: 9, color: m.sessions ? dim : line }}>{MONTH(m.month, 'narrow')}</Text>
          </View>
        ))}
      </View>
      {d ? (
        <>
          <View style={{ height: 1, backgroundColor: line }} />
          <View style={{ gap: 2 }}>
            <Kicker dim={dim}>{t('Maior downswing')}</Kicker>
            <Big color={hideMoney ? fg : C.bad} size={40}>
              {hideMoney ? (d.sessions === 1 ? t('1 sessão') : t('{n} sessões', { n: d.sessions })) : '−' + rawMoney(Math.round(d.depth), r.currency)}
            </Big>
            <Caption dim={dim}>
              {d.recovered ? t('Recuperado em {n} dias', { n: Math.max(1, Math.round((d.recovered - d.to) / DAY)) }) : t('Ainda a recuperar')}
            </Caption>
          </View>
        </>
      ) : null}
    </View>
  );
}

function PotBody({ r, fg, dim }: BodyProps) {
  const h = r.pot!.hand;
  const mine = h.players[h.hero]?.cards ?? [];
  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 2 }}>
        <Kicker dim={dim}>{t('Maior pote do ano')}</Kicker>
        <Big color={fg} size={80}>{`${chips(Math.round(r.pot!.bb))} bb`}</Big>
        <Caption dim={dim}>{[blindsLabel(h), shortDate(h.createdAt)].join(' · ')}</Caption>
      </View>
      {mine.length ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {mine.map((c, i) => (
            <PlayingCard key={i} card={c} size="lg" />
          ))}
        </View>
      ) : null}
      {h.board.length ? (
        <View style={{ gap: 8 }}>
          <Kicker dim={dim}>{t('Mesa')}</Kicker>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {h.board.map((c, i) => (
              <PlayingCard key={i} card={c} size="md" />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function StreakBody({ r, fg, dim }: BodyProps) {
  const dot = 'rgba(26,10,4,0.16)';
  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 2 }}>
        <Kicker dim={dim}>{t('Semanas seguidas a registar')}</Kicker>
        <Big color={fg} size={96}>{String(r.streak)}</Big>
        <Caption dim={dim}>{t('{n} semanas do ano a rever o teu jogo', { n: r.weeksLogged })}</Caption>
      </View>
      {/* The year in weeks, 13 to a row. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: 13 * 18 + 12 * 6 }}>
        {r.weekMap.map((on, i) => (
          <View key={i} style={{ width: 18, height: 18, borderRadius: R.sm / 2, backgroundColor: on ? INK : dot }} />
        ))}
      </View>
      <Caption dim={dim}>{t('Conta mãos e notas, não horas de jogo.')}</Caption>
    </View>
  );
}
