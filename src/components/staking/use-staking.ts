import { useMemo } from 'react';

import { t } from '@/i18n';
import { useRates } from '@/lib/fx';
import { money } from '@/poker/format';
import { missedRefund, pendingCost, useOffers } from '@/store/action-offer';
import { getPlan, planFestival, useFestivalPlans } from '@/store/festival-plan';
import { useFestivals } from '@/store/my-festivals';
import { rate } from '@/store/fx-math';
import { addOfferDue, backerLedger, packageStates, savedOfferRate, stakingRatesSince, stakingTotals, type BackerLedger, type StakingTotals } from '@/store/staking';
import { useStore } from '@/store/store';
import { C } from '@/theme';

/**
 * Package states, every backer's ledger (each in its deal's currency) and the
 * totals across them, recomputed only when staking data or the rates change.
 */
export function useStaking() {
  const { sessions, packages, payments, backers, settings } = useStore();
  const home = settings.currency;
  const offers = useOffers();
  const festivals = useFestivals();
  const plans = useFestivalPlans();
  // Rates back to the oldest backed session or festival package in another currency, only when there is one.
  const since = useMemo(() => {
    const pkgs = offers.flatMap((o) => {
      const f = o.lines.length ? festivals.find((x) => x.id === o.festivalId) : undefined;
      return f ? [{ currency: f.currency, at: o.createdAt }] : [];
    });
    return stakingRatesSince(home, sessions, pkgs);
  }, [sessions, offers, festivals, home]);
  const table = useRates(since);
  return useMemo(() => {
    const manual = settings.fxManual ?? {};
    const pk = packageStates(sessions, packages, { table, manual });
    const fx = { table, fallback: home, manual };
    // With no sessions, a deal is in its oldest festival's currency (addOfferDue): payments convert to that one.
    const deal = new Map<string, string>();
    for (const o of offers) {
      const f = planFestival(festivals, o.festivalId);
      if (f) for (const line of o.lines) if (!deal.has(line.backerId)) deal.set(line.backerId, f.currency);
    }
    const ledgers = new Map<string, BackerLedger>(backers.map((b) => [b.id, backerLedger(b.id, sessions, packages, payments, pk, { ...fx, deal: deal.get(b.id) })]));
    // Festival action not paid for yet, for events no session carries yet: the backer owes it already.
    for (const o of offers) {
      const f = planFestival(festivals, o.festivalId);
      if (!f) continue;
      const started = getPlan(f.id).sessions;
      for (const line of o.lines) {
        const l = ledgers.get(line.backerId);
        const due = l ? pendingCost(f, o, line, started) : 0;
        // Paid for events that went by with no session: that money goes back to them.
        const back = l ? missedRefund(f, o, line, started) : 0;
        // No rate now: the one a payment kept for this package, so a settled backer stays settled (Pronto P2-B).
        if (l) addOfferDue(l, f.currency, due, back, (from, to) => rate(table, from, to, o.createdAt, manual) ?? savedOfferRate(payments, line.backerId, o.id, to));
      }
    }
    const totals = stakingTotals([...ledgers.values()], home, table, manual);
    return { pk, ledgers, totals, fx };
    // plans: getPlan() above reads them (started events, added tournaments).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, packages, payments, backers, offers, festivals, plans, table, home, settings.fxManual]);
}

/** A total that may be split across currencies: "1 200€" or "300€ + 14 508$". */
export function splitMoney(totals: StakingTotals, side: 'owe' | 'owed'): string {
  if (totals.split) return totals.split.filter((x) => x[side] >= 0.01).map((x) => money(x[side], x.currency)).join(' + ');
  return (totals.approx ? '≈ ' : '') + money(totals[side], totals.currency);
}

/** "Deves 120€" / "Deve-te 80€" / "Acertado", with its colour. */
export function balanceLabel(balance: number, currency: string): { text: string; color: string } {
  if (Math.abs(balance) < 0.01) return { text: t('Acertado'), color: C.muted };
  return balance > 0
    ? { text: t('Deves {amount}', { amount: money(balance, currency) }), color: C.warn }
    : { text: t('Deve-te {amount}', { amount: money(-balance, currency) }), color: C.good };
}

/** Festival action with no rate yet, one line per currency: «Deve-te 302,50 $ · sem câmbio, fora do total». */
export function apartLines(l: BackerLedger): string[] {
  return l.apart.filter((a) => Math.abs(a.balance) >= 0.01).map((a) => `${balanceLabel(a.balance, a.currency).text} · ${t('sem câmbio, fora do total')}`);
}

/** Backers made while Pro stay visible after it ends (withPro's `keep`). */
export const useHasBackers = () => useStore().backers.length > 0;
