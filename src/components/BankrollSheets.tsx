// Sheets on the Bankroll tab: a deposit or withdrawal, a bankroll (new or
// edit), and the date and stake filters.

import React, { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { locale, t } from '@/i18n';
import type { Keep } from '@/store/moveup-math';
import { endOfDay, presetRange, startOfDay, type DateRange, type RangePreset, type StakeOption } from '@/store/bankroll-math';
import { CURRENCIES } from '@/store/currencies';
import { parseDay } from '@/store/session-math';
import { uid } from '@/store/store';
import type { Bankroll, Transfer } from '@/store/types';
import { C, S } from '@/theme';

import { Button, Chip, ChipRow, Field, NumField, Row, Section, Segmented, SheetHeader, T } from './ui';
import { useSheetAnimation } from '@/lib/motion';

export { CURRENCIES };

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const sheetAnim = useSheetAnimation();
  return (
    <Modal visible={visible} animationType={sheetAnim} onRequestClose={onClose} presentationStyle="pageSheet">
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: S.gutter, gap: S.lg, paddingTop: S.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <SheetHeader title={title} onClose={onClose} closeLabel={t('Fechar')} />
        {visible ? children : null}
      </ScrollView>
    </Modal>
  );
}

const DAY = 86400000;

function shortDay(ts: number): string {
  return new Date(ts).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
}

