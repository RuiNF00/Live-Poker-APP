import { useMemo } from 'react';

import { t } from '@/i18n';
import { money } from '@/poker/format';
import { backerLedger, packageStates, type BackerLedger } from '@/store/staking';
import { useStore } from '@/store/store';
import { C } from '@/theme';

/** Package states and every backer's ledger, recomputed only when staking data changes. */
export function useStaking() {
  const { sessions, packages, payments, backers } = useStore();
  return useMemo(() => {
    const pk = packageStates(sessions, packages);
    const ledgers = new Map<string, BackerLedger>(backers.map((b) => [b.id, backerLedger(b.id, sessions, packages, payments, pk)]));
    return { pk, ledgers };
  }, [sessions, packages, payments, backers]);
}

/** "Deves 120€" / "Deve-te 80€" / "Acertado", with its colour. */
export function balanceLabel(balance: number, currency: string): { text: string; color: string } {
  if (Math.abs(balance) < 0.5) return { text: t('Acertado'), color: C.muted };
  return balance > 0
    ? { text: t('Deves {amount}', { amount: money(balance, currency) }), color: C.warn }
    : { text: t('Deve-te {amount}', { amount: money(-balance, currency) }), color: C.good };
}
