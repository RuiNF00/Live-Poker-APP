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
import type { Backer, Stake, StakePackage } from '@/store/types';

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
    player: player.trim().slice(0, 40),
    backer: backer.trim().slice(0, 40),
    title: title.trim().slice(0, 60),
    cur: f.currency.slice(0, 4),
    markup: r2(o.markup),
    events: offerEvents(f, o)
      .slice(0, MAX_EVENTS)
      .map((e) => ({ id: e.id, n: (eventTitle(e) + (e.flight ? ` · Flight ${e.flight}` : '')).slice(0, 80), d: venueTime(f, e.start), b: e.buyIn, p: r2(line.pct) })),
    at: now,
  };
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

/** The backers' stakes for a session started from this event. Pieces not marked paid count against the backer. */
export function stakesFor(offers: ActionOffer[], festivalId: string, eventId: string): Stake[] {
  const out: Stake[] = [];
  for (const o of offers) {
    if (o.festivalId !== festivalId || !o.events.includes(eventId)) continue;
    for (const l of o.lines) out.push({ backerId: l.backerId, packageId: l.packageId, share: l.pct, markup: o.markup, unpaid: l.paid ? undefined : true });
  }
  return out;
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
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  list = Object.values(offers).sort((a, b) => a.createdAt - b.createdAt);
  for (const l of listeners) l();
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      offers = { ...JSON.parse(raw), ...offers };
      emit();
    })
    .catch(() => {});
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getOffers(): ActionOffer[] {
  load();
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

export function deleteOffer(id: string) {
  const { [id]: _, ...rest } = offers;
  offers = rest;
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(offers)).catch(() => {});
}

export function useOffers(): ActionOffer[] {
  return useSyncExternalStore(subscribe, () => list, () => list);
}
