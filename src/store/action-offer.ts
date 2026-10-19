// Action sold for a festival, as a record: the player picks events from their
// festival plan and the markup, then logs each backer they agreed a piece with.
// Each backer becomes a normal staking deal (a Backer and a StakePackage), the
// sessions started from those events carry their stake, and each backer can get
// a private link to confirm the agreed piece (sweatbook.poker/o/<id>).
//
// Nothing is sold or paid through the app: no public offer, no reservations, no
// payment (store policy: /mnt/project-files/research/politicas-lojas-jogo.md §3).
// Contract with the web page: /mnt/project-files/staking/pacotes-festival-spec.md.
// Kept apart from the main store like the festival plan: small and per device.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { eventTitle, venueTime, type Festival, type FestivalEvent } from '@/poker/festivals';
import { stakeCost, stakePrize } from '@/store/staking';
import { stakesOf } from '@/store/session-math';
import type { Backer, Session, Stake, StakePackage } from '@/store/types';

export const MARKUPS = [1, 1.05, 1.1, 1.15, 1.2, 1.3];
export const PIECES = [1, 2, 5, 10, 20];
export const MAX_EVENTS = 40;

/** One backer's agreed piece of the package: the same % of every event in it. */
export interface PackageLine {
  id: string;
  backerId: string;
  /** The staking package this line created (markup and name come from the festival package). */
  packageId: string;
  pct: number;
  /** The backer has paid for the piece (marked by the player; paid outside the app). */
  paid?: boolean;
  /** Events already marked not played when the piece was marked paid: never paid for, so nothing goes back. */
  paidSkipped?: string[];
  /** The private confirmation link, once sent. */
  remote?: { id: string; token: string; url: string };
  /** When the backer confirmed these terms on the link (ISO), null/undefined until then. */
  confirmedAt?: string | null;
}

export interface ActionOffer {
  id: string;
  festivalId: string;
  /** Events in the package (ids from the festival). Day 2s are never in it. */
  events: string[];
  markup: number;
  lines: PackageLine[];
  /** Events the player said they didn't play (asked a day after an event with no session). */
  skipped?: string[];
  createdAt: number;
  updatedAt?: number;
}

