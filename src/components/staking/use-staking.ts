import { useMemo } from 'react';

import { t } from '@/i18n';
import { useRates } from '@/lib/fx';
import { money } from '@/poker/format';
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
  return useMemo(() => {
    const pk = packageStates(sessions, packages);
    const manual = settings.fxManual ?? {};
    const fx = { table, fallback: home, manual };
    const ledgers = new Map<string, BackerLedger>(backers.map((b) => [b.id, backerLedger(b.id, sessions, packages, payments, pk, fx)]));
    const totals = stakingTotals([...ledgers.values()], home, table, manual);
    return { pk, ledgers, totals };
  }, [sessions, packages, payments, backers, table, home, settings.fxManual]);
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
