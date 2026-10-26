/// <reference types="node" />
// «Usar noutro aparelho» played out without phones: a server that keeps one copy per code, and
// devices that read it, join it in and send back what it lacks, with the same pure rules the app
// uses (syncPlan, mergeBackups, uploadBlock). A device's store import (importData with sync) is
// mergeBackups here: the same rules, without React. Encryption is left out (backup-crypto.test.ts):
// the server only ever holds what the phone sealed.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CloudState } from '../../lib/cloud-code';
import { parseCode, syncLink } from '../../lib/cloud-code';
import { countsOf, PULL_GAP_MS, pullDue, uploadBlock } from '../../lib/cloud-guard';
import type { Hand } from '../../poker/types';
import { buildBackup, type BackupData } from '../backup';
import { aheadOf, editedSince, mergeBackups, syncPlan, writtenElsewhere } from '../backup-merge';
import { autoBankrollId, balanceOf, bankrollOf } from '../bankroll-math';
import { totals } from '../session-math';
import { DEFAULT_SETTINGS, type Bankroll, type PlayerNote, type Session, type Transfer } from '../types';

let clock = Date.UTC(2026, 9, 1, 12);
const tick = (ms = 60_000) => (clock += ms);

const ID = autoBankrollId('€');
const br = (currency: string, over: Partial<Bankroll> = {}): Bankroll => ({ id: ID, name: 'Principal', currency, createdAt: 1, ...over });
const ses = (id: string, cashOut: number, over: Partial<Session> = {}): Session => ({
  id, kind: 'mtt', name: 'T', venue: 'V', currency: '€', startedAt: clock, endedAt: clock + 3600000, breaks: [],
  buyIn: 100, entries: 1, addOn: 0, cashOut, sb: 1, bb: 2, ante: 0, anteType: 'none', tableSize: 9, stack: 0, stackLog: [], roster: [], notes: '', bankrollId: ID, ...over,
});
const hand = (id: string, sessionId?: string) => ({ v: 1, id, createdAt: clock, updatedAt: clock, sessionId, game: {}, players: [], button: 0 }) as unknown as Hand;
const dep = (id: string, amount: number, kind: Transfer['kind'] = 'deposit', bankrollId = ID): Transfer => ({ id, bankrollId, kind, amount, at: clock, note: '' });
const note = (id: string) => ({ id, name: id, notes: '', updatedAt: clock }) as unknown as PlayerNote;

type ListName = 'hands' | 'sessions' | 'players' | 'transfers' | 'bankrolls';

/** The server: what it holds for the one code in these tests, and how often it was written. */
class Server {
  copy: BackupData | null = null;
  writes = 0;
}