/** The private link's payload (spec: Agreement, v 1). Rebuilt field by field on the server too. */
export interface AgreementPayload {
  v: 1;
  player: string;
  backer: string;
  title: string;
  cur: string;
  markup: number;
  events: { id: string; n: string; d: number; b: number; p: number }[];
  at: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/** A name as the server keeps it: control characters as spaces, trimmed, cut. */
const clean = (s: string, n: number) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

export function newOffer(f: Festival, picked: string[], id: string, now = Date.now()): ActionOffer {
  const events = f.events.filter((e) => picked.includes(e.id) && !e.day2).map((e) => e.id);
  return { id, festivalId: f.id, events, markup: 1.1, lines: [], createdAt: now };
}

/** The events in the package, in schedule order. */
export function offerEvents(f: Festival, o: ActionOffer): FestivalEvent[] {
  const set = new Set(o.events);
  return f.events.filter((e) => !e.day2 && set.has(e.id));
}

export function soldPct(o: ActionOffer): number {
  return r2(o.lines.reduce((a, l) => a + l.pct, 0));
}

/** What one backer's piece costs them: their % of every buy-in, with the markup. */
export function lineCost(f: Festival, o: ActionOffer, pct: number): number {
  return r2((offerEvents(f, o).reduce((a, e) => a + e.buyIn, 0) * pct * o.markup) / 100);
}

export function offerTotals(f: Festival, o: ActionOffer) {
  const buyIns = offerEvents(f, o).reduce((a, e) => a + e.buyIn, 0);
  const sold = soldPct(o);
  const face = (buyIns * sold) / 100;
  const price = face * o.markup;
  return {
    events: offerEvents(f, o).length,
    buyIns,
    sold,
    /** What the backers pay the player, in total. */
    price: r2(price),
    /** What the markup earns the player. */
    premium: r2(price - face),
    /** What the player still puts in. */
    outOfPocket: r2(buyIns - price),
    keep: r2(100 - sold),
  };
}

export function agreement(f: Festival, o: ActionOffer, line: PackageLine, player: string, backer: string, title: string, now = Date.now()): AgreementPayload {
  return {
    v: 1,
    player: clean(player, 40),
    backer: clean(backer, 40),
    title: clean(title, 60),
    cur: f.currency.slice(0, 4),
    markup: r2(o.markup),
    events: offerEvents(f, o)
      .slice(0, MAX_EVENTS)
      .map((e) => ({ id: e.id, n: (eventTitle(e) + (e.flight ? ` · Flight ${e.flight}` : '')).slice(0, 80), d: venueTime(f, e.start), b: e.buyIn, p: r2(line.pct) })),
    at: now,
  };
}

/**
 * The link holds these terms: what the backer confirmed there is what this phone shows. Compared as
 * the server keeps them (to the cent), names aside: a backer renamed here confirmed the same deal
 * (Pronto P2-A, 19 Oct). Anything else (a change the server refused, one not sent yet) and a
 * confirmation there is of other terms.
 */
export function sameTerms(link: unknown, mine: AgreementPayload): boolean {
  if (!link || typeof link !== 'object') return false;
  const a = link as Partial<AgreementPayload>;
  const ev = (e: { id: string; d: number; b: number; p: number }) => `${e.id}|${Math.round(e.d)}|${r2(e.b)}|${r2(e.p)}`;
  return (
    typeof a.markup === 'number' &&
    r2(a.markup) === r2(mine.markup) &&
    a.cur === mine.cur &&
    Array.isArray(a.events) &&
    // The server keeps them by date: compared as sets.
    a.events.map(ev).sort().join(',') === mine.events.map(ev).sort().join(',')
  );
}

/**
 * A new line: the backer you already have with that name (or a new one) and a
 * staking package with the festival package's markup.
 */
export function lineRecords(name: string, backers: Backer[], title: string, o: ActionOffer, pct: number, ids: { line: string; backer: string; pkg: string }, now = Date.now()) {
  const known = backers.find((b) => b.name.trim().toLowerCase() === name.trim().toLowerCase());
  const backer: Backer = known ?? { id: ids.backer, name: name.trim(), note: '', createdAt: now };
  const pkg: StakePackage = { id: ids.pkg, backerId: backer.id, name: title, kind: 'action', share: pct, markup: o.markup, playerCut: 0, createdAt: now };
  const line: PackageLine = { id: ids.line, backerId: backer.id, packageId: pkg.id, pct };
  return { backer, isNew: !known, pkg, line };
}

/**
 * What this backer usually takes: the % and markup of their newest deal, a festival piece
 * (its staking package) or a piece sold on its own, so a repeat backer is one tap.
 */
export function usualTerms(backerId: string, packages: StakePackage[], sessions: Session[]): { pct: number; markup: number } | null {
  let best: { at: number; pct: number; markup: number } | null = null;
  for (const p of packages) if (p.backerId === backerId && p.kind === 'action' && p.share > 0 && (!best || p.createdAt > best.at)) best = { at: p.createdAt, pct: p.share, markup: p.markup || 1 };
  for (const s of sessions)
    for (const x of s.stakes ?? [])
      if (x.backerId === backerId && !x.packageId && x.share > 0 && (!best || s.startedAt > best.at)) best = { at: s.startedAt, pct: x.share, markup: x.markup || 1 };
  return best && { pct: best.pct, markup: best.markup };
}

/**
 * The piece's payment covers this event: marked paid, and the event wasn't already «Não joguei» then.
 * One skipped before paying and played after all was never paid for (QA P1, 19 Oct).
 */
export function covers(line: PackageLine, eventId: string): boolean {
  return !!line.paid && !(Array.isArray(line.paidSkipped) && line.paidSkipped.includes(eventId));
}

/** The backers' stakes for a session started from this event. Pieces not paid for it count against the backer. */
export function stakesFor(offers: ActionOffer[], festivalId: string, eventId: string): Stake[] {
  const out: Stake[] = [];
  for (const o of offers) {
    if (o.festivalId !== festivalId || !o.events.includes(eventId)) continue;
    for (const l of o.lines) out.push({ backerId: l.backerId, packageId: l.packageId, share: l.pct, markup: o.markup, unpaid: covers(l, eventId) ? undefined : true });
  }
  return out;
}

/** A day after an event starts with no session, the player is asked whether they played it. */
const ASK_AFTER = 24 * 3600e3;

/** Not played: the player said so and no session carries it. Never inferred. */
function missed(o: ActionOffer, e: FestivalEvent, started: Record<string, string>): boolean {
  return !started[e.id] && !!o.skipped?.includes(e.id);
}

/** The next event a backer has a piece of that hasn't started: its title and the venue's wall clock. */
export function nextEventFor(
  festivals: Festival[],
  offers: ActionOffer[],
  backerId: string,
  started: (festivalId: string) => Record<string, string>,
  now = Date.now(),
): { n: string; s: string } | null {
  let next: { n: string; s: string; t: number } | null = null;
  for (const o of offers) {
    if (!o.lines.some((l) => l.backerId === backerId && l.pct > 0)) continue;
    const f = festivals.find((x) => x.id === o.festivalId);
    if (!f) continue;
    const done = started(f.id);
    for (const e of offerEvents(f, o)) {
      const at = venueTime(f, e.start);
      if (done[e.id] || o.skipped?.includes(e.id) || at < now) continue;
      if (!next || at < next.t) next = { n: eventTitle(e), s: e.start, t: at };
    }
  }
  return next && { n: next.n, s: next.s };
}

/** Events that went by with no session and no answer yet: "Não jogaste o Evento X?". */
export function unanswered(f: Festival, o: ActionOffer, started: Record<string, string>, now = Date.now()): FestivalEvent[] {
  return offerEvents(f, o).filter((e) => !started[e.id] && !o.skipped?.includes(e.id) && venueTime(f, e.start) + ASK_AFTER < now);
}

/** One backer's piece of one event: its cost at the markup. */
function eventPiece(o: ActionOffer, e: FestivalEvent, pct: number): number {
  return (e.buyIn * pct * o.markup) / 100;
}

/**
 * What a backer still owes for a piece no session carries yet: the events of the
 * package not started, at the piece's cost. Once a session starts, its stake
 * (unpaid until the line is marked paid) carries that event instead. Events
 * the player said they didn't play aren't charged.
 */
export function pendingCost(f: Festival, o: ActionOffer, line: PackageLine, started: Record<string, string>): number {
  return r2(
    offerEvents(f, o)
      .filter((e) => !started[e.id] && !missed(o, e, started) && !covers(line, e.id))
      .reduce((a, e) => a + eventPiece(o, e, line.pct), 0),
  );
}

/** A paid piece of events the player said they didn't play: that money goes back to the backer. */
export function missedRefund(f: Festival, o: ActionOffer, line: PackageLine, started: Record<string, string>): number {
  return r2(
    offerEvents(f, o)
      .filter((e) => missed(o, e, started) && covers(line, e.id))
      .reduce((a, e) => a + eventPiece(o, e, line.pct), 0),
  );
}

export type SettlementState = 'cashed' | 'busted' | 'live' | 'upcoming' | 'waiting' | 'missed';

export interface SettlementRow {
  event: FestivalEvent;
  state: SettlementState;
  /** The backer's piece of it, at the markup (0 when not played). */
  cost: number;
  /** Their share of the prize (ended sessions). */
  prize: number;
}

/**
 * Where one backer stands on the festival: their prize share of each event, what
 * the piece cost and whether it was paid, refunds for events not played, and
 * what is left to send. `net` > 0: the player sends it to the backer; < 0: the
 * backer sends it to the player. Matches what the package adds to their staking
 * balance (pendingCost, missedRefund and the sessions' stakes).
 */
export function lineSettlement(f: Festival, o: ActionOffer, line: PackageLine, started: Record<string, string>, sessions: Session[], now = Date.now()) {
  const rows: SettlementRow[] = offerEvents(f, o).map((e) => {
    const s = started[e.id] ? sessions.find((x) => x.id === started[e.id]) : undefined;
    const x = s && stakesOf(s).find((y) => y.packageId === line.packageId);
    if (s && x) {
      const prize = s.endedAt ? stakePrize(s, x) : 0;
      return { event: e, state: !s.endedAt ? 'live' : prize > 0 ? 'cashed' : 'busted', cost: stakeCost(s, x), prize };
    }
    if (missed(o, e, started)) return { event: e, state: 'missed', cost: 0, prize: 0 };
    // Gone by with no session and no answer yet: still charged, until the player says.
    const waiting = venueTime(f, e.start) + ASK_AFTER < now;
    return { event: e, state: waiting ? 'waiting' : 'upcoming', cost: eventPiece(o, e, line.pct), prize: 0 };
  });
  const prizes = r2(rows.reduce((a, r) => a + r.prize, 0));
  const cost = r2(rows.reduce((a, r) => a + r.cost, 0));
  // What the payment didn't cover: all of it unpaid, or an event skipped before paying and played after.
  const owed = r2(rows.filter((r) => !covers(line, r.event.id)).reduce((a, r) => a + r.cost, 0));
  const paid = !!line.paid && owed < 0.005;
  const refund = missedRefund(f, o, line, started);
  return {
    rows,
    prizes,
    /** The piece's cost when paid; what is still to pay otherwise. */
    cost: paid ? cost : owed,
    paid,
    refund,
    net: r2(prizes + refund - owed),
    /** Every event ended or not played (as the player said): the numbers won't change. */
    done: rows.every((r) => r.state === 'cashed' || r.state === 'busted' || r.state === 'missed'),
    live: rows.filter((r) => r.state === 'live').length,
    upcoming: rows.filter((r) => r.state === 'upcoming').length,
    /** Events gone by with no session that the player hasn't answered for yet. */
    waiting: rows.filter((r) => r.state === 'waiting').length,
  };
}

export type LineSettlement = ReturnType<typeof lineSettlement>;

/** "Acerto com {backer}": when to remind the player to answer for an event with no session. */
export interface SettleReminder {
  offerId: string;
  eventId: string;
  at: number;
}

/** Local 13:00 (device time) on or after `t`: outside the quiet hours (23:00-12:00). */
function nextOnePm(t: number): number {
  const d = new Date(t);
  d.setHours(13, 0, 0, 0);
  if (d.getTime() < t) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/**
 * The settlement reminders to schedule: per package, the next event with no
 * session and no answer, at 13:00 once it can be asked about (an overdue one
 * not reminded yet: the next 13:00). `sent` holds when each was scheduled
 * (`offerId:eventId`): one gone by is never repeated. One a day at most.
 */
export function settleReminders(
  items: { f: Festival; o: ActionOffer; started: Record<string, string> }[],
  now = Date.now(),
  sent: Record<string, number> = {},
): SettleReminder[] {
  const next: SettleReminder[] = [];
  for (const { f, o, started } of items) {
    if (!o.lines.length) continue;
    const e = offerEvents(f, o).find((x) => !started[x.id] && !o.skipped?.includes(x.id) && !(sent[`${o.id}:${x.id}`] <= now));
    if (e) next.push({ offerId: o.id, eventId: e.id, at: nextOnePm(Math.max(venueTime(f, e.start) + ASK_AFTER, now)) });
  }
  const days = new Set<string>();
  return next
    .sort((a, b) => a.at - b.at)
    .filter((r) => {
      const d = new Date(r.at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (days.has(key)) return false;
      days.add(key);
      return true;
    });
}

/**
 * A backer's festival pieces still to pay for, in these currencies: what «Marcar como pago» marks paid
 * when only festival action with no rate is left (QA P2, 19 Oct). Paid outside the app, in the
 * festival's currency, like the package screen's own «Marcar como pago». Only packages with no event
 * started: there, what is pending is the whole piece (Voz P2, 19 Oct).
 */
export function unpaidLinesIn(
  offers: ActionOffer[],
  backerId: string,
  currencies: string[],
  festival: (id: string) => Festival | undefined,
  started: (festivalId: string) => Record<string, string>,
): { offerId: string; lineId: string; currency: string; due: number }[] {
  const out: { offerId: string; lineId: string; currency: string; due: number }[] = [];
  for (const o of offers) {
    const f = festival(o.festivalId);
    if (!f || !currencies.includes(f.currency)) continue;
    // A session already carries part of the piece: its stake changes too, so that is the package screen's job.
    const st = started(f.id);
    if (offerEvents(f, o).some((e) => st[e.id])) continue;
    for (const l of o.lines) {
      const due = l.backerId === backerId ? pendingCost(f, o, l, st) : 0;
      if (due > 0) out.push({ offerId: o.id, lineId: l.id, currency: f.currency, due });
    }
  }
  return out;
}

/** The backer has a piece in a festival package: deleting them would leave it counting, and its link open. */
export function inFestivalPackage(offers: ActionOffer[], backerId: string): boolean {
  return offers.some((o) => o.lines.some((l) => l.backerId === backerId));
}

/** Packages these offers created: their stakes on a session are replaced, the rest kept. */
export function offerPackageIds(offers: ActionOffer[]): Set<string> {
  return new Set(offers.flatMap((o) => o.lines.map((l) => l.packageId)));
}

/**
 * Puts the offer's stakes on a session, replacing the ones it put there before
 * (same package) and keeping any the player added by hand.
 */
export function withOfferStakes(existing: Stake[] | undefined, fromOffer: Stake[], packageIds: Set<string>): Stake[] {
  return [...(existing ?? []).filter((x) => !x.packageId || !packageIds.has(x.packageId)), ...fromOffer];
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const KEY = 'rl.actionOffers.v2';
type Offers = Record<string, ActionOffer>;

let offers: Offers = {};
let list: ActionOffer[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  list = Object.values(offers).sort((a, b) => a.createdAt - b.createdAt);
  for (const l of listeners) l();
}

function load(): Promise<void> {
  loading ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      offers = { ...JSON.parse(raw), ...offers };
      emit();
    })
    .catch(() => {});
  return loading;
}

function subscribe(l: () => void) {
  void load();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getOffers(): ActionOffer[] {
  void load();
  return list;
}

/** Every package, once the stored ones are read (getOffers may still be empty right after launch). */
export async function storedOffers(): Promise<ActionOffer[]> {
  await load();
  return list;
}

export function saveOffer(o: ActionOffer) {
  offers = { ...offers, [o.id]: { ...o, updatedAt: Date.now() } };
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(offers)).catch(() => {});
}

export function updateOffer(id: string, fn: (o: ActionOffer) => ActionOffer) {
  const o = offers[id];
  if (o) saveOffer(fn(o));
}

export function updateLine(offerId: string, lineId: string, fn: (l: PackageLine) => PackageLine) {
  updateOffer(offerId, (o) => ({ ...o, lines: o.lines.map((l) => (l.id === lineId ? fn(l) : l)) }));
}

/**
 * Marks a piece paid or not. What the backer pays leaves out the events already not played
 * (pendingCost), so those are remembered and never refunded (Voz P2, 19 Oct).
 */
export function setLinePaid(offerId: string, lineId: string, paid: boolean, started: Record<string, string>) {
  updateOffer(offerId, (o) => ({
    ...o,
    lines: o.lines.map((l) => (l.id === lineId ? { ...l, paid, paidSkipped: paid ? paidSkippedNow(o, started) : undefined } : l)),
  }));
}

/** Events not played as things stand (skipped, no session): one skipped by mistake and played since was paid for too. */
export function paidSkippedNow(o: ActionOffer, started: Record<string, string>): string[] | undefined {
  const out = (o.skipped ?? []).filter((id) => !started[id]);
  return out.length ? out : undefined;
}

export function deleteOffer(id: string) {
  const { [id]: _, ...rest } = offers;
  offers = rest;
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(offers)).catch(() => {});
}

/** "Delete all my data": forget every package (the links are deleted through the outbox first). */
export async function clearOffers() {
  // After the stored list is read, so a load still in flight can't bring them back.
  await load();
  offers = {};
  emit();
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

export function useOffers(): ActionOffer[] {
  return useSyncExternalStore(subscribe, () => list, () => list);
}
