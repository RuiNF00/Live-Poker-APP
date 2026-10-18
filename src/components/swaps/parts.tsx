// Pieces of the swap screens: the terms, where you stand, one prize or payment, and the sheet
// to add one.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ProRow } from '@/components/ProGate';
import { Sheet } from '@/components/staking/sheets';
import { ReadPrizeButton } from '@/components/swaps/ReadPrize';
import { Button, Card, Chip, ChipRow, Field, PressRow, Row, Section, Segmented, T } from '@/components/ui';
import { decimalComma, t } from '@/i18n';
import { maybeAskForReview } from '@/lib/review';
import { money, plus, shortDate, timeOf } from '@/poker/format';
import { HALF_CENT } from '@/store/swap-groups';
import { useStore } from '@/store/store';
import { CURRENCIES } from '@/store/currencies';
import { other, owedOn, settled, swapNames, type Swap, type SwapEntry, type SwapLedger, type SwapSide, type SwapTerms } from '@/store/swaps';
import { C, R, S } from '@/theme';

/** An amount with its sign, so the direction never depends on colour alone: +1230$ / −1230$. */
export const signed = (n: number, cur: string) => plus(n, true) + money(Math.abs(n), cur);

export const pctLabel = (n: number) => `${decimalComma ? String(n).replace('.', ',') : n}%`;

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

/** Settlement is Pro (PRO_ONLY.swaps): the results stay visible, the accounts open the paywall. */
export function AccountsLocked() {
  return <ProRow feature="swaps" title={t('Ver contas')} body={t('Quem deve a quem e quanto, já calculado. Com o Pro.')} />;
}

/** One number and a sentence: who owes whom in this swap. */
// gone: the swap was deleted on the server; bankroll leaves it out, so no "adds to your result" line.
export function BalanceHero({ l, name, currency, gone }: { l: SwapLedger; name: string; currency: string; gone?: boolean }) {
  const square = settled(l);
  const color = square ? C.textDim : l.balance > 0 ? C.good : C.warn;
  const verdict = square
    ? l.iOwe || l.theyOwe
      ? t('Estão acertados')
      : t('Ainda ninguém cobrou')
    : l.balance > 0
      ? t('{name} deve-te', { name })
      : t('Deves a {name}', { name });
  const effect = !gone && Math.abs(l.effect) >= HALF_CENT ? (l.effect > 0 ? t('O swap soma {amount} ao teu resultado', { amount: money(l.effect, currency) }) : t('O swap tira {amount} ao teu resultado', { amount: money(-l.effect, currency) })) : '';
  return (
    <Card tone="raised" style={{ gap: S.xs, paddingVertical: S.xl }}>
      <T v="label">{verdict}</T>
      {square ? null : (
        <T v="monoXL" color={color} numberOfLines={1} adjustsFontSizeToFit>
          {money(Math.abs(l.balance), currency)}
        </T>
      )}
      {l.iOwe >= HALF_CENT && l.theyOwe >= HALF_CENT ? (
        <T v="small">{t('Deves {mine} dos teus prémios · {name} deve {theirs} dos seus', { mine: money(l.iOwe, currency), theirs: money(l.theyOwe, currency), name })}</T>
      ) : null}
      {l.iPaid >= HALF_CENT || l.theyPaid >= HALF_CENT ? (
        <T v="small">
          {[l.iPaid >= HALF_CENT ? t('pagaste {amount}', { amount: money(l.iPaid, currency) }) : '', l.theyPaid >= HALF_CENT ? t('recebeste {amount}', { amount: money(l.theyPaid, currency) }) : ''].filter(Boolean).join(' · ')}
        </T>
      ) : null}
      {effect ? <T v="small" color={l.effect > 0 ? C.good : C.textDim}>{effect}</T> : null}
    </Card>
  );
}

/** Two buttons side by side on a phone, one under the other when large text leaves no room for both labels. */
export const PAIR = { flexGrow: 1, flexBasis: 140 } as const;