/** A phone or an iPad: what its store holds and its saved cloud state (rl.cloud.v1). */
class Device {
  d: BackupData;
  c: CloudState | null = null;
  constructor(public name: string, d: Partial<BackupData> = {}) {
    this.d = { ...buildBackup({ hands: [], sessions: [], players: [], bankrolls: [br('€')], settings: { ...DEFAULT_SETTINGS, bankrollId: ID } }, 0), ...d };
  }
  /** buildBackup(store) as the app calls it: what the store holds now, stamped now. */
  snap(): BackupData {
    return { ...this.d, exportedAt: clock };
  }
  /** store.saveX: upsert with a fresh edit time. */
  save<K extends ListName>(k: K, x: NonNullable<BackupData[K]>[number]) {
    const item = { ...(x as object), updatedAt: clock } as { id: string; updatedAt: number };
    const list = ((this.d[k] ?? []) as { id: string }[]).filter((y) => y.id !== item.id);
    (this.d as unknown as Record<string, unknown[]>)[k] = [...list, item];
    tick(1000);
  }
  /** store.deleteX: gone, with a delete mark (deleted-math.ts). */
  remove(k: ListName, id: string) {
    (this.d as unknown as Record<string, { id: string }[]>)[k] = ((this.d[k] ?? []) as { id: string }[]).filter((y) => y.id !== id);
    this.d = { ...this.d, deleted: { ...this.d.deleted, [`${k}:${id}`]: clock } };
    tick(1000);
  }
  /** importData(remote, { sync: true }). */
  private importSync(remote: BackupData) {
    this.d = { ...mergeBackups(this.d, remote, clock), exportedAt: this.d.exportedAt };
  }
  private put(s: Server, data: BackupData, echo: boolean) {
    s.copy = data;
    s.writes++;
    this.c = { ...this.c!, lastAt: clock, counts: countsOf(data), sent: data.exportedAt, syncedAt: clock, echo };
    tick(1000);
  }
  /** «Ativar cópia na nuvem»: a new code, forced (nothing to protect yet). */
  activate(s: Server) {
    this.c = { id: '0123456789', secret: 'ABCDEFGHJKMNPQRS' };
    this.put(s, this.snap(), false);
  }
  /** cloud-backup.ts syncCloud: on opening, back from the background, «Sincronizar agora» on the devices screen. */
  sync(s: Server, local = this.snap()): 'pushed' | 'joined' | 'same' | 'held' {
    if (!this.c || !s.copy) return 'same';
    const remote = s.copy;
    const plan = syncPlan(local, remote, this.c, clock);
    this.c = { ...this.c, checkedAt: clock, ...(plan.other ? { shared: true, seen: remote.exportedAt } : null) };
    if (plan.join) this.importSync(remote);
    if (plan.push) {
      if (uploadBlock(countsOf(plan.data), this.c)) return 'held';
      this.put(s, plan.data, true);
      return 'pushed';
    }
    if (!plan.ahead) this.c = { ...this.c, syncedAt: clock };
    tick(1000);
    return plan.join ? 'joined' : 'same';
  }
  /** cloud-backup.ts upload (after a saved hand, the 6-hourly copy): joins in another device's copy, then always writes. */
  upload(s: Server): 'ok' | 'would_shrink' {
    let data = this.snap();
    if (this.c?.lastAt && s.copy && writtenElsewhere(s.copy, this.c.sent)) {
      data = mergeBackups(data, s.copy, clock);
      this.c = { ...this.c, shared: true, seen: s.copy.exportedAt };
      this.importSync(s.copy);
    }
    if (uploadBlock(countsOf(data), this.c!)) return 'would_shrink';
    this.put(s, data, false);
    return 'ok';
  }
  /** cloud-backup.ts joinCloud: the code typed (or the QR) on this device. */
  join(s: Server, code: Pick<CloudState, 'id' | 'secret'>) {
    const remote = s.copy;
    if (!remote) throw new Error('not_found');
    const local = this.snap();
    this.importSync(remote);
    this.c = { id: code.id, secret: code.secret, lastAt: clock, checkedAt: clock, counts: countsOf(remote), sent: 0, seen: remote.exportedAt, shared: true, saved: true };
    tick(1000);
    return this.sync(s, mergeBackups(local, remote, clock));
  }
  ids(k: ListName): string[] {
    return ((this.d[k] ?? []) as { id: string }[]).map((x) => x.id).sort();
  }
  get<K extends ListName>(k: K, id: string) {
    return ((this.d[k] ?? []) as { id: string }[]).find((x) => x.id === id) as NonNullable<BackupData[K]>[number] | undefined;
  }
}

/** Every list once per id: nothing counted twice. */
function noDoubles(dev: Device) {
  for (const k of ['hands', 'sessions', 'players', 'transfers', 'bankrolls'] as const) {
    const ids = dev.ids(k);
    assert.equal(new Set(ids).size, ids.length, `${dev.name} ${k}: ${ids.join(', ')}`);
  }
}

/** Synced back and forth until nothing more goes up; fails if it doesn't settle (a copy bouncing between devices). */
function settle(s: Server, devices: Device[], rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    const before = s.writes;
    for (const d of devices) {
      tick(PULL_GAP_MS);
      d.sync(s);
    }
    if (s.writes === before) return;
  }
  assert.fail(`still writing after ${rounds} rounds (${s.writes} writes)`);
}

/** The same items (ids and edit times) on every device and on the server. */
function sameEverywhere(s: Server, devices: Device[]) {
  const sig = (d: BackupData) =>
    (['hands', 'sessions', 'players', 'transfers'] as const).map((k) => ((d[k] ?? []) as { id: string; updatedAt?: number }[]).map((x) => `${x.id}@${x.updatedAt ?? 0}`).sort().join(',')).join('|');
  for (const d of devices) assert.equal(sig(d.d), sig(s.copy!), d.name);
}

function pair() {
  const s = new Server();
  const A = new Device('iPhone', { sessions: [ses('a1', 300)], hands: [hand('ha1', 'a1')] });
  A.activate(s);
  const B = new Device('iPad');
  assert.equal(B.join(s, A.c!), 'same');
  settle(s, [A, B]);
  return { s, A, B };
}

