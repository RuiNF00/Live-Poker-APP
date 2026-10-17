// Numeric keypad for custom amounts. In-app (not the OS keyboard) so it never
// covers the table and supports "k" for thousands and bb input.

import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { t } from '@/i18n';
import { bbs, chips } from '@/poker/format';
import { C, F, R, S } from '@/theme';

import { Button, Row, Segmented, T, tap, useSheetPad } from './ui';
import { useSheetAnimation } from '@/lib/motion';

export function AmountPad({
  visible,
  title,
  bb,
  initialInBB,
  plain,
  min,
  max,
  initial,
  quick,
  onClose,
  onDone,
  onAllIn,
}: {
  visible: boolean;
  title: string;
  bb: number;
  initialInBB?: boolean;
  /** A count or a plain number (players, entries): no BB toggle or conversion. */
  plain?: boolean;
  min?: number;
  max?: number;
  /** Shown until the player types, and what Confirmar keeps if they don't (the live stack). */
  initial?: number;
  /** One-tap amounts above the keys (the stack after an orbit, ±10%…). */
  quick?: { label: string; value: number }[];
  onClose: () => void;
  onDone: (chips: number) => void;
  /** "All-in": what was typed is everything this player had (the stack follows), whatever the minimum. */
  onAllIn?: (chips: number) => void;
}) {
  const sheetAnim = useSheetAnimation();
  const [txt, setTxt] = useState('');
  const [inBB, setInBB] = useState(!!initialInBB);
  const raw = parseFloat(txt.replace(',', '.').replace(/k$/i, '')) || 0;
  const mult = /k$/i.test(txt) ? 1000 : 1;
  const typed = Math.round(inBB ? raw * bb : raw * mult);
  const value = txt === '' && initial !== undefined ? initial : typed;
  const press = (k: string) => {
    tap('select');
    if (k === '⌫') setTxt((t) => t.slice(0, -1));
    else if (k === 'k') setTxt((t) => (t && !/k$/i.test(t) ? t + 'k' : t));
    else if (k === ',') setTxt((t) => (t.includes(',') ? t : (t || '0') + ','));
    else setTxt((t) => (/k$/i.test(t) ? t : t + k));
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', inBB ? ',' : 'k', '0', '⌫'];
  const tooLow = min !== undefined && value < min;
  const capped = max !== undefined ? Math.min(value, max) : value;
  const sheetPad = useSheetPad(34);
  return (
    <Modal visible={visible} transparent animationType={sheetAnim} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={onClose} accessibilityLabel={t('Fechar')} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderTopWidth: 1, borderColor: C.borderStrong, padding: S.gutter, paddingBottom: sheetPad, gap: S.md }}>
        <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.borderStrong, marginTop: -4 }} />
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h2">{title}</T>
          {plain ? null : (
            <Segmented
              size="sm"
              style={{ width: 132 }}
              options={[
                { key: 'chips', label: t('Fichas') },
                { key: 'bb', label: 'BB' },
              ]}
              value={inBB ? 'bb' : 'chips'}
              onChange={(k) => setInBB(k === 'bb')}
            />
          )}
        </Row>
        <View style={{ backgroundColor: C.bgDeep, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ color: txt === '' && initial !== undefined ? C.textDim : C.text, fontSize: 38, fontFamily: F.mono, fontVariant: ['tabular-nums'], letterSpacing: -1 }}>
            {txt || (initial !== undefined ? (inBB ? String(Math.round((initial / bb) * 10) / 10).replace('.', ',') : chips(initial)) : '0')}
            <Text style={{ color: C.muted, fontSize: 18 }}>{inBB ? ' bb' : ''}</Text>
          </Text>
          {plain ? null : (
            <T v="monoS" color={tooLow ? C.danger : C.muted}>
              = {inBB ? chips(capped) + ' ' + t('fichas') : bbs(capped, bb)}
              {max !== undefined && value >= max ? ' (all-in)' : ''}
              {tooLow ? ' · ' + t('mínimo {amount}', { amount: chips(min!) }) : ''}
            </T>
          )}
        </View>
        {quick?.length ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {quick.map((q) => (
              <Pressable
                key={q.label}
                accessibilityRole="button"
                accessibilityLabel={`${q.label}: ${chips(q.value)}`}
                onPress={() => {
                  tap('select');
                  setInBB(false);
                  setTxt(q.value % 1000 === 0 ? `${q.value / 1000}k` : String(q.value));
                }}
                style={({ pressed }) => ({ flex: 1, minHeight: 40, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.surface3 : C.accentSoft, borderWidth: 1, borderColor: C.accentLine })}
              >
                <Text numberOfLines={1} style={{ color: C.accent, fontSize: 14, fontFamily: F.mono }}>
                  {q.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {keys.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityLabel={k === '⌫' ? t('Apagar') : k}
              onPress={() => press(k)}
              style={({ pressed }) => ({
                width: '31.8%',
                height: 52,
                borderRadius: R.md,
                backgroundColor: pressed ? C.surface3 : C.surface2,
                borderWidth: 1,
                borderColor: C.border,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ color: k === 'k' || k === ',' || k === '⌫' ? C.textDim : C.text, fontSize: 24, fontFamily: F.mono }}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Row gap={10}>
          {onAllIn ? (
            <Button
              title="All-in"
              kind="secondary"
              style={{ flex: 1 }}
              disabled={value <= 0}
              onPress={() => {
                onAllIn(value);
                setTxt('');
              }}
            />
          ) : null}
          <Button
            title={t('Confirmar')}
            style={{ flex: 1 }}
            disabled={value <= 0 || tooLow}
            onPress={() => {
              onDone(capped);
              setTxt('');
            }}
          />
        </Row>
      </View>
    </Modal>
  );
}
