import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { t } from '@/i18n';
import type { Statement } from '@/lib/backing-link';
import { fetchLive, type LiveSnapshot } from '@/lib/live-link';
import { money } from '@/poker/format';
import { C } from '@/theme';

const POLL_MS = 30000;

/** Live link ids of the sessions still running in these statements. */
export function liveIds(sts: Statement[]): string[] {
  return [...new Set(sts.flatMap((s) => s.rows.filter((r) => !r.e && r.l).map((r) => r.l!)))];
}

/**
 * The players' live pages for these ids, refreshed while the screen is open and the
 * app is in front. A link the player turned off (404) drops out.
 */
export function useLiveSnapshots(ids: string[]): Map<string, LiveSnapshot> {
  const key = ids.join(',');
  const [snaps, setSnaps] = useState<Map<string, LiveSnapshot>>(new Map());
  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (!list.length) return;
    let alive = true;
    const load = () =>
      Promise.all(list.map((id) => fetchLive(id).then((d) => [id, d?.snapshot ?? null] as const, () => [id, undefined] as const))).then((res) => {
        if (!alive) return;
        setSnaps((cur) => {
          const next = new Map(cur);
          for (const [id, s] of res) {
            if (s) next.set(id, s);
            else if (s === null) next.delete(id);
          }
          return next;
        });
      });
    load();
    const poll = setInterval(() => AppState.currentState === 'active' && load(), POLL_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => {
      alive = false;
      clearInterval(poll);
      sub.remove();
    };
  }, [key]);
  return snaps;
}

/** From the backer's side: positive balance means the player owes you. */
export function backedLabel(bal: number, cur: string): { text: string; short: string; color: string } {
  if (Math.abs(bal) < 0.01) return { text: t('Acertado'), short: '', color: C.muted };
  return bal > 0
    ? { text: t('Deve-te {amount}', { amount: money(bal, cur) }), short: t('deve-te'), color: C.good }
    : { text: t('Deves {amount}', { amount: money(-bal, cur) }), short: t('deves'), color: C.warn };
}

/** Totals across every player you back, per currency (balances in different currencies don't add up). */
export function useBackingTotals(sts: Statement[]) {
  return useMemo(() => {
    const by = new Map<string, { owed: number; owe: number; makeup: number; live: number }>();
    for (const s of sts) {
      const x = by.get(s.cur) ?? { owed: 0, owe: 0, makeup: 0, live: 0 };
      if (s.bal > 0) x.owed += s.bal;
      else x.owe -= s.bal;
      x.makeup += s.mk;
      x.live += s.rows.filter((r) => !r.e).length;
      by.set(s.cur, x);
    }
    return by;
  }, [sts]);
}