test('a new iPad joins with the code: it gets everything, sends nothing back, and the iPhone learns it is shared', () => {
  const { s, A, B } = pair();
  assert.deepEqual(B.ids('sessions'), ['a1']);
  assert.deepEqual(B.ids('hands'), ['ha1']);
  assert.equal(B.c?.shared, true);
  // An empty device has nothing the copy lacks: no write.
  assert.equal(s.writes, 1);
  // The iPhone only finds out once another device writes; until then its own copy is all there is.
  assert.equal(!!A.c?.shared, false);
  B.save('players', note('villain'));
  B.upload(s);
  tick(PULL_GAP_MS);
  A.upload(s);
  assert.equal(A.c?.shared, true);
  assert.deepEqual(A.ids('players'), ['villain']);
});

test('two devices offline, both adding: after they come back each has everything, once', () => {
  const { s, A, B } = pair();
  // A casino with no signal: the iPhone logs a session, the iPad (at the hotel) two notes and a deposit.
  A.save('sessions', ses('a2', 0));
  A.save('hands', hand('ha2', 'a2'));
  B.save('players', note('seat3'));
  B.save('players', note('seat7'));
  B.save('transfers', dep('t1', 500));
  // Back online: whichever comes first.
  tick(PULL_GAP_MS);
  assert.equal(B.sync(s), 'pushed');
  tick(PULL_GAP_MS);
  assert.equal(A.sync(s), 'pushed');
  settle(s, [A, B]);
  for (const d of [A, B]) {
    assert.deepEqual(d.ids('sessions'), ['a1', 'a2'], d.name);
    assert.deepEqual(d.ids('hands'), ['ha1', 'ha2'], d.name);
    assert.deepEqual(d.ids('players'), ['seat3', 'seat7'], d.name);
    assert.deepEqual(d.ids('transfers'), ['t1'], d.name);
    noDoubles(d);
    // 300 − 100 + 0 − 100 = 100 from poker; plus the 500 deposited.
    assert.equal(totals(d.d.sessions).profit, 100, d.name);
    assert.equal(balanceOf({ bankrollId: ID }, d.d.sessions, d.d.transfers ?? [], d.d.bankrolls ?? []).balance, 600, d.name);
  }
  sameEverywhere(s, [A, B]);
});

test('settled devices stay quiet: opening the app again and again writes nothing', () => {
  const { s, A, B } = pair();
  A.save('sessions', ses('a2', 50));
  A.upload(s);
  settle(s, [A, B]);
  const writes = s.writes;
  for (let i = 0; i < 10; i++) {
    tick(PULL_GAP_MS);
    assert.notEqual(A.sync(s), 'pushed');
    tick(PULL_GAP_MS);
    assert.notEqual(B.sync(s), 'pushed');
  }
  assert.equal(s.writes, writes);
  // Different settings on each device (its own currency shown, its own default bankroll) never send anything.
  B.d = { ...B.d, settings: { ...DEFAULT_SETTINGS, currency: '$' } };
  tick(PULL_GAP_MS);
  assert.notEqual(B.sync(s), 'pushed');
  assert.equal(s.writes, writes);
});

test('a session deleted on one device leaves the other too, and its money with it', () => {
  const { s, A, B } = pair();
  A.save('sessions', ses('a2', 1000));
  A.upload(s);
  settle(s, [A, B]);
  assert.equal(totals(B.d.sessions).profit, 200 + 900);
  // Logged twice by mistake: deleted on the iPad, while the iPhone saves a new hand offline.
  B.remove('sessions', 'a2');
  A.save('hands', hand('ha3', 'a1'));
  tick(PULL_GAP_MS);
  B.sync(s);
  tick(PULL_GAP_MS);
  A.sync(s);
  settle(s, [A, B]);
  for (const d of [A, B]) {
    assert.deepEqual(d.ids('sessions'), ['a1'], d.name);
    assert.deepEqual(d.ids('hands'), ['ha1', 'ha3'], d.name);
    assert.equal(totals(d.d.sessions).profit, 200, d.name);
  }
  // The server copy keeps the mark: a fourth device can't bring it back.
  assert.ok(s.copy?.deleted?.['sessions:a2']);
});

