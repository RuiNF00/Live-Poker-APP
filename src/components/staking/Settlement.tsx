// The settlement with a backer, shown as the sums they can check by hand:
// prizes, your makeup cut, unpaid pieces, payments, and what is left.

import React from 'react';
import { View } from 'react-native';

import { Button, Card, Pill, Row, T } from '@/components/ui';
import { t } from '@/i18n';
import { money, shortDate } from '@/poker/format';
import { pieceSteps, type BackerLedger, type BackerLedgerRow } from '@/store/staking';
import { C, F, S } from '@/theme';
import { dec, Sheet } from './sheets';

const pct = (x: number) => `${Number.isInteger(Math.round(x * 1000) / 10) ? Math.round(x * 100) : dec(Math.round(x * 1000) / 10, 1)}%`;

/** One line of the sums: what it is, how it was worked out, the amount. */
function Step({ label, detail, amount, currency, total, color, sign = true }: { label: string; detail?: string; amount: number; currency: string; total?: boolean; color?: string; sign?: boolean }) {
  const text = (sign && amount > 0.004 && !total ? '+' : amount < -0.004 ? '−' : '') + money(Math.abs(amount), currency);
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, paddingVertical: 10 },
        total ? { borderTopWidth: 1, borderTopColor: C.borderStrong, marginTop: 2, paddingTop: 12 } : null,
      ]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body" style={total ? { fontFamily: F.semibold } : null}>
          {label}
        </T>
        {detail ? <T v="tiny">{detail}</T> : null}
      </View>
      <T v="mono" color={color ?? (total ? C.text : C.textDim)} style={total ? { fontSize: 17 } : { fontSize: 15, fontFamily: F.monoRegular }}>
        {text}
      </T>
    </View>
  );
}

/** "Como chegámos a este saldo": the balance with a backer, line by line. */
export function SettlementCard({ l, name, currency }: { l: BackerLedger; name: string; currency: string }) {
  const done = l.rows.filter((r) => r.session.endedAt).length;
  const balColor = Math.abs(l.balance) < 0.5 ? C.textDim : l.balance > 0 ? C.warn : C.good;
  return (
    <Card style={{ paddingVertical: S.sm }}>
      <Step
        label={t('Prémios de {name}', { name })}
        detail={done === 1 ? t('Em 1 sessão terminada') : t('Em {n} sessões terminadas', { n: done })}
        amount={l.prizes}
        currency={currency}
      />
      {l.cut >= 0.005 ? <Step label={t('A tua parte no makeup')} detail={t('Só sobre o lucro acima do makeup')} amount={-l.cut} currency={currency} /> : null}
      {l.unpaid >= 0.005 ? (
        <Step
          label={t('Partes por pagar')}
          detail={t('Ação que {name} ainda não te pagou', { name })}
          amount={-l.unpaid}
          currency={currency}
        />
      ) : null}
      {Math.abs(l.paid) >= 0.005 ? (
        <Step label={l.paid > 0 ? t('Já lhe pagaste') : t('Já te pagou')} amount={-l.paid} currency={currency} />
      ) : null}
      <Step
        label={Math.abs(l.balance) < 0.5 ? t('Acertado') : l.balance > 0 ? t('Deves a {name}', { name }) : t('{name} deve-te', { name })}
        amount={Math.abs(l.balance) < 0.5 ? 0 : Math.abs(l.balance)}
        currency={currency}
        total
        color={balColor}
      />
      <T v="tiny" style={{ paddingTop: S.sm }}>
        {t('Os pagamentos fazem-se fora da app; aqui só os registas.')}
      </T>
    </Card>
  );
}

/** One session's piece, step by step: session → share → markup → makeup → payout. */
export function PieceSheet({
  row,
  name,
  pkgName,
  currency,
  onClose,
  onTogglePaid,
}: {
  row: BackerLedgerRow | null;
  name: string;
  pkgName?: string;
  currency: string;
  onClose: () => void;
  onTogglePaid: (r: BackerLedgerRow) => void;
}) {
  const s = row?.session;
  return (
    <Sheet visible={!!row} title={s ? s.name || (s.kind === 'mtt' ? t('Torneio') : 'Cash') : ''} onClose={onClose}>
      {row && s ? <PieceSteps row={row} name={name} pkgName={pkgName} currency={currency} onTogglePaid={onTogglePaid} /> : null}
    </Sheet>
  );
}

function PieceSteps({ row, name, pkgName, currency, onTogglePaid }: { row: BackerLedgerRow; name: string; pkgName?: string; currency: string; onTogglePaid: (r: BackerLedgerRow) => void }) {
  const s = row.session;
  const x = pieceSteps(row);
  const ended = !!s.endedAt;
  const m = (n: number) => money(n, currency);
  return (
    <>
      <Row gap={S.sm} style={{ flexWrap: 'wrap', marginTop: -S.md }}>
        <T v="small">{[shortDate(s.startedAt), s.venue, pkgName].filter(Boolean).join(' · ')}</T>
        {!ended ? <Pill label={t('A decorrer')} color={C.good} icon="ellipse" /> : null}
      </Row>

      <Card style={{ paddingVertical: S.sm }}>
        <Step label={t('Buy-ins da sessão')} amount={x.buyIns} currency={currency} sign={false} />
        {ended ? <Step label={t('Prémio da sessão')} amount={x.prizeTotal} currency={currency} sign={false} /> : null}
        <Step
          label={t('{name} pagou', { name })}
          detail={`${pct(x.piece)} × ${m(x.buyIns)}${x.markup !== 1 ? ` × ${dec(x.markup)} markup` : ''}`}
          amount={-x.cost}
          currency={currency}
        />
        {ended ? (
          <>
            <Step label={t('Parte de {name} no prémio', { name })} detail={`${pct(x.piece)} × ${m(x.prizeTotal)}`} amount={x.prize} currency={currency} />
            {x.cut >= 0.005 ? <Step label={t('A tua parte no makeup')} detail={t('Pacote com makeup')} amount={-x.cut} currency={currency} /> : null}
            <Step
              label={x.net >= 0 ? t('{name} ganha', { name }) : t('{name} perde', { name })}
              detail={t('Recebe {amount}', { amount: m(x.owed) })}
              amount={x.net}
              currency={currency}
              total
              color={x.net > 0.004 ? C.good : x.net < -0.004 ? C.bad : C.textDim}
            />
          </>
        ) : (
          <Step label={t('O resultado aparece quando a sessão terminar')} amount={0} currency={currency} sign={false} total color={C.muted} />
        )}
      </Card>

      {row.stake.unpaid ? (
        <Card tone="inset" style={{ gap: S.md }}>
          <T v="small">{t('{name} ainda não te pagou {amount} por esta parte.', { name, amount: m(row.cost) })}</T>
          <Button icon="checkmark-circle-outline" title={t('Marcar como pago')} onPress={() => onTogglePaid(row)} />
        </Card>
      ) : (
        <Button kind="ghost" size="sm" title={t('Afinal ainda não pagou')} onPress={() => onTogglePaid(row)} />
      )}
    </>
  );
}