/** A prize or a payment, with what it means in money for each side. */
export function EntryRow({ swap, e, onLongPress, hideOwed }: { swap: Swap; e: SwapEntry; onLongPress?: () => void; hideOwed?: boolean }) {
  const names = swapNames(swap);
  const mine = e.side === swap.side;
  const cur = swap.terms.currency;
  const who = mine ? t('Tu') : names[e.side];
  const title =
    e.kind === 'result'
      ? e.event || swap.terms.title
      : e.kind === 'received'
        ? mine
          ? t('Recebeste de {name}', { name: names[other(e.side)] })
          : t('{name} recebeu o teu pagamento', { name: names[e.side] })
        : mine
          ? t('Pagaste a {name}', { name: names[other(e.side)] })
          : t('{name} pagou-te', { name: names[e.side] });
  const sub =
    e.kind === 'result'
      ? [mine ? t('Cobraste {amount}', { amount: money(e.amount, cur) }) : t('{name} cobrou {amount}', { name: who, amount: money(e.amount, cur) }), e.finish ? t('{n}.º lugar', { n: e.finish }) : '']
          .filter(Boolean)
          .join(' · ')
      : shortDate(e.at);
  const owe = e.kind === 'result' ? owedOn(swap.terms, e) : e.amount;
  return (
    <PressRow onLongPress={onLongPress} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, paddingHorizontal: S.lg }}>
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: mine ? C.accent : C.good }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h3" numberOfLines={2}>
          {title}
        </T>
        <T v="small" numberOfLines={2}>
          {sub}
          {e.pending ? ` · ${t('por enviar')}` : ''}
        </T>
      </View>
      {hideOwed && e.kind === 'result' ? null : (
      <View style={{ alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
        {e.kind === 'result' ? (
          <T v="tiny" color={mine ? C.warn : C.good}>
            {mine ? t('deves') : t('deve-te')}
          </T>
        ) : null}
        <T v="mono" color={e.kind !== 'result' ? C.textDim : mine ? C.warn : C.good}>
          {!owe ? '—' : money(owe, cur)}
        </T>
      </View>
      )}
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
  owed = 0,
  onClose,
  onSave,
}: {
  swap: Swap | null;
  kind: EntryKind;
  owe: number;
  /** What they owe me (0 when unknown): "Recebi" starts at it. */
  owed?: number;
  onClose: () => void;
  onSave: (e: EntryDraft) => void;
}) {
  return (
    <Sheet visible={!!swap} title={kind === 'result' ? t('Cobrei um prémio') : kind === 'received' ? t('Recebi um pagamento') : t('Fiz um pagamento')} onClose={onClose}>
      {swap ? <EntryForm key={swap.id + kind} swap={swap} kind={kind} owe={owe} owed={owed} onSave={onSave} /> : null}
    </Sheet>
  );
}

type EntryKind = SwapEntry['kind'];

const num = (s: string) => Number(s.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));

function EntryForm({ swap, kind: k0, owe, owed, onSave }: { swap: Swap; kind: EntryKind; owe: number; owed: number; onSave: (e: EntryDraft) => void }) {
  const { sessions } = useStore();
  const cur = swap.terms.currency;
  const [kind, setKind] = useState(k0);
  const [event, setEvent] = useState(swap.terms.scope === 'event' ? swap.terms.title : '');
  const startAt = (k: EntryKind) => (k === 'payment' && owe > 0 ? String(Math.round(owe * 100) / 100) : k === 'received' && owed > 0 ? String(Math.round(owed * 100) / 100) : '');
  const [amount, setAmount] = useState(startAt(k0));
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
          { key: 'result' as const, label: t('Prémio') },
          { key: 'payment' as const, label: t('Paguei') },
          // Only when they owe me: marking what I got is how I close my side.
          ...(owed > 0 || k0 === 'received' ? [{ key: 'received' as const, label: t('Recebi') }] : []),
        ]}
        value={kind}
        onChange={(v) => {
          setKind(v);
          if (v !== 'result') setAmount(startAt(v));
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
      {kind === 'result' ? (
        <ReadPrizeButton
          currency={cur}
          onRead={(p) => {
            setAmount(String(p.amount));
            if (p.finish) setFinish(String(p.finish));
            if (p.event && !event.trim()) setEvent(p.event);
            setSessionId(undefined);
          }}
        />
      ) : null}
      {kind === 'result' ? <Field label={t('Evento')} value={event} onChangeText={setEvent} placeholder={t('Ex.: Evento #12, $5k PLO')} maxLength={80} /> : null}
      <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
        <Field
          label={kind === 'result' ? t('Prémio total ({cur})', { cur }) : kind === 'received' ? t('Valor recebido ({cur})', { cur }) : t('Valor pago ({cur})', { cur })}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          style={{ flex: 1 }}
          autoFocus={kind !== 'result' ? !amount : swap.terms.scope === 'event'}
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
            : kind === 'received'
              ? owed > 0
                ? t('{name} deve-te {amount} neste momento. Regista o que recebeste e o swap fica acertado dos dois lados.', { amount: money(owed, cur), name: them })
                : t('Regista o que {name} te pagou.', { name: them })
              : owe > 0
                ? t('Deves {amount} a {name} neste momento.', { amount: money(owe, cur), name: them })
                : t('Regista o que pagaste a {name}; o que ele te paga regista ele.', { name: them })}
        </T>
      </Card>
      <Button lines={2}
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


/**
 * Store-review moment C (design/pedido-avaliacao.md): the swap has just become square after a
 * payment, on both sides. Only the change while the screen is open counts, not opening a square one.
 */
export function useSettledReview(square: boolean) {
  const was = useRef(square);
  useEffect(() => {
    if (square && !was.current) void maybeAskForReview('settled');
    was.current = square;
  }, [square]);
}
