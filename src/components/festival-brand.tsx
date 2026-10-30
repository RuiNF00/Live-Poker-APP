// The festival card's small parts (dates, day ticks, logo), apart from FestivalCard.tsx so the
// carousel, the plan card and the share sheet don't bring the whole card into the launch bundle.

import React from "react";
import { Text, View } from "react-native";
import { Path, Svg } from "@/components/svg";

import { locale } from "@/i18n";
import { dayKey, type FestivalRecap } from "@/share/festival-card";
import { DARK as C, ff } from "@/theme";

import { Mark, MARK_ARROW, MARK_CLUB, MARK_PLAY, MARK_VIEWBOX } from "./story-brand";

const INK = C.accentInk;
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
