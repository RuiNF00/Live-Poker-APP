// A tournament's blind structure as published: level, blinds, ante and breaks,
// with each level's start at the venue while it can be worked out exactly
// (until registration closes), and the level registration closes at marked.

import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Divider, Row, T } from '@/components/ui';
import { locale, t } from '@/i18n';
import { venueTime, type Festival, type FestivalEvent, type Structure } from '@/poker/festivals';
import { closeLevel, levelStarts } from '@/store/festival-event';
import { venueHm } from '@/store/festival-plan';
import { C, S } from '@/theme';

/** Levels shown before "Ver todos". */
const FIRST = 12;

const n = (x: number) => x.toLocaleString(locale);

export function StructureTable({ f, e, s }: { f: Festival; e: FestivalEvent; s: Structure }) {
  const close = closeLevel(s, e);
  // Each level's start only when the sheet and the schedule agree on late reg: the breaks are then known that far.
  const starts = close && e.levelMinutes ? levelStarts(s, e.levelMinutes) : null;
  const t0 = venueTime(f, e.start);
  const [all, setAll] = useState(false);
  const pause = new Map(s.breaks);
  const shown = all ? s.levels.length : Math.max(FIRST, close ?? 0);
  return (
    <Card padded={false}>
      <Row style={{ paddingHorizontal: S.md, paddingVertical: S.sm }} gap={S.sm}>
        <T v="label" style={{ width: 44 }}>{t('Nível')}</T>
        <T v="label" style={{ flex: 1 }}>{t('Blinds')}</T>
        <T v="label" style={{ width: 72, textAlign: 'right' }}>{t('Ante')}</T>
        {starts ? <T v="label" style={{ width: 52, textAlign: 'right' }}>{t('Hora')}</T> : null}
      </Row>
      <Divider />
      {s.levels.slice(0, shown).map(([sb, bb, ante], i) => {
        const level = i + 1;
        const closes = level === close;
        const timed = starts && close && level <= close;
        return (
          <View key={level}>
            {closes ? (
              <View style={{ paddingHorizontal: S.md, paddingTop: S.sm }}>
                <T v="tiny" color={C.accent}>
                  {t('O late reg fecha ao começar este nível')}
                </T>
              </View>
            ) : null}
            <Row
              style={{ paddingHorizontal: S.md, paddingVertical: 8, backgroundColor: closes ? C.surface2 : undefined }}
              gap={S.sm}
              accessible
              accessibilityLabel={t('Nível {level}: blinds {sb}/{bb}, ante {ante}', { level, sb: n(sb), bb: n(bb), ante: ante ? n(ante) : '—' })}>
              <T v="mono" style={{ width: 44 }} color={closes ? C.accent : C.text}>
                {level}
              </T>
              <T v="mono" style={{ flex: 1 }} maxFontSizeMultiplier={1.4}>
                {`${n(sb)}/${n(bb)}`}
              </T>
              <T v="mono" style={{ width: 72, textAlign: 'right' }} color={ante ? C.text : C.muted} maxFontSizeMultiplier={1.4}>
                {ante ? n(ante) : '—'}
              </T>
              {starts ? (
                <T v="monoS" style={{ width: 52, textAlign: 'right' }} color={C.muted}>
                  {timed ? venueHm(f, t0 + starts[i] * 60_000) : ''}
                </T>
              ) : null}
            </Row>
            {pause.has(level) && level < shown ? (
              <View style={{ paddingHorizontal: S.md, paddingVertical: 6, backgroundColor: C.surface3 }}>
                <T v="tiny">{t('Pausa de {min} min', { min: pause.get(level)! })}</T>
              </View>
            ) : null}
          </View>
        );
      })}
      {shown < s.levels.length ? (
        <View style={{ padding: S.sm }}>
          <Button kind="plain" size="sm" title={t('Ver os {n} níveis', { n: s.levels.length })} onPress={() => setAll(true)} />
        </View>
      ) : null}
    </Card>
  );
}
