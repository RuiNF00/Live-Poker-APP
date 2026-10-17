// Pieces of the swap screens: the terms, where you stand, one prize or payment, and the sheet
// to add one.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Sheet } from '@/components/staking/sheets';
import { Button, Card, Chip, ChipRow, Field, PressRow, Row, Section, Segmented, T } from '@/components/ui';
import { lang, t } from '@/i18n';
import { money, shortDate, timeOf } from '@/poker/format';
import { useStore } from '@/store/store';
import { CURRENCIES } from '@/store/currencies';
import { other, owedOn, settled, swapNames, type Swap, type SwapEntry, type SwapLedger, type SwapSide, type SwapTerms } from '@/store/swaps';
import { C, R, S } from '@/theme';

/** An amount with its sign, so the direction never depends on colour alone: +1230$ / −1230$. */
export const signed = (n: number, cur: string) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n), cur);

export const pctLabel = (n: number) => `${lang === 'pt' ? String(n).replace('.', ',') : n}%`;

const FIRST = ['$', '€', '£'];

/** The swap's currency: the usual three plus the one picked, the rest one tap away. */
export function CurrencyPick({ value, onChange, home }: { value: string; onChange: (c: string) => void; home?: string }) {
  const [all, setAll] = useState(false);
  const short = [...new Set([...FIRST, ...(home && CURRENCIES.includes(home) ? [home] : []), value])];
  const list = all ? CURRENCIES : short;
  return (
    <ChipRow>
      {list.map((c) => (
        <Chip key={c} label={c} active={value === c} onPress={() => onChange(c)} />
      ))}
      {!all ? <Chip label={t('Mais moedas')} icon="add" onPress={() => setAll(true)} /> : null}
    </ChipRow>
  );
}

/** Both sides of the deal, as two lines anyone can check: "5% dos teus prémios vão para o João". */
export function TermsCard({ terms, names, side, children }: { terms: SwapTerms; names: Record<SwapSide, string>; side: SwapSide | null; children?: React.ReactNode }) {
  const line = (s: SwapSide) => {
    const from = side === s ? t('dos teus prémios') : terms[s].name === '-' ? t('dos prémios do outro jogador') : t('dos prémios de {name}', { name: names[s] });
    const to = side === other(s) ? t('vão para ti') : t('vão para {name}', { name: names[other(s)] });
    return `${from} ${to}`;
  };
  return (
    <Card style={{ gap: S.sm + 2 }}>
      {(['a', 'b'] as SwapSide[]).map((s) => (
        <Row key={s} gap={S.sm} style={{ alignItems: 'baseline' }}>
          <T v="monoL" color={C.accent} style={{ minWidth: 48 }}>
            {pctLabel(terms[s].pct)}
          </T>
          <T v="body" style={{ flex: 1 }}>
            {line(s)}
          </T>
        </Row>
      ))}
      {terms.note ? (
        <T v="small" style={{ fontStyle: 'italic' }}>
          “{terms.note}”
        </T>
      ) : null}
      {children}
    </Card>
  );
}

/** The fixed confirmation: who, when (server time) and the code both phones show. */
export function Seal({ swap }: { swap: Pick<Swap, 'confirmedAt' | 'confirmedName' | 'code' | 'terms'> }) {
  if (!swap.confirmedAt) return null;
  return (
    <View style={{ gap: S.xs, borderTopWidth: 1, borderTopColor: C.hairline, paddingTop: S.md, marginTop: S.xs }}>
      <Row gap={6}>
        <Ionicons name="checkmark-circle" size={16} color={C.good} />
        <T v="small" color={C.good} style={{ flex: 1 }}>
          {t('Confirmado por {name} · {date}, {time}', { name: swapNames(swap).b, date: shortDate(swap.confirmedAt), time: timeOf(swap.confirmedAt) })}
        </T>
      </Row>
      {swap.code ? (
        <Row gap={S.sm}>
          <T v="label">{t('Código do acordo')}</T>
          <T v="mono" style={{ letterSpacing: 1.5 }}>
            {swap.code}
          </T>
        </Row>
      ) : null}
      <T v="tiny">{t('O mesmo código aparece no telemóvel do outro jogador. Termos e hora já não mudam.')}</T>
    </View>
  );
}

