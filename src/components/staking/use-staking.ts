import { useMemo } from 'react';

import { t } from '@/i18n';
import { useRates } from '@/lib/fx';
import { FESTIVALS } from '@/poker/festivals';
import { money } from '@/poker/format';
import { missedRefund, pendingCost, useOffers } from '@/store/action-offer';
import { getPlan } from '@/store/festival-plan';
import { rate } from '@/store/fx-math';
import { backerLedger, packageStates, stakingTotals, type BackerLedger, type StakingTotals } from '@/store/staking';
import { useStore } from '@/store/store';
import { C } from '@/theme';

/**
 * Package states, every backer's ledger (each in its deal's currency) and the
 * totals across them, recomputed only when staking data or the rates change.
 */
export function useStaking() {
  const { sessions, packages, payments, backers, settings } = useStore();
  const home = settings.currency;
  // Rates back to the oldest backed session in another currency, only when there is one.
  const since = useMemo(() => {
    const other = sessions.filter((s) => s.stakes?.length && s.currency !== home);
    return other.length ? Math.min(...other.map((s) => s.startedAt)) : null;
  }, [sessions, home]);
  const table = useRates(since);
  const offers = useOffers();
  return useMemo(() => {
    const manual = settings.fxManual ?? {};
    const pk = packageStates(sessions, packages, { table, manual });
    const fx = { table, fallback: home, manual };
    const ledgers = new Map<string, BackerLedger>(backers.map((b) => [b.id, backerLedger(b.id, sessions, packages, payments, pk, fx)]));
    // Festival action not paid for yet, for events no session carries yet: the backer owes it already.
    for (const o of offers) {
      const f = FESTIVALS.find((x) => x.id === o.festivalId);
      if (!f) continue;
      const started = getPlan(f.id).sessions;
      for (const line of o.lines) {
        const l = ledgers.get(line.backerId);
        const due = l ? pendingCost(f, o, line, started) : 0;
        // Paid for events that went by with no session: that money goes back to them.
        const back = l ? missedRefund(f, o, line, started) : 0;
        if (!l || (!due && !back)) continue;
        if (!l.rows.length) l.currency = f.currency;
        const k = rate(table, f.currency, l.currency, o.createdAt, manual) ?? 1;
        l.unpaid += due * k;
        l.balance += (back - due) * k;
      }
    }
    const totals = stakingTotals([...ledgers.values()], home, table, manual);
    return { pk, ledgers, totals, fx };
  }, [sessions, packages, payments, backers, offers, table, home, settings.fxManual]);
}

/** A total that may be split across currencies: "1 200€" or "300€ + 14 508$". */
export function splitMoney(totals: StakingTotals, side: 'owe' | 'owed'): string {
  if (totals.split) return totals.split.filter((x) => x[side] >= 0.5).map((x) => money(x[side], x.currency)).join(' + ');
  return (totals.approx ? '≈ ' : '') + money(totals[side], totals.currency);
}

/** "Deves 120€" / "Deve-te 80€" / "Acertado", with its colour. */
export function balanceLabel(balance: number, currency: string): { text: string; color: string } {
  if (Math.abs(balance) < 0.5) return { text: t('Acertado'), color: C.muted };
  return balance > 0
    ? { text: t('Deves {amount}', { amount: money(balance, currency) }), color: C.warn }
    : { text: t('Deve-te {amount}', { amount: money(-balance, currency) }), color: C.good };
}
