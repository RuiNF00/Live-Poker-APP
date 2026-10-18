// The festival recap story: the result in buy-ins, four small numbers, a strip
// with one tick per day of the trip (lit on the days played) and the best
// hand of the trip, whose replay is the story's link. Laid out at 360×640
// points and captured at 1080×1920 like the other stories.

import { FitText } from "./FitText";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Text, View } from "react-native";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { locale, t } from "@/i18n";
import { positions } from "@/poker/engine";
import { chips } from "@/poker/format";
import {
  dayKey,
  moneyLabel,
  resultParts,
  type FestivalRecap,
  type RecapStat,
} from "@/share/festival-card";
import type { CardStyle } from "@/share/session-card";
import { C, F, R, ff, posColor } from "@/theme";

import { PlayingCard } from "./PlayingCard";
import { linkHost, Mark, MARK_ARROW, MARK_CLUB, MARK_PLAY, MARK_VIEWBOX, STORY_H, STORY_W } from "./StoryCard";

export type FestivalLook = Exclude<CardStyle, "sticker">;
export const FESTIVAL_LOOKS: FestivalLook[] = ["noite", "brasa"];

const INK = C.accentInk;
const SIDE = 26;
const DAY = 86_400_000;

/** "2–17 DEZ 2026", or "28 NOV – 3 DEZ 2026" across months. */
export function dateRange(from: number, to: number): string {
  const a = new Date(from);
  const b = new Date(to);
  const month = (d: Date) =>
    d.toLocaleDateString(locale, { month: "short" }).replace(".", "");
  const range =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
      ? `${a.getDate()}–${b.getDate()} ${month(b)}`
      : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
  return `${range} ${b.getFullYear()}`.toUpperCase();
}

/** One tick per day of the trip, lit where the player sat down. */
export function dayTicks(r: FestivalRecap): boolean[] {
  const out: boolean[] = [];
  const start = new Date(r.from);
  start.setHours(12, 0, 0, 0);
  for (let ms = start.getTime(); ms <= r.to && out.length < 31; ms += DAY) {
    out.push(r.played.has(dayKey(ms)));
  }
  return out;
}

export function Logo({ ink }: { ink: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      {ink ? (
        <Svg width={18} height={18} viewBox={MARK_VIEWBOX}>
          <Path d={MARK_ARROW} fill={INK} />
          <Path d={MARK_CLUB} fill={INK} />
          <Path d={MARK_PLAY} fill={C.accent} />
        </Svg>
      ) : (
        <Mark size={18} />
      )}
      <Text allowFontScaling={false}
        style={{
          fontFamily: ff(800),
          fontWeight: "800",
          fontSize: 14,
          color: ink ? INK : C.text,
          letterSpacing: -0.3,
        }}
      >
        Sweat<Text allowFontScaling={false} style={{ color: ink ? INK : C.accent }}>book</Text>
      </Text>
    </View>
  );
}

export interface FestivalCardProps {
  recap: FestivalRecap;
  stats: RecapStat[];
  look: FestivalLook;
  /** Off by default: the card shows buy-ins, never an amount, unless the player turns it on. */
  showMoney?: boolean;
  /** The result line (buy-ins or bb). A player can post the trip without it. */
  showResult?: boolean;
  showHand?: boolean;
  /** Sweatbook wordmark and "Feito com Sweatbook". Free cards always carry it. */
  brand?: boolean;
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}