export function fullDay(ts: number): string {
  return new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Today, yesterday, the last week as chips, or any date typed. */
export function DayPicker({ value, onChange }: { value: number; onChange: (day: number) => void }) {
  const [text, setText] = useState('');
  const today = startOfDay(Date.now());
  return (
    <View style={{ gap: S.sm }}>
      <ChipRow>
        {[0, 1, 2, 3, 4, 5, 6].map((k) => {
          const d = today - k * DAY;
          return (
            <Chip
              key={k}
              label={k === 0 ? t('Hoje') : k === 1 ? t('Ontem') : shortDay(d)}
              active={startOfDay(value) === startOfDay(d)}
              onPress={() => {
                setText('');
                onChange(d);
              }}
            />
          );
        })}
      </ChipRow>
      <Field
        value={text}
        onChangeText={(v) => {
          setText(v);
          const d = parseDay(v);
          if (d !== null) onChange(d);
        }}
        placeholder={t('Outra data: dd/mm/aaaa')}
        keyboardType="numbers-and-punctuation"
      />
      {startOfDay(value) < today - 6 * DAY ? <T v="tiny">{fullDay(value)}</T> : null}
    </View>
  );
}

/** "2/5", or "torneios de 250 €": the game a bankroll rule is about. */
export function keepStake(k: Keep, fmt: (n: number) => string): string {
  return k.basis.kind === 'cash' ? `${k.basis.stake.sb}/${k.basis.stake.bb}` : t('torneios de {amount}', { amount: fmt(k.basis.buyIn) });
}

/** Under a new withdrawal: how much can come out and still keep the player's own rules. */
function KeepHint({ k, amount, fmt, onFill }: { k: Keep; amount: number; fmt: (n: number) => string; onFill: (n: number) => void }) {
  const p = { n: k.basis.buyIns, stake: keepStake(k, fmt) };
  if (k.free === 0 && !amount) return <T v="small">{t('As tuas regras pedem {need} ({n} buy-ins para {stake}): o saldo não passa disso.', { ...p, need: fmt(k.need) })}</T>;
  if (amount > k.free) {
    return (
      <T v="small" color={C.warn}>
        {t('Depois deste levantamento ficas abaixo das tuas regras ({n} buy-ins para {stake}).', p)}
      </T>
    );
  }
  return (
    <View style={{ gap: S.sm }}>
      <T v="small">{t('Podes levantar até {amount} e manter as tuas regras ({n} buy-ins para {stake}).', { ...p, amount: fmt(k.free) })}</T>
      {amount !== k.free ? (
        <ChipRow>
          <Chip icon="arrow-up" label={t('Levantar {amount}', { amount: fmt(k.free) })} onPress={() => onFill(k.free)} />
        </ChipRow>
      ) : null}
    </View>
  );
}

/**
 * New or existing deposit / withdrawal. `bankrolls` are the ones it may go to (one currency).
 * `keep` gives, for a new withdrawal, what each bankroll's rules let come out.
 */
export function TransferForm({
  initial,
  bankrolls,
  onSave,
  onDelete,
  keep,
  fmt,
}: {
  initial: Transfer;
  bankrolls: Bankroll[];
  onSave: (x: Transfer) => void;
  onDelete?: () => void;
  keep?: (bankrollId: string) => Keep | null;
  fmt?: (n: number, currency: string) => string;
}) {
  const [x, setX] = useState(initial);
  const set = (p: Partial<Transfer>) => setX((c) => ({ ...c, ...p }));
  const b = bankrolls.find((r) => r.id === x.bankrollId) ?? bankrolls[0];
  const cur = b?.currency ?? '€';
  const k = x.kind === 'withdrawal' && b && keep ? keep(b.id) : null;
  return (
    <View style={{ gap: S.lg }}>
      <Segmented
        options={[
          { key: 'deposit', label: t('Depósito') },
          { key: 'withdrawal', label: t('Levantamento') },
        ]}
        value={x.kind}
        onChange={(kind) => set({ kind })}
      />
      <Row>
        <NumField label={t('Valor ({currency})', { currency: cur })} value={x.amount} onChange={(amount) => set({ amount: Math.abs(amount) })} />
      </Row>
      {k && fmt ? <KeepHint k={k} amount={x.amount} fmt={(n) => fmt(n, cur)} onFill={(amount) => set({ amount })} /> : null}
      {bankrolls.length > 1 ? (
        <Section title="Bankroll">
          <ChipRow>
            {bankrolls.map((r) => (
              <Chip key={r.id} label={r.name} active={r.id === b?.id} onPress={() => set({ bankrollId: r.id })} />
            ))}
          </ChipRow>
        </Section>
      ) : null}
      <Section title={t('Quando')}>
        <DayPicker
          value={x.at}
          // Today keeps the current time, so it sorts after today's sessions.
          onChange={(d) => set({ at: d >= startOfDay(Date.now()) ? Date.now() : d + 12 * 3600000 })}
        />
      </Section>
      <Field label={t('Nota')} value={x.note} onChangeText={(note) => set({ note: note.slice(0, 120) })} placeholder={x.kind === 'deposit' ? t('Ex.: transferência do banco') : t('Ex.: férias')} />
      <Button
        title={x.kind === 'deposit' ? t('Guardar depósito') : t('Guardar levantamento')}
        icon="checkmark"
        disabled={!(x.amount > 0) || !b}
        onPress={() => onSave({ ...x, bankrollId: b!.id })}
      />
      {onDelete ? <Button title={t('Apagar')} kind="danger" icon="trash-outline" size="md" onPress={onDelete} /> : null}
    </View>
  );
}

export function blankTransfer(bankrollId: string, kind: Transfer['kind']): Transfer {
  return { id: uid('t_'), bankrollId, kind, amount: 0, at: Date.now(), note: '' };
}

/** New bankroll (name, currency, starting balance) or rename / delete one. */
export function BankrollForm({
  initial,
  isNew,
  defaultCurrency,
  onSave,
  onDelete,
  deleteHint,
}: {
  initial?: Bankroll;
  isNew: boolean;
  defaultCurrency: string;
  onSave: (b: Bankroll, startingBalance: number) => void;
  onDelete?: () => void;
  deleteHint?: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [start, setStart] = useState(0);
  return (
    <View style={{ gap: S.lg }}>
      <Field label={t('Nome')} value={name} onChangeText={(v) => setName(v.slice(0, 40))} placeholder={t('Ex.: Live, Online, Viagens')} autoFocus={isNew} />
      {isNew ? (
        <>
          <Section title={t('Moeda')} hint={t('Não muda depois: as contas de uma bankroll são sempre numa moeda.')}>
            <ChipRow>
              {CURRENCIES.map((c) => (
                <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />
              ))}
            </ChipRow>
          </Section>
          <Row>
            <NumField label={t('Saldo inicial ({currency})', { currency })} value={start} onChange={(v) => setStart(Math.max(0, v))} />
          </Row>
        </>
      ) : (
        <T v="small">{t('Moeda: {currency}', { currency })}</T>
      )}
      <Button
        title={isNew ? t('Criar bankroll') : t('Guardar')}
        icon="checkmark"
        disabled={!name.trim()}
        onPress={() => onSave({ id: initial?.id ?? uid('br_'), createdAt: initial?.createdAt ?? Date.now(), name: name.trim(), currency }, start)}
      />
      {onDelete ? (
        <View style={{ gap: S.sm }}>
          <Button title={t('Apagar bankroll')} kind="danger" icon="trash-outline" size="md" onPress={onDelete} />
          {deleteHint ? <T v="tiny">{deleteHint}</T> : null}
        </View>
      ) : null}
    </View>
  );
}

export const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'all', label: t('Sempre') },
  { key: '30d', label: t('30 dias') },
  { key: '90d', label: t('90 dias') },
  { key: 'month', label: t('Este mês') },
  { key: 'lastMonth', label: t('Mês passado') },
  { key: 'year', label: t('Este ano') },
  { key: 'custom', label: t('Datas…') },
];

