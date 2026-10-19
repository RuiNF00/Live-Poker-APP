// A backer's fixed link: made the first time the player sends them their
// statement, then kept current from here whenever a session, a piece or a payment
// with that backer changes. One link per backer, so they follow every day without
// being sent a new one.

import React, { useEffect, useRef, useState } from 'react';

import { useStaking } from '@/components/staking/use-staking';
import { buildStatement, type Statement } from '@/lib/backing-link';
import { createBackerPage, newPageKey, sealPage, updateBackerPage, type BackerPage } from '@/lib/backer-page';
import { createKey, forgetCreateKey } from '@/lib/create-key';
import { useOnline } from '@/lib/sync';
import { nextEventFor, useOffers, type ActionOffer } from '@/store/action-offer';
import { getPlan, planFestival } from '@/store/festival-plan';
import { allFestivals } from '@/store/my-festivals';
import { unconverted, type BackerLedger, type YearStatement } from '@/store/staking';
import { uid, useStore } from '@/store/store';
import type { Backer, BackerPayment, Session, StakePackage } from '@/store/types';

/** What the backer's page shows: the same ledger as the app, and the next event they have a piece of. */
export function statementFor(
  backer: Backer & { shareKey: string },
  player: string,
  l: BackerLedger,
  data: { sessions: Session[]; packages: StakePackage[]; payments: BackerPayment[]; offers: ActionOffer[]; home: string },
  now = Date.now(),
  /** "Enviar o resumo do ano": the year's packages too. */
  year?: YearStatement,
): Statement {
  const st = buildStatement(backer, player, l.currency || data.home, data.sessions, data.packages, data.payments, now, year, l);
  const festivals = data.offers.flatMap((o) => planFestival(allFestivals(), o.festivalId) ?? []);
  const nx = nextEventFor(festivals, data.offers, backer.id, (id) => getPlan(id).sessions);
  if (nx) st.nx = nx;
  return st;
}

/** The backer's link, made now if they have none yet. Same token until it works: a second tap gets the same page. */
export async function ensureBackerPage(backer: Backer, save: (b: Backer) => void): Promise<Backer & { page: BackerPage; shareKey: string }> {
  const shareKey = backer.shareKey ?? uid('k');
  if (backer.page) return { ...backer, shareKey, page: backer.page };
  const scope = `backer-page:${backer.id}`;
  const made = await createBackerPage(await createKey(scope));
  const next = { ...backer, shareKey, page: { ...made, key: newPageKey() } };
  save(next);
  await forgetCreateKey(scope);
  return next;
}

/** Sends one page now; false when it is gone. */
export async function pushBackerPage(page: BackerPage, st: Statement): Promise<boolean> {
  return updateBackerPage(page, sealPage(st, page));
}

const RETRY_MS = 60000;
// What changed for the backer: the "updated at" alone doesn't count.
const keyOf = (st: Statement) => JSON.stringify({ ...st, at: 0 });

function Sync() {
  const { backers, sessions, packages, payments, settings, saveBacker } = useStore();
  const { ledgers } = useStaking();
  const offers = useOffers();
  const sent = useRef(new Map<string, string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [retry, setRetry] = useState(0);
  const online = useOnline();
  const latest = useRef(backers);
  useEffect(() => {
    latest.current = backers;
  }, [backers]);

  useEffect(() => {
    if (!online) return;
    for (const b of backers) {
      const l = ledgers.get(b.id);
      // Part of the deal with no rate yet: the page keeps its last numbers until the rate is here.
      if (!b.page || !b.shareKey || !l || unconverted(l).length) continue;
      const st = statementFor({ ...b, shareKey: b.shareKey }, settings.nickname || '', l, { sessions, packages, payments, offers, home: settings.currency });
      const key = keyOf(st);
      const page = b.page;
      if (sent.current.get(page.id) === key) continue;
      clearTimeout(timers.current.get(page.id));
      timers.current.set(
        page.id,
        setTimeout(async () => {
          timers.current.delete(page.id);
          try {
            if (await pushBackerPage(page, { ...st, at: Date.now() })) sent.current.set(page.id, key);
            else {
              // Removed on the server (or purged): forget it; the next "Enviar" makes a new one.
              const cur = latest.current.find((x) => x.id === b.id);
              if (cur?.page?.id === page.id) saveBacker({ ...cur, page: undefined });
            }
          } catch {
            setTimeout(() => setRetry((r) => r + 1), RETRY_MS);
          }
        }, 3000),
      );
    }
  }, [backers, sessions, packages, payments, offers, ledgers, settings.nickname, settings.currency, saveBacker, retry, online]);

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((x) => clearTimeout(x));
  }, []);
  return null;
}

/** Mounted once at the root; does nothing (and computes nothing) until a backer has a link. */
export function BackerPageSync() {
  const { backers } = useStore();
  return backers.some((b) => b.page) ? <Sync /> : null;
}