export function FestivalCard({
  recap: r,
  stats,
  look,
  showMoney = false,
  showResult = true,
  showHand = true,
  brand = true,
  ref,
}: FestivalCardProps) {
  const ink = look === "brasa";
  const fg = ink ? INK : C.text;
  const dim = ink ? "rgba(26,10,4,0.62)" : C.textDim;
  const line = ink ? "rgba(26,10,4,0.16)" : C.border;
  const ticks = dayTicks(r);
  const up = (r.result?.value ?? r.money) > 0;
  const down = (r.result?.value ?? r.money) < 0;
  const tone = ink ? INK : up ? C.good : down ? C.bad : C.text;
  const lead =
    showResult && r.result
      ? resultParts(r.result)
      : showResult && showMoney
        ? { num: moneyLabel(r), unit: "" }
        : null;
  const h = showHand ? r.bestHand : null;
  const hero = h ? h.hand.players[h.hand.hero] : null;
  const heroPos = h
    ? positions(h.hand.players.length, h.hand.button)[h.hand.hero]
    : "";

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: STORY_W,
        height: STORY_H,
        overflow: "hidden",
        backgroundColor: ink ? C.accent : C.bgDeep,
      }}
    >
      {ink ? (
        <LinearGradient
          colors={["#FF7A4F", C.accent, "#E9542A"]}
          locations={[0, 0.5, 1]}
          style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
        />
      ) : (
        <>
          <LinearGradient
            colors={[C.bgDeep, C.bg, C.bg, C.bgDeep]}
            locations={[0, 0.3, 0.75, 1]}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <Svg
            width={STORY_W}
            height={STORY_H}
            style={{ position: "absolute", left: 0, top: 0 }}
          >
            <Defs>
              <RadialGradient id="ember" cx="50%" cy="34%" rx="80%" ry="36%">
                <Stop offset="0" stopColor={C.accent} stopOpacity="0.18" />
                <Stop offset="1" stopColor={C.accent} stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="felt" cx="50%" cy="78%" rx="70%" ry="26%">
                <Stop offset="0" stopColor="#1F5A47" stopOpacity="0.45" />
                <Stop offset="1" stopColor="#0C1311" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={STORY_W}
              height={STORY_H}
              fill="url(#ember)"
            />
            <Rect
              x="0"
              y="0"
              width={STORY_W}
              height={STORY_H}
              fill="url(#felt)"
            />
          </Svg>
        </>
      )}

      {/* Below Instagram's profile bar */}
      <View
        style={{
          position: "absolute",
          top: 70,
          left: SIDE,
          right: SIDE,
          height: 22,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {brand ? <Logo ink={ink} /> : <View />}
        <View
          style={{
            borderWidth: 1,
            borderColor: ink ? "rgba(26,10,4,0.3)" : C.accentLine,
            borderRadius: R.pill,
            paddingHorizontal: 10,
            height: 22,
            justifyContent: "center",
          }}
        >
          <Text allowFontScaling={false}
            style={{
              fontFamily: ff(800),
              fontSize: 10,
              letterSpacing: 1.2,
              color: ink ? INK : C.text,
            }}
          >
            {r.festival ? t("RESUMO DO FESTIVAL") : t('RESUMO DA VIAGEM')}
          </Text>
        </View>
      </View>

      {/* One column between Instagram's bars, so a long title or the money line pushes the rest down instead of overlapping it. */}
      <View
        style={{
          position: "absolute",
          top: 108,
          bottom: 130,
          left: SIDE,
          right: SIDE,
          gap: 16,
        }}
      >
        <View style={{ gap: 6 }}>
          <Text allowFontScaling={false}
            style={{
              fontFamily: ff(800),
              fontSize: 11,
              letterSpacing: 1.6,
              color: dim,
            }}
          >
            {dateRange(r.from, r.to)}
          </Text>
          <Text allowFontScaling={false}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{
              fontFamily: ff(800),
              fontWeight: "800",
              fontSize: 26,
              lineHeight: 30,
              color: fg,
              letterSpacing: -0.7,
            }}
          >
            {r.title}
          </Text>
          {/* The trip, day by day. */}
          <View style={{ flexDirection: "row", gap: 3, marginTop: 6 }}>
            {ticks.map((on, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  maxWidth: 14,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: on
                    ? ink
                      ? INK
                      : C.accent
                    : ink
                      ? "rgba(26,10,4,0.16)"
                      : "rgba(238,242,239,0.10)",
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: 14 }}>
          {lead ? (
            <View style={{ gap: 0 }}>
              <Text allowFontScaling={false}
                style={{
                  fontFamily: ff(800),
                  fontSize: 11,
                  letterSpacing: 1.6,
                  color: dim,
                }}
              >
                {t("RESULTADO")}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}
              >
                <Text allowFontScaling={false}
                  numberOfLines={1}
                  style={{
                    fontFamily: F.mono,
                    fontSize: lead.num.length > 7 ? 40 : 52,
                    lineHeight: 58,
                    color: tone,
                    letterSpacing: -2,
                  }}
                >
                  {lead.num}
                </Text>
                {lead.unit ? (
                  <Text allowFontScaling={false}
                    style={{
                      fontFamily: ff(800),
                      fontSize: 22,
                      color: tone,
                      letterSpacing: -0.4,
                    }}
                  >
                    {lead.unit}
                  </Text>
                ) : null}
              </View>
              {showMoney && r.result ? (
                <Text allowFontScaling={false}
                  numberOfLines={1}
                  style={{ fontFamily: F.mono, fontSize: 16, color: dim }}
                >
                  {t('{v} no póquer', { v: moneyLabel(r) })}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={{ height: 1, backgroundColor: line }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 10 }}>
            {stats.map((x) => (
              <View key={x.key} style={{ width: "50%", gap: 2 }}>
                <Text allowFontScaling={false}
                  style={{
                    fontFamily: ff(800),
                    fontSize: 10,
                    letterSpacing: 1.4,
                    color: dim,
                  }}
                >
                  {x.label.toUpperCase()}
                </Text>
                <FitText
                  style={{
                    fontFamily: x.key === "place" ? ff(800) : F.mono,
                    fontSize: 24,
                    lineHeight: 29,
                    color: x.tone === "good" && !ink ? C.good : fg,
                  }}
                >
                  {x.value}
                </FitText>
              </View>
            ))}
          </View>
        </View>

        {h && hero?.cards?.length === 2 ? (
          <View
            style={{
              marginTop: "auto",
              marginHorizontal: -4,
              height: 72,
              borderRadius: R.lg,
              borderWidth: 1,
              borderColor: ink ? "rgba(26,10,4,0.22)" : C.borderStrong,
              backgroundColor: ink
                ? "rgba(26,10,4,0.10)"
                : "rgba(18,26,23,0.86)",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 12,
            }}
          >
            <View style={{ flexDirection: "row", gap: 3 }}>
              <PlayingCard card={hero.cards[0]} size="sm" />
              <PlayingCard card={hero.cards[1]} size="sm" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text allowFontScaling={false}
                style={{
                  fontFamily: ff(800),
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: ink ? INK : C.accent,
                }}
              >
                {t("MELHOR MÃO")}
              </Text>
              <Text allowFontScaling={false}
                numberOfLines={1}
                style={{ fontFamily: ff(800), fontSize: 15, color: fg }}
              >
                {h.made ?? t("Pote ganho")}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text allowFontScaling={false}
                  style={{
                    fontFamily: ff(800),
                    fontSize: 11,
                    color: ink ? INK : posColor(heroPos),
                  }}
                >
                  {heroPos}
                </Text>
                <Text allowFontScaling={false}
                  numberOfLines={1}
                  style={{ fontFamily: F.mono, fontSize: 11, color: dim }}
                >
                  {`${chips(h.hand.game.sb)}/${chips(h.hand.game.bb)}`}
                </Text>
              </View>
            </View>
            <Text allowFontScaling={false}
              style={{
                fontFamily: F.mono,
                fontSize: 22,
                color: ink ? INK : C.good,
              }}
            >
              +{Math.round(h.bb)} bb
            </Text>
          </View>
        ) : null}
      </View>

      {/* Above Instagram's reply bar */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 74,
          alignItems: "center",
          gap: 2,
        }}
      >
        {h ? (
          <Text allowFontScaling={false} style={{ fontFamily: ff(700), fontSize: 12, color: dim }}>
            {t("Replay da mão")}{" "}
            <Text allowFontScaling={false} style={{ color: fg }}>
              {brand ? t("em {host}", { host: linkHost }) : t("no link")}
            </Text>
          </Text>
        ) : null}
        {brand ? (
          <Text allowFontScaling={false}
            style={{
              fontFamily: ff(700),
              fontSize: 11,
              color: dim,
              letterSpacing: 0.4,
            }}
          >
            {t("Feito com")}{" "}
            <Text allowFontScaling={false} style={{ fontFamily: ff(800), color: ink ? INK : C.accent }}>
              Sweatbook
            </Text>
            {h ? "" : ` · ${linkHost}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