/** One number and a sentence: who owes whom in this swap. */
export function BalanceHero({ l, name, currency }: { l: SwapLedger; name: string; currency: string }) {
  const square = settled(l);
  const color = square ? C.textDim : l.balance > 0 ? C.good : C.warn;
  const verdict = square
    ? l.iOwe || l.theyOwe
      ? t('Estão acertados')
      : t('Ainda ninguém cobrou')
    : l.balance > 0
      ? t('{name} deve-te', { name })
      : t('Deves a {name}', { name });
  const effect = Math.abs(l.effect) >= 0.5 ? (l.effect > 0 ? t('O swap soma {amount} ao teu resultado', { amount: money(l.effect, currency) }) : t('O swap tira {amount} ao teu resultado', { amount: money(-l.effect, currency) })) : '';
  return (
    <Card tone="raised" style={{ gap: S.xs, paddingVertical: S.xl }}>
      <T v="label">{verdict}</T>
      {square ? null : (
        <T v="monoXL" color={color} numberOfLines={1} adjustsFontSizeToFit>
          {signed(l.balance, currency)}
        </T>
      )}
      {l.iOwe >= 0.5 && l.theyOwe >= 0.5 ? (
        <T v="small">{t('Deves {mine} dos teus prémios · {name} deve {theirs} dos seus', { mine: money(l.iOwe, currency), theirs: money(l.theyOwe, currency), name })}</T>
      ) : null}
      {l.iPaid >= 0.5 || l.theyPaid >= 0.5 ? (
        <T v="small">
          {[l.iPaid >= 0.5 ? t('pagaste {amount}', { amount: money(l.iPaid, currency) }) : '', l.theyPaid >= 0.5 ? t('recebeste {amount}', { amount: money(l.theyPaid, currency) }) : ''].filter(Boolean).join(' · ')}
        </T>
      ) : null}
      {effect ? <T v="small" color={l.effect > 0 ? C.good : C.textDim}>{effect}</T> : null}
    </Card>
  );
}

/** A prize or a payment, with what it means in money for each side. */
export function EntryRow({ swap, e, onLongPress }: { swap: Swap; e: SwapEntry; onLongPress?: () => void }) {
  const names = swapNames(swap);
  const mine = e.side === swap.side;
  const cur = swap.terms.currency;
  const who = mine ? t('Tu') : names[e.side];
  const title = e.kind === 'result' ? e.event || swap.terms.title : mine ? t('Pagaste a {name}', { name: names[other(e.side)] }) : t('{name} pagou-te', { name: names[e.side] });
  const sub =
    e.kind === 'result'
      ? [mine ? t('Cobraste {amount}', { amount: money(e.amount, cur) }) : t('{name} cobrou {amount}', { name: who, amount: money(e.amount, cur) }), e.finish ? t('{n}º lugar', { n: e.finish }) : '']
          .filter(Boolean)
          .join(' · ')
      : shortDate(e.at);
  const owe = e.kind === 'result' ? owedOn(swap.terms, e) : e.amount;
  return (
    <PressRow onLongPress={onLongPress} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, paddingHorizontal: S.lg }}>
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: mine ? C.accent : C.good }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h3" numberOfLines={1}>
          {title}
        </T>
        <T v="small" numberOfLines={1}>
          {sub}
          {e.pending ? ` · ${t('por enviar')}` : ''}
        </T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 1 }}>
        {e.kind === 'result' ? (
          <T v="tiny" color={mine ? C.warn : C.good}>
            {mine ? t('deves') : t('deve-te')}
          </T>
        ) : null}
        <T v="mono" color={e.kind === 'payment' ? C.textDim : mine ? C.warn : C.good}>
          {!owe ? '—' : e.kind === 'payment' ? money(owe, cur) : signed(mine ? -owe : owe, cur)}
        </T>
      </View>
    </PressRow>
  );
}

/** What the sheet saves; sessionId when it came from one of my sessions (counts the swap there). */
export type EntryDraft = Pick<SwapEntry, 'kind' | 'amount' | 'event' | 'finish'> & { sessionId?: string };

/** Add a prize (with my recent cashes one tap away) or a payment (pre-filled with what I owe). */
export function EntrySheet({
  swap,
  kind,
  owe,
  onClose,
  onSave,
}: {
  swap: Swap | null;
  kind: 'result' | 'payment';
  owe: number;
  onClose: () => void;
  onSave: (e: EntryDraft) => void;
}) {
  return (
    <Sheet visible={!!swap} title={kind === 'result' ? t('Cobrei um prémio') : t('Fiz um pagamento')} onClose={onClose}>
      {swap ? <EntryForm key={swap.id + kind} swap={swap} kind={kind} owe={owe} onSave={onSave} /> : null}
    </Sheet>
  );
}

