// Pieces of the group swap screens: where I stand, and the fewest payments that settle everyone.

import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Sheet } from '@/components/staking/sheets';
import { Button, Card, Chip, ChipRow, Field, PressRow, Row, Section, Segmented, T } from '@/components/ui';
import { t } from '@/i18n';
import { money, shortDate } from '@/poker/format';
import { useStore } from '@/store/store';
import { groupLedger, groupNet, groupOwedOn, groupShareOf, minTransfers, seatName, type GroupEntry, type SwapGroup } from '@/store/swap-groups';
import { C, S } from '@/theme';

import { pctLabel, signed } from './parts';

/** "-" (a player who left) reads as "Saiu"; my own seat reads as "Tu". */
export function seatLabel(g: SwapGroup, seat: number): string {
  if (seat === g.seat) return t('Tu');
  const n = seatName(g, seat);
  return n === '-' ? t('Jogador que saiu') : n;
}

/** One number and a sentence: what the group owes me, or what I owe. */
export function GroupHero({ g }: { g: SwapGroup }) {
  const l = groupLedger(g);
  const cur = g.terms.currency;
  const square = Math.abs(l.balance) < 0.5;
  const verdict = square ? (l.myPrizes || l.othersPrizes ? t('Contas acertadas com o grupo') : t('Ainda ninguém cobrou')) : l.balance > 0 ? t('O grupo deve-te') : t('Deves ao grupo');
  const effect = Math.abs(l.effect) >= 0.5 ? (l.effect > 0 ? t('O swap soma {amount} ao teu resultado', { amount: money(l.effect, cur) }) : t('O swap tira {amount} ao teu resultado', { amount: money(-l.effect, cur) })) : '';
  return (
    <Card tone="raised" style={{ gap: S.xs, paddingVertical: S.xl }}>
      <T v="label">{verdict}</T>
      {square ? null : (
        <T v="monoXL" color={l.balance > 0 ? C.good : C.warn} numberOfLines={1} adjustsFontSizeToFit>
          {signed(l.balance, cur)}
        </T>
      )}
      {effect ? (
        <T v="small" color={l.effect > 0 ? C.good : C.textDim}>
          {effect}
        </T>
      ) : null}
    </Card>
  );
}

/** Who pays whom, as few payments as possible. Mine first and highlighted. */
export function GroupSettle({ g }: { g: SwapGroup }) {
  const list = minTransfers(groupNet(g)).sort((a, b) => Number(b.from === g.seat || b.to === g.seat) - Number(a.from === g.seat || a.to === g.seat));
  if (!list.length) return null;
  return (
    <Card style={{ gap: S.sm }}>
      <T v="label">{t('Para acertar')}</T>
      {list.map((x) => {
        const mine = x.from === g.seat || x.to === g.seat;
        return (
          <Row key={`${x.from}-${x.to}`} gap={S.sm} style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Ionicons name="arrow-forward-circle-outline" size={18} color={mine ? C.accent : C.muted} />
            <T v="body" style={{ flex: 1 }} color={mine ? C.text : C.textDim}>
              {x.to === g.seat
                ? t('{from} paga-te', { from: seatLabel(g, x.from) })
                : x.from === g.seat
                  ? t('Pagas a {to}', { to: seatLabel(g, x.to) })
                  : t('{from} paga a {to}', { from: seatLabel(g, x.from), to: seatLabel(g, x.to) })}
            </T>
            <T v="mono" color={mine ? (x.to === g.seat ? C.good : C.warn) : C.textDim}>
              {mine ? signed(x.to === g.seat ? x.amount : -x.amount, g.terms.currency) : money(x.amount, g.terms.currency)}
            </T>
          </Row>
        );
      })}
    </Card>
  );
}

/** A prize or a payment in the group, with what it means for me. */
export function GroupEntryRow({ g, e, onLongPress, hideOwed }: { g: SwapGroup; e: GroupEntry; onLongPress?: () => void; hideOwed?: boolean }) {
  const mine = e.seat === g.seat;
  const cur = g.terms.currency;
  const who = seatLabel(g, e.seat);
  const title = e.kind === 'result' ? e.event || g.terms.title : t('{from} pagou a {to}', { from: who, to: e.to === undefined ? '?' : seatLabel(g, e.to) });
  const sub =
    e.kind === 'result'
      ? [mine ? t('Cobraste {amount}', { amount: money(e.amount, cur) }) : t('{name} cobrou {amount}', { name: who, amount: money(e.amount, cur) }), e.finish ? t('{n}º lugar', { n: e.finish }) : '']
          .filter(Boolean)
          .join(' · ')
      : shortDate(e.at);
  const value = e.kind === 'result' ? (mine ? groupOwedOn(g, e.amount) : groupShareOf(g, e.amount)) : e.amount;
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
      {hideOwed && e.kind === 'result' ? null : (
      <View style={{ alignItems: 'flex-end', gap: 1 }}>
        {e.kind === 'result' && value ? (
          <T v="tiny" color={mine ? C.warn : C.good}>
            {mine ? t('dás') : t('a tua parte')}
          </T>
        ) : null}
        <T v="mono" color={e.kind === 'payment' ? C.textDim : mine ? C.warn : C.good}>
          {!value ? '—' : e.kind === 'payment' ? money(value, cur) : signed(mine ? -value : value, cur)}
        </T>
      </View>
      )}
    </PressRow>
  );
}

