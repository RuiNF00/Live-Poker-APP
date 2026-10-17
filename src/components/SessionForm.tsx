import React, { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { CASH_LEVELS, MTT_LEVELS } from '@/poker/factory';
import { chips } from '@/poker/format';
import type { GameKind } from '@/poker/types';
import { uid } from '@/store/store';
import type { Session } from '@/store/types';
import { C } from '@/theme';

import { inputStyle, NumField } from './entry/ContextSheet';
import { Button, Chip, Row, T } from './ui';

export function blankSession(kind: GameKind, currency: string): Session {
  const mtt = kind === 'mtt';
  return {
    id: uid('s_'),
    kind,
    name: '',
    venue: '',
    currency,
    startedAt: Date.now(),
    breaks: [],
    buyIn: mtt ? 100 : 200,
    entries: 1,
    addOn: 0,
    cashOut: 0,
    sb: mtt ? 100 : 1,
    bb: mtt ? 200 : 2,
    ante: mtt ? 200 : 0,
    anteType: mtt ? 'bb' : 'none',
    level: mtt ? 1 : undefined,
    stage: mtt ? 'early' : undefined,
    tableSize: 9,
    stack: mtt ? 30000 : 200,
    stackLog: [],
    roster: [],
    notes: '',
  };
}

/** Start a live session, or log a past one (`past`). */
export function SessionForm({
  initial,
  past,
  recentNames,
  recentVenues,
  onSubmit,
  submitLabel,
}: {
  initial: Session;
  past?: boolean;
  recentNames: string[];
  recentVenues: string[];
  onSubmit: (s: Session) => void;
  submitLabel: string;
}) {
  const [s, setS] = useState<Session>(initial);
  const [hours, setHours] = useState(4);
  const set = (p: Partial<Session>) => setS((x) => ({ ...x, ...p }));
  const mtt = s.kind === 'mtt';
  const levels = mtt ? MTT_LEVELS : CASH_LEVELS;
  return (
    <View style={{ gap: 14 }}>
      <Row>
        <Chip big label="Torneio" active={mtt} onPress={() => setS({ ...blankSession('mtt', s.currency), id: s.id, name: s.name, venue: s.venue })} />
        <Chip big label="Cash game" active={!mtt} onPress={() => setS({ ...blankSession('cash', s.currency), id: s.id, name: s.name, venue: s.venue })} />
      </Row>
      <View style={{ gap: 6 }}>
        <T v="label">{mtt ? 'Torneio' : 'Jogo'}</T>
        <TextInput value={s.name} onChangeText={(name) => set({ name })} placeholder={mtt ? 'Ex.: Main Event €550' : 'Ex.: NLH 1/2'} placeholderTextColor={C.muted} style={inputStyle} />
        {recentNames.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {recentNames.map((n) => (
              <Chip key={n} label={n} active={s.name === n} onPress={() => set({ name: n })} />
            ))}
          </ScrollView>
        )}
      </View>
      <View style={{ gap: 6 }}>
        <T v="label">Casino / sala</T>
        <TextInput value={s.venue} onChangeText={(venue) => set({ venue })} placeholder="Ex.: Casino Estoril" placeholderTextColor={C.muted} style={inputStyle} />
        {recentVenues.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {recentVenues.map((n) => (
              <Chip key={n} label={n} active={s.venue === n} onPress={() => set({ venue: n })} />
            ))}
          </ScrollView>
        )}
      </View>
      <Row gap={10}>
        <NumField label={mtt ? `Buy-in (${s.currency})` : `Buy-in (${s.currency})`} value={s.buyIn} onChange={(buyIn) => set({ buyIn, stack: mtt ? s.stack : buyIn })} />
        {mtt ? <NumField label="Stack inicial" value={s.stack} onChange={(stack) => set({ stack })} /> : null}
      </Row>
      {!past && (
        <View style={{ gap: 6 }}>
          <T v="label">Blinds</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {levels.map(([sb, bb]) => (
              <Chip key={bb} label={`${chips(sb)}/${chips(bb)}`} active={s.bb === bb && s.sb === sb} onPress={() => set({ sb, bb, ante: mtt ? bb : 0 })} />
            ))}
          </ScrollView>
        </View>
      )}
      {past && (
        <>
          <Row gap={10}>
            <NumField label={mtt ? 'Entradas' : 'Buy-ins'} value={s.entries} onChange={(entries) => set({ entries: Math.max(1, entries) })} />
            <NumField label={mtt ? `Prémio (${s.currency})` : `Cash-out (${s.currency})`} value={s.cashOut} onChange={(cashOut) => set({ cashOut })} />
          </Row>
          <View style={{ gap: 6 }}>
            <T v="label">Duração</T>
            <Row style={{ flexWrap: 'wrap' }} gap={6}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((h) => (
                <Chip key={h} label={`${h}h`} active={hours === h} onPress={() => setHours(h)} />
              ))}
            </Row>
          </View>
        </>
      )}
      <Button
        title={submitLabel}
        onPress={() => {
          if (past) {
            const end = Date.now();
            onSubmit({ ...s, startedAt: end - hours * 3600000, endedAt: end, stackLog: [] });
          } else onSubmit({ ...s, startedAt: Date.now(), stackLog: [{ t: Date.now(), stack: s.stack, level: s.level }] });
        }}
      />
    </View>
  );
}
