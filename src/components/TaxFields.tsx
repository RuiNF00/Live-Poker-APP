// Taxes for a session: the country it was played in, tax the cashier kept
// back from the prize (W-2G, 1042-S) and whether it comes back, and photos of
// receipts and forms. Hidden behind one button so the common case stays short.

import React, { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { t } from '@/i18n';
import { docExists, dropDoc, openDoc, pickDoc, type DocSource } from '@/lib/docs';
import { useStore, uid } from '@/store/store';
import type { Session, SessionDoc, Withholding } from '@/store/types';
import { countryName, countryOrder, flag } from '@/tax/countries';
import { C, S } from '@/theme';

import { Button, Card, Chip, ChipRow, IconButton, ListGroup, ListItem, NumField, Row, Section, Segmented, T } from './ui';

const FORMS: [NonNullable<Withholding['form']>, string][] = [
  ['W-2G', 'W-2G'],
  ['1042-S', '1042-S'],
  ['other', 'Outro'],
];

export function TaxFields({ s, onChange }: { s: Session; onChange: (p: Partial<Session>) => void }) {
  const { sessions } = useStore();
  const has = !!s.withheld?.amount || !!s.docs?.length;
  const [open, setOpen] = useState(has);
  const [busy, setBusy] = useState(false);
  const order = useMemo(() => countryOrder(sessions), [sessions]);
  const w = s.withheld;
  const docs = s.docs ?? [];

  const setWithheld = (p: Partial<Withholding>) => {
    const next: Withholding = { amount: 0, status: 'recover', ...w, ...p };
    onChange({ withheld: next.amount > 0 ? next : undefined });
  };
  const add = async (source: DocSource) => {
    setBusy(true);
    try {
      const id = uid('d_');
      const got = await pickDoc(source, id);
      if (!got) return;
      const doc: SessionDoc = { id, name: got.name, file: got.file, kind: source === 'files' ? 'form' : 'receipt', addedAt: Date.now() };
      onChange({ docs: [...docs, doc] });
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <Button kind="ghost" size="sm" icon="add" style={{ alignSelf: 'flex-start' }} title={s.country ? `${t('Impostos e recibos')} · ${flag(s.country)} ${countryName(s.country)}` : t('Impostos e recibos')} onPress={() => setOpen(true)} />;
  return (
    <View style={{ gap: S.lg }}>
      <Section title={t('País')} hint={t('Fica guardado para esta sala: da próxima vez já vem preenchido.')}>
        <ChipRow>
          {order.map((k) => (
            <Chip key={k} label={`${flag(k)} ${countryName(k)}`} active={s.country === k} onPress={() => onChange({ country: s.country === k ? '' : k })} />
          ))}
        </ChipRow>
      </Section>

      <Section title={t('Retido na fonte')} hint={w?.form === '1042-S' ? t('Não residentes nos EUA: 30% se o teu país não tem tratado. Pode pedir-se de volta até 3 anos depois.') : undefined}>
        <Card style={{ gap: S.lg }}>
          <Row gap={S.sm}>
            <NumField label={t('Imposto retido ({currency})', { currency: s.currency })} value={w?.amount ?? 0} onChange={(amount) => setWithheld({ amount })} />
          </Row>
          {w?.amount ? (
            <>
              <ChipRow style={{ marginHorizontal: -S.lg }}>
                {FORMS.map(([k, l]) => (
                  <Chip key={k} label={t(l)} active={w.form === k} onPress={() => setWithheld({ form: w.form === k ? undefined : k })} />
                ))}
              </ChipRow>
              <Segmented
                size="sm"
                options={[
                  { key: 'recover', label: t('A recuperar') },
                  { key: 'recovered', label: t('Recuperado') },
                  { key: 'final', label: t('Fica pago') },
                ]}
                value={w.status}
                onChange={(status) => setWithheld({ status })}
              />
            </>
          ) : null}
        </Card>
      </Section>

      <Section title={t('Recibos e formulários')}>
        {docs.length > 0 && (
          <ListGroup>
            {docs.map((d) => {
              const here = docExists(d.file);
              return (
                <ListItem
                  key={d.id}
                  icon={d.kind === 'form' ? 'document-text-outline' : 'receipt-outline'}
                  iconColor={C.info}
                  title={d.name}
                  subtitle={here ? (d.kind === 'form' ? t('Formulário') : t('Recibo')) : t('Ficou no outro telemóvel')}
                  chevron={false}
                  onPress={here ? () => openDoc(d.file, d.name) : undefined}
                  right={
                    <IconButton
                      name="close"
                      size={30}
                      label={t('Tirar')}
                      onPress={() => {
                        dropDoc(d.file);
                        onChange({ docs: docs.filter((x) => x.id !== d.id) });
                      }}
                    />
                  }
                />
              );
            })}
          </ListGroup>
        )}
        <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
          {Platform.OS !== 'web' && <Button kind="outline" size="sm" icon="camera-outline" title={t('Tirar foto')} disabled={busy} onPress={() => add('camera')} />}
          {Platform.OS !== 'web' && <Button kind="outline" size="sm" icon="images-outline" title={t('Galeria')} disabled={busy} onPress={() => add('photos')} />}
          <Button kind="outline" size="sm" icon="document-attach-outline" title={t('Ficheiro')} disabled={busy} onPress={() => add('files')} />
        </Row>
        {docs.length === 0 ? <T v="tiny" style={{ paddingHorizontal: 4 }}>{t('Recibos de buy-in e cash-out, W-2G, 1042-S. Ficam no telemóvel, não vão para a nuvem.')}</T> : null}
      </Section>
    </View>
  );
}
