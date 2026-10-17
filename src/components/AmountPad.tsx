// Numeric keypad for custom amounts. In-app (not the OS keyboard) so it never
// covers the table and supports "k" for thousands and bb input.

import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { t } from '@/i18n';
import { chips } from '@/poker/format';
import { C, F, R, S } from '@/theme';

import { Button, Row, Segmented, T, tap } from './ui';

export function AmountPad({
  visible,
  title,
  bb,
  initialInBB,
  min,
  max,
  onClose,
  onDone,
}: {
  visible: boolean;
  title: string;
  bb: number;
  initialInBB?: boolean;
  min?: number;
  max?: number;
  onClose: () => void;
  onDone: (chips: number) => void;
}) {
  const [txt, setTxt] = useState('');
  const [inBB, setInBB] = useState(!!initialInBB);
  const raw = parseFloat(txt.replace(',', '.').replace(/k$/i, '')) || 0;
  const mult = /k$/i.test(txt) ? 1000 : 1;
  const value = Math.round(inBB ? raw * bb : raw * mult);
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: C.overlay }} onPress={onClose} accessibilityLabel={t('Fechar')} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderTopWidth: 1, borderColor: C.borderStrong, padding: S.gutter, paddingBottom: 34, gap: S.md }}>
        <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.borderStrong, marginTop: -4 }} />
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h2">{title}</T>
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
        </Row>
        <View style={{ backgroundColor: C.bgDeep, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ color: C.text, fontSize: 38, fontFamily: F.mono, fontVariant: ['tabular-nums'], letterSpacing: -1 }}>
            {txt || '0'}
            <Text style={{ color: C.muted, fontSize: 18 }}>{inBB ? ' bb' : ''}</Text>
          </Text>
          <T v="monoS" color={tooLow ? C.danger : C.muted}>
            = {chips(capped)} {t('fichas')}
            {max !== undefined && value >= max ? ' (all-in)' : ''}
            {tooLow ? ' · ' + t('mínimo {amount}', { amount: chips(min!) }) : ''}
          </T>
        </View>
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
              })}>
              <Text style={{ color: k === 'k' || k === ',' || k === '⌫' ? C.textDim : C.text, fontSize: 24, fontFamily: F.mono }}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          title={t('Confirmar')}
          disabled={value <= 0}
          onPress={() => {
            onDone(capped);
            setTxt('');
          }}
        />
      </View>
    </Modal>
  );
}
