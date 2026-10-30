// Typed exchange rates for currencies the ECB doesn't publish. Its own file so staking uses it
// without the home-currency card (and the bankroll sheets) in the launch bundle.

import React, { useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { isoOf, symbolOf } from '@/store/currencies';
import { S } from '@/theme';

import { Button, Field, T } from './ui';

/** One field per currency: how many of it make 1 €, as the player saw at the cage or the exchange. */
export function ManualRatesForm({ codes, initial, onSave }: { codes: string[]; initial: Record<string, number>; onSave: (r: Record<string, number>) => void }) {
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(codes.map((c) => [c, initial[isoOf(c) ?? c] ? String(initial[isoOf(c) ?? c]).replace('.', ',') : ''])));
  const parse = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.'));
  return (
    <View style={{ gap: S.md }}>
      <T v="small">{t('Estas moedas não têm câmbio diário do BCE. Usamos o teu para todas as datas; muda-o quando quiseres.')}</T>
      {codes.map((c) => (
        <Field
          key={c}
          label={t('1 € = quantos {code}?', { code: symbolOf(c) === c ? c : `${c} (${symbolOf(c)})` })}
          value={text[c] ?? ''}
          onChangeText={(v) => setText((x) => ({ ...x, [c]: v.slice(0, 12) }))}
          keyboardType="decimal-pad"
          placeholder="0"
        />
      ))}
      <Button
        title={t('Guardar câmbio')}
        icon="checkmark"
        onPress={() => {
          const out = { ...initial };
          for (const c of codes) {
            const iso = isoOf(c) ?? c;
            const n = parse(text[c] ?? '');
            if (n > 0 && Number.isFinite(n)) out[iso] = n;
            else delete out[iso];
          }
          onSave(out);
        }}
      />
    </View>
  );
}
