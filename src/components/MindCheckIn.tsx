// Mental game journal: a few taps before a session (sleep, energy, focus,
// mood) and after it (tilt, one line). Every field is optional and a second
// tap clears it. Private: Session.mind never leaves the phone in a share,
// link or statement.

import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { t } from '@/i18n';
import type { MindCheck, Scale } from '@/store/types';
import { C, R, S } from '@/theme';

import { Card, Chip, ChipRow, Field, Row, T, tap } from './ui';

const SLEEP = [4, 5, 6, 7, 8, 9];
export const MOODS = ['Calmo', 'Confiante', 'Ansioso', 'Irritado', 'Distraído'];

const sleepLabel = (h: number) => (h <= 4 ? '≤4 h' : h >= 9 ? '9+ h' : `${h} h`);

/** Before the session. */
export function MindBefore({ value, onChange }: { value?: MindCheck; onChange: (m: MindCheck | undefined) => void }) {
  const m = value ?? {};
  const set = (p: Partial<MindCheck>) => onChange(clean({ ...m, ...p }));
  return (
    <Card tone="inset" style={{ gap: S.md }}>
      <Head title={t('Como chegas?')} />
      <View style={{ gap: S.xs }}>
        <T v="label">{t('Dormiste')}</T>
        {/* Six short options: they share the width (and wrap at large text) instead of scrolling. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
          {SLEEP.map((h) => (
            <Chip key={h} label={sleepLabel(h)} active={m.sleep === h} onPress={() => set({ sleep: m.sleep === h ? undefined : h })} style={{ flexGrow: 1, minWidth: 48, paddingHorizontal: S.sm }} />
          ))}
        </View>
      </View>
      <ScaleRow label={t('Energia')} low={t('Vazio')} high={t('Cheio')} value={m.energy} onChange={(energy) => set({ energy })} />
      <ScaleRow label={t('Foco')} low={t('Disperso')} high={t('Afiado')} value={m.focus} onChange={(focus) => set({ focus })} />
      <View style={{ gap: S.xs }}>
        <T v="label">{t('Humor (opcional)')}</T>
        <ChipRow style={{ marginHorizontal: -S.lg }}>
          {MOODS.map((k) => (
            <Chip key={k} label={t(k)} active={m.mood === k} onPress={() => set({ mood: m.mood === k ? undefined : k })} />
          ))}
        </ChipRow>
      </View>
    </Card>
  );
}

/** After the session. */
export function MindAfter({ value, onChange }: { value?: MindCheck; onChange: (m: MindCheck | undefined) => void }) {
  const m = value ?? {};
  const set = (p: Partial<MindCheck>) => onChange(clean({ ...m, ...p }));
  return (
    <Card tone="inset" style={{ gap: S.md }}>
      <Head title={t('Como saíste?')} />
      <ScaleRow label="Tilt" low={t('Calmo')} high={t('Tilt total')} value={m.tilt} onChange={(tilt) => set({ tilt })} hot />
      <Field value={m.note ?? ''} onChangeText={(note) => set({ note: note.slice(0, 140) || undefined })} placeholder={t('Uma linha sobre a sessão (opcional)')} maxLength={140} returnKeyType="done" />
    </Card>
  );
}

function Head({ title }: { title: string }) {
  return (
    <Row>
      <Ionicons name="pulse-outline" size={18} color={C.accent} />
      <T v="h3" style={{ flex: 1 }}>
        {title}
      </T>
      <Ionicons name="lock-closed-outline" size={13} color={C.muted} />
      <T v="tiny">{t('Opcional · só tu vês')}</T>
    </Row>
  );
}

/** Five taps from `low` to `high`; tapping the chosen one clears it. `hot` reddens the top of the scale (tilt). */
export function ScaleRow({ label, low, high, value, onChange, hot }: { label: string; low: string; high: string; value?: Scale; onChange: (v: Scale | undefined) => void; hot?: boolean }) {
  return (
    <View style={{ gap: S.xs }}>
      <Row>
        <T v="label" style={{ flex: 1 }}>
          {label}
        </T>
        <T v="tiny">
          {low} → {high}
        </T>
      </Row>
      <Row gap={6}>
        {([1, 2, 3, 4, 5] as Scale[]).map((k) => {
          const on = value === k;
          const col = hot && k >= 4 ? C.bad : C.accent;
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label} ${k}`}
              hitSlop={4}
              onPress={() => {
                tap('select');
                onChange(on ? undefined : k);
              }}
              style={({ pressed }) => ({
                flex: 1,
                height: 40,
                borderRadius: R.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? col : C.surface3,
                borderWidth: 1,
                borderColor: on ? col : C.border,
                opacity: pressed ? 0.8 : 1,
              })}>
              <T v="h3" color={on ? C.accentInk : C.textDim}>
                {k}
              </T>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}

/** Drops empty fields; nothing left means no check-in at all. */
function clean(m: MindCheck): MindCheck | undefined {
  const out = Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined && v !== '')) as MindCheck;
  return Object.keys(out).length ? out : undefined;
}

/** Short summary for a list row: "7 h · energia 4 · foco 3 · tilt 2". */
export function mindLine(m: MindCheck): string {
  return [
    m.sleep !== undefined ? sleepLabel(m.sleep) : '',
    m.energy ? t('energia {n}', { n: m.energy }) : '',
    m.focus ? t('foco {n}', { n: m.focus }) : '',
    m.mood ? t(m.mood).toLowerCase() : '',
    m.tilt ? t('tilt {n}', { n: m.tilt }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
