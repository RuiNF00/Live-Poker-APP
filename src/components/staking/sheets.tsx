// Edit sheets for staking: a backer, a package of sessions, a payment.

import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, ChipRow, Field, NumField, Section, Segmented, SheetHeader, T, ToggleItem, ListGroup } from '@/components/ui';
import { lang, t } from '@/i18n';
import { money } from '@/poker/format';
import { uid } from '@/store/store';
import type { Backer, BackerPayment, StakePackage } from '@/store/types';
import { C, S } from '@/theme';

export const SHARES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
export const MARKUPS = [1, 1.05, 1.1, 1.15, 1.2, 1.3];
const CUTS = [30, 40, 50, 60, 70];

/** A decimal in the app's language: 1,20 in Portuguese, 1.20 in English. */
export const dec = (n: number, digits = 2) => (lang === 'pt' ? n.toFixed(digits).replace('.', ',') : n.toFixed(digits));
export const markupLabel = (m: number) => (m === 1 ? t('Sem markup') : dec(m));

/** A page sheet with the standard header, scrolling content and room for the keyboard. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: S.gutter, paddingTop: S.xl, gap: S.xl, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <SheetHeader title={title} onClose={onClose} closeLabel={t('Fechar')} />
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function blankBacker(name = ''): Backer {
  return { id: uid('b_'), name, note: '', createdAt: Date.now() };
}

export function BackerSheet({ backer, onSave, onDelete, onClose }: { backer: Backer | null; onSave: (b: Backer) => void; onDelete?: () => void; onClose: () => void }) {
  return (
    <Sheet visible={!!backer} title={backer?.name ? backer.name : t('Novo backer')} onClose={onClose}>
      {backer ? <BackerForm key={backer.id} backer={backer} onSave={onSave} onDelete={onDelete} /> : null}
    </Sheet>
  );
}

function BackerForm({ backer, onSave, onDelete }: { backer: Backer; onSave: (b: Backer) => void; onDelete?: () => void }) {
  const [x, setX] = useState(backer);
  return (
    <>
      <Field label={t('Nome')} value={x.name} onChangeText={(name) => setX({ ...x, name })} placeholder={t('Ex.: João, o meu irmão')} autoFocus={!backer.name} maxLength={40} />
      <Field
        label={t('Nota')}
        value={x.note}
        onChangeText={(note) => setX({ ...x, note })}
        placeholder={t('Contacto, IBAN, como combinaram…')}
        multiline
        maxLength={400}
      />
      <Button title={t('Guardar')} disabled={!x.name.trim()} onPress={() => onSave({ ...x, name: x.name.trim() })} />
      {onDelete ? <Button title={t('Apagar backer')} kind="danger" size="md" onPress={onDelete} /> : null}
    </>
  );
}

export function blankPackage(backerId: string): StakePackage {
  return { id: uid('k_'), backerId, name: '', kind: 'action', share: 20, markup: 1.1, playerCut: 50, createdAt: Date.now() };
}

export function packageTerms(p: Pick<StakePackage, 'kind' | 'share' | 'markup' | 'playerCut'>): string {
  return p.kind === 'makeup'
    ? t('{share}% com makeup · ficas com {cut}% do lucro', { share: p.share, cut: p.playerCut })
    : t('{share}% de cada torneio · {markup}', { share: p.share, markup: markupLabel(p.markup) });
}

export function PackageSheet({ pkg, onSave, onDelete, onClose }: { pkg: StakePackage | null; onSave: (p: StakePackage) => void; onDelete?: () => void; onClose: () => void }) {
  return (
    <Sheet visible={!!pkg} title={pkg?.name ? pkg.name : t('Novo pacote')} onClose={onClose}>
      {pkg ? <PackageForm key={pkg.id} pkg={pkg} onSave={onSave} onDelete={onDelete} /> : null}
    </Sheet>
  );
}

function PackageForm({ pkg, onSave, onDelete }: { pkg: StakePackage; onSave: (p: StakePackage) => void; onDelete?: () => void }) {
  const [x, setX] = useState(pkg);
  const set = (p: Partial<StakePackage>) => setX((v) => ({ ...v, ...p }));
  return (
    <>
      <Field label={t('Nome do pacote')} value={x.name} onChangeText={(name) => set({ name })} placeholder={t('Ex.: Série de outubro, festival de verão')} maxLength={60} />
      <Section title={t('Acordo')}>
        <Segmented
          options={[
            { key: 'action', label: t('Ação com markup') },
            { key: 'makeup', label: t('Com makeup') },
          ]}
          value={x.kind}
          onChange={(kind) => set({ kind, markup: kind === 'makeup' ? 1 : x.markup === 1 ? 1.1 : x.markup })}
        />
        <Card tone="inset" style={{ paddingVertical: S.md }}>
          <T v="small">
            {x.kind === 'makeup'
              ? t('O backer paga a parte dele dos buy-ins. As perdas acumulam (makeup) e só ganhas a tua parte do lucro quando o pacote estiver acima de zero.')
              : t('O backer compra a mesma percentagem de cada torneio do pacote, ao markup combinado. Cada torneio acerta-se sozinho.')}
          </T>
        </Card>
      </Section>
      <Section title={x.kind === 'makeup' ? t('Parte do backer nos buy-ins') : t('Ação vendida em cada torneio')}>
        <ChipRow>
          {SHARES.map((p) => (
            <Chip key={p} label={`${p}%`} active={x.share === p} onPress={() => set({ share: p })} />
          ))}
        </ChipRow>
      </Section>
      {x.kind === 'action' ? (
        <Section title="Markup">
          <ChipRow>
            {MARKUPS.map((m) => (
              <Chip key={m} label={markupLabel(m)} active={x.markup === m} onPress={() => set({ markup: m })} />
            ))}
          </ChipRow>
        </Section>
      ) : (
        <Section title={t('A tua parte do lucro')} hint={t('Depois de recuperado o makeup.')}>
          <ChipRow>
            {CUTS.map((c) => (
              <Chip key={c} label={`${c}%`} active={x.playerCut === c} onPress={() => set({ playerCut: c })} />
            ))}
          </ChipRow>
        </Section>
      )}
      {pkg.name ? (
        <ListGroup>
          <ToggleItem
            icon="lock-closed-outline"
            title={t('Pacote fechado')}
            subtitle={t('Já não entra em sessões novas. O saldo fica.')}
            value={!!x.closedAt}
            onChange={(v) => set({ closedAt: v ? Date.now() : undefined })}
          />
        </ListGroup>
      ) : null}
      <Button title={t('Guardar')} onPress={() => onSave({ ...x, name: x.name.trim() || t('Pacote de {share}%', { share: x.share }) })} />
      {onDelete ? <Button title={t('Apagar pacote')} kind="danger" size="md" onPress={onDelete} /> : null}
    </>
  );
}

/** Records money between you and a backer. Starts with the amount that settles the balance. */
export function PaymentSheet({
  backer,
  balance,
  currency,
  onSave,
  onClose,
}: {
  backer: Backer | null;
  balance: number;
  currency: string;
  onSave: (p: BackerPayment) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={!!backer} title={t('Registar pagamento')} onClose={onClose}>
      {backer ? <PaymentForm key={backer.id + balance} backer={backer} balance={balance} currency={currency} onSave={onSave} /> : null}
    </Sheet>
  );
}