const num = (s: string) => Number(s.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));

function EntryForm({ swap, kind: k0, owe, onSave }: { swap: Swap; kind: 'result' | 'payment'; owe: number; onSave: (e: EntryDraft) => void }) {
  const { sessions } = useStore();
  const cur = swap.terms.currency;
  const [kind, setKind] = useState(k0);
  const [event, setEvent] = useState(swap.terms.scope === 'event' ? swap.terms.title : '');
  const [amount, setAmount] = useState(k0 === 'payment' && owe > 0 ? String(Math.round(owe * 100) / 100) : '');
  const [finish, setFinish] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const names = swapNames(swap);
  const them = names[other(swap.side)];
  // Cashes from my own sessions since the swap was made, in its currency: one tap fills the form.
  const cashes = sessions
    .filter((s) => s.endedAt && s.kind === 'mtt' && s.cashOut > 0 && s.currency === cur && s.startedAt >= swap.terms.createdAt - 2 * 86400000)
    .filter((s) => !swap.entries.some((e) => e.side === swap.side && e.kind === 'result' && e.event === s.name && e.amount === s.cashOut))
    .slice(0, 6);
  const value = num(amount);
  const ok = Number.isFinite(value) && amount.trim() !== '' && (kind === 'result' ? value >= 0 : value > 0);
  const preview = kind === 'result' && ok ? owedOn(swap.terms, { side: swap.side, amount: value }) : 0;
  return (
    <>
      <Segmented
        options={[
          { key: 'result', label: t('Prémio') },
          { key: 'payment', label: t('Pagamento') },
        ]}
        value={kind}
        onChange={(v) => {
          setKind(v);
          if (v === 'payment' && !amount && owe > 0) setAmount(String(Math.round(owe * 100) / 100));
        }}
      />
      {kind === 'result' && cashes.length ? (
        <Section title={t('Das tuas sessões')}>
          <ChipRow>
            {cashes.map((s) => (
              <Chip
                key={s.id}
                icon="trophy-outline"
                label={`${s.name || t('Torneio')} · ${money(s.cashOut, cur)}`}
                active={event === s.name && value === s.cashOut}
                onPress={() => {
                  setEvent(s.name);
                  setAmount(String(s.cashOut));
                  setFinish(s.finish ? String(s.finish) : '');
                  setSessionId(s.id);
                }}
              />
            ))}
          </ChipRow>
        </Section>
      ) : null}
      {kind === 'result' ? <Field label={t('Evento')} value={event} onChangeText={setEvent} placeholder={t('Ex.: Evento #12, $5k PLO')} maxLength={80} /> : null}
      <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
        <Field
          label={kind === 'result' ? t('Prémio total ({cur})', { cur }) : t('Valor pago ({cur})', { cur })}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          style={{ flex: 1 }}
          autoFocus={kind === 'payment' ? !amount : swap.terms.scope === 'event'}
        />
        {kind === 'result' ? <Field label={t('Lugar')} value={finish} onChangeText={(v) => setFinish(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="—" style={{ width: 96 }} /> : null}
      </Row>
      <Card tone="inset" style={{ paddingVertical: S.md }}>
        <T v="small">
          {kind === 'result'
            ? ok
              ? value === 0
                ? t('Sem prémio: fica registado e ninguém deve nada por ele.')
                : t('Deves {amount} a {name} ({pct} de {prize}).', { amount: money(preview, cur), name: them, pct: pctLabel(swap.terms[swap.side].pct), prize: money(value, cur) })
              : t('Regista só os teus prémios; {name} regista os seus.', { name: them })
            : owe > 0
              ? t('Deves {amount} a {name} neste momento.', { amount: money(owe, cur), name: them })
              : t('Regista o que pagaste a {name}; o que ele te paga regista ele.', { name: them })}
        </T>
      </Card>
      <Button
        title={t('Guardar')}
        disabled={!ok}
        onPress={() => onSave({ kind, amount: Math.round(value * 100) / 100, event: kind === 'result' ? event.trim() : '', finish: kind === 'result' && finish ? Number(finish) : null, sessionId: kind === 'result' ? sessionId : undefined })}
      />
    </>
  );
}

/** Small round icon used in empty states and cards. */
export function SwapBadge({ size = 40 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: R.md, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="swap-horizontal" size={size * 0.55} color={C.accent} />
    </View>
  );
}