export type GroupDraft = Pick<GroupEntry, 'kind' | 'amount' | 'event' | 'finish' | 'to'> & { sessionId?: string };

const num = (s: string) => Number(s.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));

/** Add a prize (my recent cashes one tap away) or a payment to one player (pre-filled from the settle-up). */
export function GroupEntrySheet({ g, kind, onClose, onSave }: { g: SwapGroup | null; kind: 'result' | 'payment'; onClose: () => void; onSave: (e: GroupDraft) => void }) {
  return (
    <Sheet visible={!!g} title={kind === 'result' ? t('Cobrei um prémio') : t('Fiz um pagamento')} onClose={onClose}>
      {g ? <GroupEntryForm key={g.id + kind} g={g} kind={kind} onSave={onSave} /> : null}
    </Sheet>
  );
}

function GroupEntryForm({ g, kind: k0, onSave }: { g: SwapGroup; kind: 'result' | 'payment'; onSave: (e: GroupDraft) => void }) {
  const { sessions } = useStore();
  const cur = g.terms.currency;
  const mineToPay = minTransfers(groupNet(g)).filter((x) => x.from === g.seat);
  const others = g.seats.filter((s) => s.seat !== g.seat && s.name !== '-');
  const [kind, setKind] = useState(k0);
  const [event, setEvent] = useState(g.terms.scope === 'event' ? g.terms.title : '');
  const [to, setTo] = useState<number>(mineToPay[0]?.to ?? others[0]?.seat ?? -1);
  const owedTo = (seat: number) => mineToPay.find((x) => x.to === seat)?.amount ?? 0;
  const [amount, setAmount] = useState(k0 === 'payment' && owedTo(to) ? String(owedTo(to)) : '');
  const [finish, setFinish] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const cashes = sessions
    .filter((s) => s.endedAt && s.kind === 'mtt' && s.cashOut > 0 && s.currency === cur && s.startedAt >= g.terms.createdAt - 2 * 86400000)
    .filter((s) => !g.entries.some((e) => e.seat === g.seat && e.kind === 'result' && e.event === s.name && e.amount === s.cashOut))
    .slice(0, 6);
  const value = num(amount);
  const ok = Number.isFinite(value) && amount.trim() !== '' && (kind === 'result' ? value >= 0 : value > 0 && to >= 0);
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
          if (v === 'payment' && !amount && owedTo(to)) setAmount(String(owedTo(to)));
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
      {kind === 'payment' ? (
        <Section title={t('Pago a')}>
          <ChipRow>
            {others.map((s) => (
              <Chip
                key={s.seat}
                icon="person-outline"
                label={owedTo(s.seat) ? `${s.name} · ${money(owedTo(s.seat), cur)}` : s.name}
                active={to === s.seat}
                onPress={() => {
                  setTo(s.seat);
                  setAmount(owedTo(s.seat) ? String(owedTo(s.seat)) : '');
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
          autoFocus={kind === 'payment' ? !amount : g.terms.scope === 'event'}
        />
        {kind === 'result' ? <Field label={t('Lugar')} value={finish} onChangeText={(v) => setFinish(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="—" style={{ width: 96 }} /> : null}
      </Row>
      <Card tone="inset" style={{ paddingVertical: S.md }}>
        <T v="small">
          {kind === 'result'
            ? ok
              ? value === 0
                ? t('Sem prémio: fica registado e ninguém deve nada por ele.')
                : t('Pagas {each} a cada um dos {n} ({pct} de {prize}), {total} no total.', {
                    each: money(groupShareOf(g, value), cur),
                    n: g.seats.length - 1,
                    pct: pctLabel(g.terms.pct),
                    prize: money(value, cur),
                    total: money(groupOwedOn(g, value), cur),
                  })
              : t('Regista só os teus prémios; cada um regista os seus.')
            : t('Regista o que pagaste; o que te pagam regista quem pagou.')}
        </T>
      </Card>
      <Button
        title={t('Guardar')}
        disabled={!ok}
        onPress={() =>
          onSave({
            kind,
            amount: Math.round(value * 100) / 100,
            event: kind === 'result' ? event.trim() : '',
            finish: kind === 'result' && finish ? Number(finish) : null,
            to: kind === 'payment' ? to : undefined,
            sessionId: kind === 'result' ? sessionId : undefined,
          })
        }
      />
    </>
  );
}
