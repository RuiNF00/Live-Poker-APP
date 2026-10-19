/// <reference types="node" />
// PKO: bounties are part of cashOut, recorded apart so the result, ROI and tax report can show
// them, and a package can leave them out of what the backers have a piece of.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { buildStatement, checkStatement } from '../../lib/backing-link';
import { liveSnapshot } from '../../lib/live-link';
import { taxReport } from '../../tax/tax-math';
import { backedReturn, bountiesOf, gross, ownBounties, owedToBackers, profit, totals } from '../session-math';
import { anonymousStake, backerLedger, packageStates, pieceSteps, withCuts, withPackageBounties } from '../staking';
import type { Session, StakePackage } from '../types';
import { fixSession } from '../validate';

let n = 0;
function mk(over: Partial<Session> = {}): Session {
  n++;
  return {
    id: 's' + n, kind: 'mtt', name: 'PKO', venue: 'Estoril', currency: '€', startedAt: Date.UTC(2026, 4, n), endedAt: Date.UTC(2026, 4, n) + 3_600_000, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 0, sb: 100, bb: 200, ante: 200, anteType: 'bb', tableSize: 9, stack: 0,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

const pkg = (over: Partial<StakePackage> = {}): StakePackage => ({
  id: 'p1', backerId: 'b1', name: 'Pacote', kind: 'action', share: 20, markup: 1, playerCut: 50, createdAt: 0, ...over,
});

test('bountiesOf: the session own, else tournament mode, never below 0 nor above the prize', () => {
  assert.equal(bountiesOf(mk({ cashOut: 1650, bounties: 450 })), 450);
  assert.equal(bountiesOf(mk({ cashOut: 1650, tourney: { bounties: 300 } })), 300, 'older sessions');
  assert.equal(bountiesOf(mk({ cashOut: 1650, bounties: 0, tourney: { bounties: 300 } })), 0, 'the session own wins, 0 included');
  assert.equal(bountiesOf(mk({ cashOut: 200, bounties: 450 })), 200);
  assert.equal(bountiesOf(mk({ cashOut: 200, bounties: -5 })), 0);
  assert.equal(bountiesOf(mk({ cashOut: 0 })), 0);
});

test('without bounties or stakes nothing changes: profit, gross and the backers', () => {
  const plain = mk({ cashOut: 1650, stakes: [{ backerId: 'b1', share: 20, markup: 1 }] });
  const ko = { ...plain, bounties: 450 };
  assert.equal(profit(ko), profit(plain), 'bounties are inside cashOut, not on top of it');
  assert.equal(gross(ko), gross(plain));
  assert.equal(owedToBackers(ko), owedToBackers(plain), 'shared by default');
  assert.equal(owedToBackers(ko), 330);
});

test('kept: the backer has a piece of the prize without the bounties; you keep them all', () => {
  const s = mk({ cashOut: 1650, bounties: 450, stakes: [{ backerId: 'b1', share: 20, markup: 1, bountiesKept: true }] });
  assert.equal(backedReturn(s, s.stakes![0]), 1200);
  assert.equal(owedToBackers(s), 240);
  assert.equal(ownBounties(s), 450);
  // 1650 − 240 to the backer − 80 own buy-in (20 of the 100 paid by the backer).
  assert.equal(profit(s), 1330);
  const shared = { ...s, stakes: [{ backerId: 'b1', share: 20, markup: 1 }] };
  assert.equal(ownBounties(shared), 360);
  assert.equal(profit(shared), 1240);
});

test('one session, two packages: each stake follows its own term', () => {
  const s = mk({ cashOut: 1000, bounties: 400, stakes: [{ backerId: 'a', share: 10, markup: 1, bountiesKept: true }, { backerId: 'b', share: 30, markup: 1 }] });
  assert.equal(owedToBackers(s), 60 + 300);
  assert.equal(ownBounties(s), 400 - 120);
});

const ana = { id: 'b1', name: 'Ana', note: '', createdAt: 0, shareKey: 'k_abc123' };

test('ledger, settlement steps and statement use the same prize', () => {
  const p = pkg({ bountiesKept: true });
  const s = mk({ cashOut: 1650, bounties: 450, stakes: [{ backerId: 'b1', share: 20, markup: 1, packageId: 'p1', bountiesKept: true }] });
  const l = backerLedger('b1', [s], [p], []);
  assert.equal(l.rows[0].prize, 240);
  const x = pieceSteps(l.rows[0]);
  assert.equal(x.prizeTotal, 1200);
  assert.equal(x.kept, 450);
  assert.equal(x.piece * x.prizeTotal, x.prize);

  const st = buildStatement(ana, 'Rui', '€', [s], [p], [], 1, undefined, l);
  assert.equal(st.rows[0].kb, 1);
  assert.equal(st.rows[0].bo, undefined);
  const shared = { ...s, stakes: [{ backerId: 'b1', share: 20, markup: 1 }] };
  const st2 = buildStatement(ana, 'Rui', '€', [shared], [], []);
  assert.equal(st2.rows[0].bo, 90, '20% of 450, already inside o');
  assert.equal(st2.rows[0].o, 330);
  assert.deepEqual(checkStatement(JSON.parse(JSON.stringify(st2)))?.rows[0].bo, 90);
  const running = buildStatement(ana, 'Rui', '€', [{ ...shared, endedAt: undefined }], [], []);
  assert.equal(running.rows[0].bo, undefined, 'nothing until it ends');
});

test('makeup: shared bounties win it back, kept ones do not', () => {
  const p = pkg({ kind: 'makeup', share: 50, playerCut: 50 });
  const lose = mk({ buyIn: 1000, stakes: [{ backerId: 'b1', share: 50, markup: 1, packageId: 'p1' }] });
  const ko = mk({ buyIn: 100, cashOut: 600, bounties: 600, stakes: [{ backerId: 'b1', share: 50, markup: 1, packageId: 'p1' }] });
  // Shared: the backer's 300 of bounties less 50 of buy-in takes 250 off their 500 of makeup.
  assert.equal(packageStates([lose, ko], [p]).states.get('p1')!.makeup, 500 - 250);
  const kept = [lose, ko].map((s) => ({ ...s, stakes: s.stakes!.map((x) => ({ ...x, bountiesKept: true as const })) }));
  assert.equal(packageStates(kept, [{ ...p, bountiesKept: true }]).states.get('p1')!.makeup, 500 + 50);
  assert.equal(withCuts(kept, [{ ...p, bountiesKept: true }]).find((s) => s.id === ko.id)!.makeupCut ?? 0, 0);
});

test('changing the package term moves every stake of that package, and only those', () => {
  const a = mk({ cashOut: 500, bounties: 200, stakes: [{ backerId: 'b1', share: 20, markup: 1, packageId: 'p1' }, { backerId: 'b2', share: 10, markup: 1, packageId: 'p2' }] });
  const b = mk({ stakes: [{ backerId: 'b2', share: 10, markup: 1, packageId: 'p2' }] });
  const on = withPackageBounties([a, b], 'p1', true);
  assert.deepEqual(on.map((s) => s.id), [a.id]);
  assert.equal(on[0].stakes![0].bountiesKept, true);
  assert.equal(on[0].stakes![1].bountiesKept, undefined);
  assert.deepEqual(withPackageBounties(on, 'p1', true), [], 'nothing to save twice');
  const off = withPackageBounties(on, 'p1', false);
  assert.ok(!('bountiesKept' in off[0].stakes![0]));
});

test('ROI with and without bounties, per currency, never mixed', () => {
  const eur = mk({ buyIn: 100, cashOut: 300, bounties: 100 });
  const eur2 = mk({ buyIn: 100 });
  const usd = mk({ buyIn: 100, cashOut: 1000, bounties: 1000, currency: '$' });
  const t = totals([eur, eur2, usd], '€');
  assert.equal(t.bounties, 100);
  assert.equal(t.roi, 50);
  assert.equal(t.roiNoBounties, 0);
  assert.equal(totals([eur2], '€').roiNoBounties, null, 'no line without bounties');
  assert.equal(totals([eur, usd], '$').bounties, 1000);
  // A bounty alone is not a cash.
  assert.equal(totals([usd], '$').itm, 0);
});

test('tax report: bounties per country and currency, the result unchanged', () => {
  const year = { from: Date.UTC(2026, 0, 1), to: Date.UTC(2027, 0, 1) };
  const a = mk({ cashOut: 1650, bounties: 450, country: 'PT' });
  const b = mk({ cashOut: 500, bounties: 100, country: 'PT', stakes: [{ backerId: 'b1', share: 50, markup: 1 }] });
  const c = mk({ cashOut: 400, bounties: 400, currency: '$', country: 'US' });
  const r = taxReport([a, b, c], year);
  const pt = r.rows.find((x) => x.country === 'PT')!;
  assert.equal(pt.bounties, 450 + 50, 'your share only');
  assert.equal(r.rows.find((x) => x.currency === '$')!.bounties, 400);
  const plain = taxReport([a, b, c].map(({ bounties: _, ...s }) => s), year);
  assert.deepEqual(
    r.rows.map((x) => [x.wins, x.losses, x.net]),
    plain.rows.map((x) => [x.wins, x.losses, x.net]),
  );
});

test('live link: kept bounties go with the result, spread over what was sold', () => {
  const s = mk({ cashOut: 1000, bounties: 400, stakes: [{ backerId: 'a', share: 10, markup: 1, bountiesKept: true }, { backerId: 'b', share: 30, markup: 1 }] });
  const snap = liveSnapshot(s, 'Rui', 0);
  assert.equal((snap.sold / 100) * (snap.cashOut - (snap.kept ?? 0)), owedToBackers(s));
  assert.equal(liveSnapshot({ ...s, stakes: [{ backerId: 'b', share: 30, markup: 1 }] }, 'Rui', 0).kept, undefined);
  assert.equal(liveSnapshot({ ...s, endedAt: undefined }, 'Rui', 0).kept, undefined);
});

test('no backer amount multiplies the raw cashOut: every piece goes through backedReturn', () => {
  for (const f of ['../staking.ts', '../session-math.ts', '../../lib/backing-link.ts', '../../lib/live-link.ts']) {
    const src = readFileSync(path.join(__dirname, f), 'utf8');
    const hits = src.split('\n').filter((l) => /cashOut/.test(l) && /share|piece|sold|stake/i.test(l) && !/^\s*(\/\/|\*|\/\*\*)/.test(l));
    assert.deepEqual(hits, [], f);
  }
});

test('a backup with junk in the PKO fields never turns a result into NaN', () => {
  const s = fixSession({ ...mk({ cashOut: 500 }), bounties: 'x', stakes: [{ backerId: 'b1', share: 20, markup: 1, bountiesKept: 'false' }] } as unknown)!;
  assert.equal(s.bounties, undefined);
  assert.ok(!('bountiesKept' in s.stakes![0]));
  assert.equal(owedToBackers(s), 100);
  assert.equal(bountiesOf(mk({ cashOut: 500, tourney: { bounties: Number.NaN } })), 0);
  assert.ok(Number.isFinite(profit(mk({ cashOut: 500, bounties: 'x' as unknown as number }))));
});

test('deleting a backer keeps their piece as a plain sale, bounties term included', () => {
  const x = { backerId: 'b1', packageId: 'p1', share: 20, markup: 1.1, cut: 12, bountiesKept: true as const, unpaid: true as const };
  assert.deepEqual(anonymousStake(x), { share: 20, markup: 1.1, cut: 12, bountiesKept: true });
  const s = mk({ cashOut: 1650, bounties: 450, stakes: [x] });
  assert.equal(owedToBackers({ ...s, stakes: [anonymousStake(x)] }), owedToBackers(s), 'what the player owes does not change');
  assert.deepEqual(anonymousStake({ share: 10, markup: 1 }), { share: 10, markup: 1 });
});

test('live link: each backer link knows its own term, so mixed packages are both right', () => {
  const s = mk({ cashOut: 1000, bounties: 400, stakes: [{ backerId: 'a', share: 10, markup: 1, bountiesKept: true }, { backerId: 'b', share: 30, markup: 1 }] });
  const snap = liveSnapshot(s, 'Rui', 0);
  assert.equal(snap.bounties, 400);
  // The page: mine × (cashOut − (k=1 ? bounties : 0)).
  assert.equal((10 / 100) * (snap.cashOut - snap.bounties!), owedToBackers({ ...s, stakes: [s.stakes![0]] }));
  assert.equal((30 / 100) * snap.cashOut, owedToBackers({ ...s, stakes: [s.stakes![1]] }));
  assert.equal(liveSnapshot({ ...s, endedAt: undefined }, 'Rui', 0).bounties, undefined);
});
