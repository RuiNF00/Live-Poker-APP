// "Ler o recibo do prémio" in a swap's prize sheet: a photo of the payout slip fills the prize,
// the place and the event. The photo is read on the phone and deleted straight after; only the
// numbers go into the swap.

import React, { useState } from 'react';
import { Platform } from 'react-native';

import { Button, tap } from '@/components/ui';
import { t } from '@/i18n';
import { parsePrizeReceipt, type PrizeGuess } from '@/import/prize-receipt';
import { docUri, dropDoc, pickDoc } from '@/lib/docs';
import { notice } from '@/lib/notice';
import { canReadReceipts, readReceiptText } from '@/lib/receipt-ocr';
import { uid } from '@/store/store';

export function ReadPrizeButton({ currency, onRead }: { currency: string; onRead: (g: PrizeGuess) => void }) {
  const [busy, setBusy] = useState(false);
  if (Platform.OS === 'web') return null;
  if (!canReadReceipts)
    return <Button lines={2} size="md" kind="ghost" icon="camera-outline" title={t('Ler o recibo do prémio')} sub={t('Disponível na versão da loja')} disabled onPress={() => {}} />;

  async function read() {
    const got = await pickDoc('camera', uid('p_')).catch(() => null);
    if (!got) return;
    setBusy(true);
    try {
      const lines = await readReceiptText(docUri(got.file));
      const g = lines ? parsePrizeReceipt(lines) : {};
      if (g.amount === undefined) notice(t('Não conseguimos ler o recibo'), t('Escreve o prémio à mão.'));
      else if (g.currency && g.currency !== currency) notice(t('O recibo está em {a}', { a: g.currency }), t('Este swap é em {b}. Escreve o prémio à mão.', { b: currency }));
      else {
        tap('success');
        onRead(g);
      }
    } finally {
      dropDoc(got.file);
      setBusy(false);
    }
  }

  return <Button lines={2} size="md" kind="ghost" icon="camera-outline" title={busy ? t('A ler o recibo…') : t('Ler o recibo do prémio')} disabled={busy} onPress={read} />;
}