function PaymentForm({ backer, balance, currency, onSave }: { backer: Backer; balance: number; currency: string; onSave: (p: BackerPayment) => void }) {
  const [dir, setDir] = useState<'out' | 'in'>(balance >= 0 ? 'out' : 'in');
  const [amount, setAmount] = useState(Math.round(Math.abs(balance)));
  const [note, setNote] = useState('');
  return (
    <>
      <Segmented
        options={[
          { key: 'out', label: t('Eu paguei') },
          { key: 'in', label: t('Recebi') },
        ]}
        value={dir}
        onChange={setDir}
      />
      <View style={{ flexDirection: 'row' }}>
        <NumField label={t('Valor ({currency})', { currency })} value={amount} onChange={setAmount} />
      </View>
      {balance ? (
        <T v="small">
          {balance > 0
            ? t('Deves {amount} a {name}.', { amount: money(balance, currency), name: backer.name })
            : t('{name} deve-te {amount}.', { amount: money(-balance, currency), name: backer.name })}
        </T>
      ) : null}
      <Field label={t('Nota')} value={note} onChangeText={setNote} placeholder={t('MB Way, dinheiro, transferência…')} maxLength={120} />
      <Button
        title={t('Guardar')}
        disabled={!amount}
        onPress={() => {
          const now = Date.now();
          onSave({ id: uid('y_'), backerId: backer.id, amount: dir === 'out' ? amount : -amount, at: now, note: note.trim(), createdAt: now });
        }}
      />
    </>
  );
}