test('deleted on one, edited on the other after the delete: the edit wins; edited before: the delete wins', () => {
  const { s, A, B } = pair();
  A.save('sessions', ses('a2', 100));
  A.save('sessions', ses('a3', 100));
  A.upload(s);
  settle(s, [A, B]);
  // a2: deleted on the iPhone, then fixed on the iPad (offline, later). a3: fixed on the iPad, then deleted on the iPhone.
  A.remove('sessions', 'a2');
  B.save('sessions', { ...B.get('sessions', 'a3')!, cashOut: 150 });
  A.remove('sessions', 'a3');
  B.save('sessions', { ...B.get('sessions', 'a2')!, cashOut: 400 });
  tick(PULL_GAP_MS);
  A.sync(s);
  tick(PULL_GAP_MS);
  B.sync(s);
  settle(s, [A, B]);
  for (const d of [A, B]) {
    assert.deepEqual(d.ids('sessions'), ['a1', 'a2'], d.name);
    assert.equal(d.get('sessions', 'a2')?.cashOut, 400, d.name);
  }
  sameEverywhere(s, [A, B]);
});

test('the same session edited on both devices offline: the later edit is kept, whole, on both, and there is one session', () => {
  const { s, A, B } = pair();
  // The iPhone fixes the cash-out at 10:00; the iPad adds a note at 10:05. Neither had signal.
  A.save('sessions', { ...A.get('sessions', 'a1')!, cashOut: 450 });
  tick(5 * 60_000);
  B.save('sessions', { ...B.get('sessions', 'a1')!, notes: 'Mesa dura' });
  // The earlier edit reaches the server first, then the later one: the later one stays.
  tick(PULL_GAP_MS);
  A.sync(s);
  tick(PULL_GAP_MS);
  B.sync(s);
  settle(s, [A, B]);
  for (const d of [A, B]) {
    assert.deepEqual(d.ids('sessions'), ['a1'], d.name);
    // One whole version: the later one. The earlier cash-out fix is not merged field by field (LEIA.md, riscos).
    assert.equal(d.get('sessions', 'a1')?.notes, 'Mesa dura', d.name);
    assert.equal(d.get('sessions', 'a1')?.cashOut, 300, d.name);
  }
  // The other order of arrival ends the same.
  const p = pair();
  p.A.save('sessions', { ...p.A.get('sessions', 'a1')!, cashOut: 450 });
  tick(5 * 60_000);
  p.B.save('sessions', { ...p.B.get('sessions', 'a1')!, notes: 'Mesa dura' });
  tick(PULL_GAP_MS);
  p.B.sync(p.s);
  tick(PULL_GAP_MS);
  p.A.sync(p.s);
  settle(p.s, [p.A, p.B]);
  for (const d of [p.A, p.B]) assert.equal(d.get('sessions', 'a1')?.notes, 'Mesa dura', d.name);
});

test('both devices read the copy, then both write: the one written over comes back on the next sync', () => {
  const { s, A, B } = pair();
  A.save('sessions', ses('a2', 700));
  B.save('transfers', dep('t1', 200));
  // Both read the same copy before either writes (two uploads seconds apart).
  const seenByA = syncPlan(A.snap(), s.copy!, A.c!, clock);
  const seenByB = syncPlan(B.snap(), s.copy!, B.c!, clock);
  s.copy = seenByA.data;
  A.c = { ...A.c!, lastAt: clock, sent: seenByA.data.exportedAt };
  tick(1000);
  s.copy = seenByB.data;
  B.c = { ...B.c!, lastAt: clock, sent: seenByB.data.exportedAt };
  // a2 is missing from the server now, but it never left the iPhone.
  assert.ok(!s.copy.sessions.some((x) => x.id === 'a2'));
  settle(s, [A, B]);
  for (const d of [A, B]) {
    assert.deepEqual(d.ids('sessions'), ['a1', 'a2'], d.name);
    assert.deepEqual(d.ids('transfers'), ['t1'], d.name);
  }
  assert.deepEqual(s.copy!.sessions.map((x) => x.id).sort(), ['a1', 'a2']);
});

test('a third device joins with its own sessions: all three end with everything, once', () => {
  const { s, A, B } = pair();
  B.save('sessions', ses('b1', 0));
  B.upload(s);
  settle(s, [A, B]);
  // An old phone that had its own history (another code, or none).
  const C = new Device('old phone', { sessions: [ses('c1', 250)], transfers: [dep('tc', 1000)], players: [note('reg')] });
  assert.equal(C.join(s, A.c!), 'pushed');
  settle(s, [A, B, C]);
  for (const d of [A, B, C]) {
    assert.deepEqual(d.ids('sessions'), ['a1', 'b1', 'c1'], d.name);
    assert.deepEqual(d.ids('transfers'), ['tc'], d.name);
    assert.deepEqual(d.ids('players'), ['reg'], d.name);
    noDoubles(d);
    assert.equal(totals(d.d.sessions).profit, 200 - 100 + 150, d.name);
  }
  sameEverywhere(s, [A, B, C]);
  // Joining again with the same code doubles nothing.
  C.join(s, A.c!);
  settle(s, [A, B, C]);
  for (const d of [A, B, C]) noDoubles(d);
});

