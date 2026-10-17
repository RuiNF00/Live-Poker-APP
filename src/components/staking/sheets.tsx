// Edit sheets for staking: a backer, a package of sessions, a payment.

import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, ChipRow, Field, NumField, Section, Segmented, SheetHeader, T, ToggleItem, ListGroup } from '@/components/ui';
import { decimalComma, t } from '@/i18n';
import { useSheetAnimation } from '@/lib/motion';
import { money } from '@/poker/format';
import { uid } from '@/store/store';
import type { Backer, BackerPayment, StakePackage } from '@/store/types';
import { C, S } from '@/theme';

export const SHARES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
export const MARKUPS = [1, 1.05, 1.1, 1.15, 1.2, 1.3];
const CUTS = [30, 40, 50, 60, 70];

/** A decimal in the app's language: 1,20 in Portuguese, 1.20 in English. */
export const dec = (n: number, digits = 2) => (decimalComma ? n.toFixed(digits).replace('.', ',') : n.toFixed(digits));
export const markupLabel = (m: number) => (m === 1 ? t('Sem markup') : dec(m));

/** A page sheet with the standard header, scrolling content and room for the keyboard. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  // Fades instead of sliding when the player asked for Reduce Motion.
  const animation = useSheetAnimation();
  return (
    <Modal visible={visible} animationType={animation} presentationStyle="pageSheet" onRequestClose={onClose}>
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

/** `terms`: where to start from, usually the backer's last deal (see packageDefaults). */
export function blankPackage(backerId: string, terms?: Pick<StakePackage, 'kind' | 'share' | 'markup' | 'playerCut'>): StakePackage {
  return { id: uid('k_'), backerId, name: '', kind: 'action', share: 20, markup: 1.1, playerCut: 50, ...terms, createdAt: Date.now() };
}

export function packageTerms(p: Pick<StakePackage, 'kind' | 'share' | 'markup' | 'playerCut'>): string {
  return p.kind === 'makeup'
    ? t('{share}% com makeup · ficas com {cut}% do lucro', { share: p.share, cut: p.playerCut })
    : t('{share}% de cada torneio · {markup}', { share: p.share, markup: markupLabel(p.markup) });
}

/**
 * `makeup`: what is still to win back in this package (shown when closing it).
 * `onSave(p, carry)`: carry is true when the player chose to take that makeup to a new package.
 */
export function PackageSheet({
  pkg,
  suggestName,
  makeup,
  onSave,
  onDelete,
  onClose,
}: {
  pkg: StakePackage | null;
  /** Name a new package starts with (the trip the player is on), editable. */
  suggestName?: string;
  makeup?: string | null;
  onSave: (p: StakePackage, carry: boolean) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={!!pkg} title={pkg?.name ? pkg.name : t('Novo pacote')} onClose={onClose}>
      {pkg ? <PackageForm key={pkg.id} pkg={pkg} suggestName={suggestName} makeup={makeup ?? null} onSave={onSave} onDelete={onDelete} /> : null}
    </Sheet>
  );
}

function PackageForm({ pkg, suggestName, makeup, onSave, onDelete }: { pkg: StakePackage; suggestName?: string; makeup: string | null; onSave: (p: StakePackage, carry: boolean) => void; onDelete?: () => void }) {
  const [x, setX] = useState(() => (pkg.name || !suggestName ? pkg : { ...pkg, name: suggestName }));
  const set = (p: Partial<StakePackage>) => setX((v) => ({ ...v, ...p }));
  // Closing it now with makeup still to win back: forgive it, or carry it to a new package (the usual deal).
  const closing = !!makeup && x.kind === 'makeup' && !!x.closedAt && !pkg.closedAt;
  const [carry, setCarry] = useState(true);
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
              ? t('O backer paga a sua parte dos buy-ins. As perdas acumulam (makeup) e só ganhas a tua parte do lucro quando o pacote estiver acima de zero.')
              : t('O backer fica com a mesma percentagem de cada torneio do pacote, ao markup combinado. Cada torneio acerta-se sozinho.')}
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
      {closing ? (
        <Card tone="inset" style={{ gap: S.sm }}>
          <T v="h3">{t('Ainda há {amount} de makeup', { amount: makeup! })}</T>
          <T v="small">{t('Combina com o backer o que acontece ao makeup quando o pacote fecha.')}</T>
          <ChipRow>
            <Chip label={t('Passa para um pacote novo')} active={carry} onPress={() => setCarry(true)} />
            <Chip label={t('Fica perdoado')} active={!carry} onPress={() => setCarry(false)} />
          </ChipRow>
          <T v="small">
            {carry
              ? t('Abre um pacote novo com as mesmas condições, que começa com este makeup por recuperar.')
              : t('O makeup acaba com o pacote: o próximo começa do zero.')}
          </T>
        </Card>
      ) : null}
      <Button title={t('Guardar')} onPress={() => onSave({ ...x, name: x.name.trim() || t('Pacote de {share}%', { share: x.share }) }, closing && carry)} />
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