export function rangeLabel(preset: RangePreset, custom: DateRange): string {
  if (preset !== 'custom') return PRESETS.find((p) => p.key === preset)!.label;
  const a = custom.from !== undefined ? fullDay(custom.from) : '…';
  const b = custom.to !== undefined ? fullDay(custom.to) : t('hoje');
  return `${a} – ${b}`;
}

export function effectiveRange(preset: RangePreset, custom: DateRange): DateRange {
  return preset === 'custom' ? custom : presetRange(preset);
}

/** Date range and stakes. Applies on "Ver resultados". */
export function FilterForm({
  preset: p0,
  custom: c0,
  stakes: s0,
  options,
  onApply,
}: {
  preset: RangePreset;
  custom: DateRange;
  stakes: string[];
  options: StakeOption[];
  onApply: (preset: RangePreset, custom: DateRange, stakes: string[]) => void;
}) {
  const [preset, setPreset] = useState(p0);
  const [from, setFrom] = useState(c0.from !== undefined ? fmt(c0.from) : '');
  const [to, setTo] = useState(c0.to !== undefined ? fmt(c0.to) : '');
  const [stakes, setStakes] = useState(s0);
  const fromTs = from ? parseDay(from) : undefined;
  const toTs = to ? parseDay(to) : undefined;
  const bad = preset === 'custom' && (fromTs === null || toTs === null || (fromTs != null && toTs != null && fromTs > toTs));
  const cash = options.filter((o) => o.kind === 'cash');
  const mtt = options.filter((o) => o.kind === 'mtt');
  const toggle = (k: string) => setStakes((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
  return (
    <View style={{ gap: S.xl }}>
      <Section title={t('Período')}>
        <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
          {PRESETS.map((o) => (
            <Chip key={o.key} label={o.label} active={preset === o.key} onPress={() => setPreset(o.key)} />
          ))}
        </Row>
        {preset === 'custom' ? (
          <View style={{ gap: S.sm }}>
            <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
              <Field style={{ flex: 1 }} label={t('De')} value={from} onChangeText={setFrom} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" />
              <Field style={{ flex: 1 }} label={t('Até')} value={to} onChangeText={setTo} placeholder={t('hoje')} keyboardType="numbers-and-punctuation" />
            </Row>
            {bad ? (
              <T v="tiny" color={C.bad}>
                {t('Datas no formato dd/mm/aaaa, a primeira antes da segunda.')}
              </T>
            ) : null}
          </View>
        ) : null}
      </Section>
      <Section title="Stakes" hint={options.length ? t('Sem nenhuma escolhida, contam todas.') : t('Termina sessões para filtrar por stakes.')}>
        {cash.length ? (
          <View style={{ gap: S.sm }}>
            <T v="label">Cash</T>
            <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
              {cash.map((o) => (
                <Chip key={o.key} label={`${o.label} · ${o.sessions}`} active={stakes.includes(o.key)} onPress={() => toggle(o.key)} />
              ))}
            </Row>
          </View>
        ) : null}
        {mtt.length ? (
          <View style={{ gap: S.sm }}>
            <T v="label">{t('Torneios (buy-in)')}</T>
            <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
              {mtt.map((o) => (
                <Chip key={o.key} label={`${o.label} · ${o.sessions}`} active={stakes.includes(o.key)} onPress={() => toggle(o.key)} />
              ))}
            </Row>
          </View>
        ) : null}
      </Section>
      <Button
        title={t('Ver resultados')}
        icon="checkmark"
        disabled={bad}
        onPress={() =>
          onApply(
            preset,
            { from: fromTs == null ? undefined : startOfDay(fromTs), to: toTs == null ? undefined : endOfDay(toTs) },
            stakes.filter((k) => options.some((o) => o.key === k)),
          )
        }
      />
      <Button
        title={t('Limpar filtros')}
        kind="ghost"
        size="md"
        onPress={() => onApply('all', {}, [])}
      />
    </View>
  );
}

function fmt(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