test('restore on a fresh install: everything comes back, nothing is written, and the empty app never replaces the copy', () => {
  const { s, A } = pair();
  A.save('sessions', ses('a2', 0));
  A.save('transfers', dep('t1', 300, 'withdrawal'));
  A.upload(s);
  const writes = s.writes;
  // Before the code is typed, a freshly installed app with the old state would hold nothing: blocked.
  const blank = new Device('new iPhone');
  blank.c = { ...A.c!, sent: undefined };
  assert.equal(blank.upload(s), 'would_shrink');
  assert.equal(s.writes, writes);
  const D = new Device('new iPhone');
  assert.equal(D.join(s, parseCode(syncLink(A.c!).split('#')[1])!), 'same');
  assert.equal(s.writes, writes);
  assert.deepEqual(D.ids('sessions'), ['a1', 'a2']);
  assert.deepEqual(D.ids('transfers'), ['t1']);
  assert.equal(balanceOf({ bankrollId: ID }, D.d.sessions, D.d.transfers ?? [], D.d.bankrolls ?? []).balance, 200 - 100 - 300);
  // The store hasn't saved the restored items yet when a copy fires: until this device has written
  // the copy itself, every upload joins the server copy in first, so what goes up still holds everything.
  const notLoaded = new Device('new iPhone');
  notLoaded.c = D.c;
  assert.equal(notLoaded.upload(s), 'ok');
  assert.deepEqual(s.copy!.sessions.map((x) => x.id).sort(), ['a1', 'a2']);
  assert.deepEqual(s.copy!.transfers?.map((x) => x.id), ['t1']);
});

test('a € bankroll on one device and a $ one with the same id on the other: never mixed, never doubled, and it settles', () => {
  const s = new Server();
  const A = new Device('iPhone', { sessions: [ses('eur', 400)], transfers: [dep('te', 1000)] });
  A.activate(s);
  // An older onboarding gave the iPad's dollar bankroll the euro id.
  const B = new Device('iPad', { bankrolls: [br('$')], sessions: [ses('usd', 600, { currency: '$' })], transfers: [dep('tu', 2000)] });
  B.join(s, A.c!);
  A.save('sessions', ses('eur2', 0));
  settle(s, [A, B]);
  settle(s, [B, A]);
  for (const d of [A, B]) {
    noDoubles(d);
    assert.deepEqual(d.ids('sessions'), ['eur', 'eur2', 'usd'], d.name);
    // Every session and transfer counts in a bankroll of its own currency.
    for (const x of d.d.sessions) assert.equal(bankrollOf(x, d.d.bankrolls ?? [])?.currency, x.currency, `${d.name} ${x.id}`);
    const cur = (x: Transfer) => (d.d.bankrolls ?? []).find((b) => b.id === x.bankrollId)?.currency;
    assert.equal(cur(d.get('transfers', 'te') as Transfer), '€', d.name);
    assert.equal(cur(d.get('transfers', 'tu') as Transfer), '$', d.name);
    const usd = (d.d.bankrolls ?? []).find((b) => b.currency === '$')!;
    assert.equal(balanceOf({ bankrollId: usd.id }, d.d.sessions, d.d.transfers ?? [], d.d.bankrolls ?? []).balance, 2500, d.name);
  }
});

test('a device that answered a read does not answer the next one unless something changed on it', () => {
  const { s, A, B } = pair();
  // Something only the iPad keeps (an empty bankroll the merge drops on one side, say): it would go up on every read.
  const extra = br('€', { id: 'ipad_only', name: 'Online', createdAt: 5, updatedAt: clock });
  B.d = { ...B.d, bankrolls: [...(B.d.bankrolls ?? []), extra] };
  tick(PULL_GAP_MS);
  assert.equal(B.sync(s), 'pushed');
  // The iPhone writes (a new hand), the copy now lacks the iPad's bankroll again (as if dropped there).
  A.save('hands', hand('ha2', 'a1'));
  A.upload(s);
  s.copy = { ...s.copy!, bankrolls: (s.copy!.bankrolls ?? []).filter((b) => b.id !== 'ipad_only') };
  tick(PULL_GAP_MS);
  // The iPad joins the hand in but doesn't send its bankroll back: its last write was such an answer.
  assert.equal(B.sync(s), 'joined');
  assert.deepEqual(B.ids('hands'), ['ha1', 'ha2']);
  // Once something changes on the iPad, everything it holds goes up again.
  B.save('players', note('new'));
  tick(PULL_GAP_MS);
  assert.equal(B.sync(s), 'pushed');
  assert.ok(s.copy!.bankrolls?.some((b) => b.id === 'ipad_only'));
});

