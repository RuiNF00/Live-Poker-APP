// Numeric keypad for custom amounts. In-app (not the OS keyboard) so it never
// covers the table and supports "k" for thousands and bb input.

import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { chips } from '@/poker/format';
import { C, R } from '@/theme';

import { Button, Chip, Row, T, tap } from './ui';

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
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: 16, paddingBottom: 34, gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h2">{title}</T>
          <Row>
            <Chip label="Fichas" active={!inBB} onPress={() => setInBB(false)} />
            <Chip label="BB" active={inBB} onPress={() => setInBB(true)} />
          </Row>
        </Row>
        <View style={{ backgroundColor: C.bg, borderRadius: R.md, padding: 14, alignItems: 'flex-end' }}>
          <Text style={{ color: C.text, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
            {txt || '0'}
            <Text style={{ color: C.muted, fontSize: 18 }}>{inBB ? ' bb' : ''}</Text>
          </Text>
          <T v="small">
            = {chips(capped)} fichas{max !== undefined && value >= max ? ' (all-in)' : ''}
            {tooLow ? ` · mínimo ${chips(min!)}` : ''}
          </T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {keys.map((k) => (
            <Pressable
              key={k}
              onPress={() => press(k)}
              style={({ pressed }) => ({
                width: '31.5%',
                paddingVertical: 14,
                borderRadius: R.md,
                backgroundColor: pressed ? C.surface3 : C.surface2,
                alignItems: 'center',
              })}>
              <Text style={{ color: C.text, fontSize: 22, fontWeight: '700' }}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          title="Confirmar"
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