test('aheadOf: only what the copy lacks counts, never what it has more of', () => {
  const base = buildBackup({ hands: [], sessions: [ses('s1', 0)], players: [note('p1')], settings: DEFAULT_SETTINGS }, 100);
  assert.equal(aheadOf(base, base), false);
  // The copy has more (another device's): nothing to send.
  assert.equal(aheadOf(base, { ...base, players: [note('p1'), note('p2')] }), false);
  // Something new, a later edit, an earlier one.
  assert.equal(aheadOf({ ...base, players: [note('p1'), note('p3')] }, base), true);
  assert.equal(aheadOf({ ...base, sessions: [{ ...base.sessions[0], updatedAt: 999 }] }, base), true);
  assert.equal(aheadOf(base, { ...base, sessions: [{ ...base.sessions[0], updatedAt: 999 }] }), false);
  // A delete the copy doesn't have, or has an older time for.
  assert.equal(aheadOf({ ...base, deleted: { 'hands:h1': 50 } }, base), true);
  assert.equal(aheadOf({ ...base, deleted: { 'hands:h1': 50 } }, { ...base, deleted: { 'hands:h1': 50 } }), false);
  assert.equal(aheadOf({ ...base, deleted: { 'hands:h1': 60 } }, { ...base, deleted: { 'hands:h1': 50 } }), true);
  // Settings are each device's own.
  assert.equal(aheadOf({ ...base, settings: { ...DEFAULT_SETTINGS, currency: '$' } }, base), false);
  // A festival pick, an added tournament, a later tap.
  const plan = { picked: ['e1'], lateReg: {}, sessions: {}, picks: { e1: 10 } };
  assert.equal(aheadOf({ ...base, festivalPlans: { lis: plan } }, base), true);
  assert.equal(aheadOf({ ...base, festivalPlans: { lis: plan } }, { ...base, festivalPlans: { lis: plan } }), false);
  assert.equal(aheadOf({ ...base, festivalPlans: { lis: { ...plan, picked: [], picks: { e1: -20 } } } }, { ...base, festivalPlans: { lis: plan } }), true);
});

test('editedSince: a save or a delete after the last upload', () => {
  const base = buildBackup({ hands: [], sessions: [ses('s1', 0, { updatedAt: 100 })], players: [], settings: DEFAULT_SETTINGS }, 100);
  assert.equal(editedSince(base, 100), false);
  assert.equal(editedSince(base, 99), true);
  assert.equal(editedSince({ ...base, deleted: { 'sessions:x': 150 } }, 100), true);
});

test('pullDue: only a shared code with a copy, at most every 5 minutes', () => {
  const t0 = 1_800_000_000_000;
  const c: CloudState = { id: '0123456789', secret: 'ABCDEFGHJKMNPQRS', lastAt: t0, shared: true };
  assert.equal(pullDue(null, t0), false);
  assert.equal(pullDue(c, t0 + PULL_GAP_MS - 1), false);
  assert.equal(pullDue(c, t0 + PULL_GAP_MS), true);
  assert.equal(pullDue({ ...c, checkedAt: t0 + PULL_GAP_MS }, t0 + PULL_GAP_MS + 1000), false);
  // One device alone: nothing to fetch (its 6-hourly copy stays as it was). Nor a copy deleted elsewhere, or none made yet.
  assert.equal(pullDue({ ...c, shared: false }, t0 + 10 * PULL_GAP_MS), false);
  assert.equal(pullDue({ ...c, gone: true }, t0 + 10 * PULL_GAP_MS), false);
  assert.equal(pullDue({ ...c, lastAt: undefined }, t0 + 10 * PULL_GAP_MS), false);
});

test('the QR link carries the whole code and reads back the same', () => {
  const c = { id: '0123456789', secret: 'ABCDEFGHJKMNPQRS' };
  assert.equal(syncLink(c), 'sweatbook://sync#0123456789ABCDEFGHJKMNPQRS');
  assert.deepEqual(parseCode(syncLink(c).split('#')[1]), c);
});
