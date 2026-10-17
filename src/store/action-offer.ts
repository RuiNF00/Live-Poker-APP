// Selling action for a festival: the player picks events from their festival plan,
// the % of each one on sale, the markup and a per-backer cap, then shares one link
// (sweatbook.poker/o/<id>). Backers reserve a % on the web page; each reservation the
// player confirms becomes a normal staking deal (a Backer and a StakePackage), and
// the sessions started from those events carry the backers' stakes.
//
// Contract with the web page and the database: /mnt/project-files/staking/pacotes-festival-spec.md.
// Kept apart from the main store like the festival plan: small and per device.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { eventTitle, venueTime, type Festival, type FestivalEvent } from '@/poker/festivals';
import type { Backer, Stake, StakePackage } from '@/store/types';

export const MARKUPS = [1, 1.05, 1.1, 1.15, 1.2, 1.3];
export const SHARES = [10, 20, 30, 40, 50];
export const CAPS = [5, 10, 20, 100];
export const MAX_EVENTS = 40;

export type ReservationStatus = 'pending' | 'confirmed' | 'declined';

/** A backer's reservation, as the owner's GET returns it. */
export interface Reservation {
  id: string;
  name: string;
  contact?: string;
  shares: { e: string; p: number }[];
  status: ReservationStatus;
  createdAt: string;
}

/** What a confirmed reservation became in the player's staking. */
export interface Deal {
  backerId: string;
  packageId: string;
  /** The backer has paid for the piece. */
  paid?: boolean;
}

export interface ActionOffer {
  id: string;
  festivalId: string;
  /** Sold as a package: the same % of every event. */
  whole: boolean;
  /** % on sale of each event in the package (event id → %). Events at 0 aren't in it. */
  shares: Record<string, number>;
  markup: number;
  /** Most one backer can take of each event, in %. */
  cap: number;
  /** Smallest piece, in %. */
  min: number;
  closed?: boolean;
  /** Set once the link exists. */
  remote?: { id: string; token: string; url: string };
  /** Last list fetched from the server (owner view). */
  reservations?: Reservation[];
  /** Reservation id → staking deal, once confirmed. */
  deals: Record<string, Deal>;
  createdAt: number;
  updatedAt?: number;
}

/** The public payload (spec: Offer, v 1). Rebuilt field by field on the server too. */
export interface OfferPayload {
  v: 1;
  player: string;
  title: string;
  cur: string;
  markup: number;
  cap: number;
  min: number;
  whole: boolean;
  events: { id: string; n: string; d: number; b: number; s: number }[];
  closed: boolean;
  at: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function newOffer(f: Festival, picked: string[], id: string, now = Date.now()): ActionOffer {
  const shares: Record<string, number> = {};
  for (const e of f.events) if (picked.includes(e.id) && !e.day2) shares[e.id] = 30;
  return { id, festivalId: f.id, whole: true, shares, markup: 1.1, cap: 10, min: 1, deals: {}, createdAt: now };
}

/** The events in the package, in schedule order. Day 2s never have a buy-in to sell. */
export function offerEvents(f: Festival, o: ActionOffer): FestivalEvent[] {
  return f.events.filter((e) => !e.day2 && (o.shares[e.id] ?? 0) > 0);
}

/** Same % for every event in the package (used when switching to "whole"). */
export function setAllShares(o: ActionOffer, pct: number): ActionOffer {
  const shares: Record<string, number> = {};
  for (const k of Object.keys(o.shares)) shares[k] = pct;
  return { ...o, shares };
}

export function offerTotals(f: Festival, o: ActionOffer) {
  const list = offerEvents(f, o);
  const buyIns = list.reduce((a, e) => a + e.buyIn, 0);
  // Face value of what's on sale, and what backers pay for it with the markup.
  const face = list.reduce((a, e) => a + (e.buyIn * o.shares[e.id]) / 100, 0);
  const price = face * o.markup;
  return {
    events: list.length,
    buyIns,
    face: r2(face),
    price: r2(price),
    /** What the markup earns the player if everything sells. */
    premium: r2(price - face),
    /** What the player still puts in if everything sells. */
    outOfPocket: r2(buyIns - price),
    /** Share of the total buy-ins the player keeps (weighted by buy-in). */
    keep: buyIns ? r2(100 - (face / buyIns) * 100) : 100,
    /** Price of 1% of every event in a whole package. */
    perPct: r2((buyIns / 100) * o.markup),
  };
}

export function payload(f: Festival, o: ActionOffer, player: string, title: string, now = Date.now()): OfferPayload {
  return {
    v: 1,
    player: player.trim().slice(0, 40),
    title: title.trim().slice(0, 60),
    cur: f.currency.slice(0, 4),
    markup: r2(o.markup),
    cap: r2(o.cap),
    min: r2(Math.min(o.min, o.cap)),
    whole: o.whole,
    events: offerEvents(f, o)
      .slice(0, MAX_EVENTS)
      .map((e) => ({ id: e.id, n: (eventTitle(e) + (e.flight ? ` · Flight ${e.flight}` : '')).slice(0, 80), d: venueTime(f, e.start), b: e.buyIn, s: r2(o.shares[e.id]) })),
    closed: !!o.closed,
    at: now,
  };
}

/** What a reservation costs the backer. */
export function reservationPrice(f: Festival, o: ActionOffer, r: Pick<Reservation, 'shares'>): number {
  const byId = new Map(f.events.map((e) => [e.id, e]));
  return r2(r.shares.reduce((a, x) => a + ((byId.get(x.e)?.buyIn ?? 0) * x.p) / 100, 0) * o.markup);
}

/** % reserved per event, pending and confirmed together (what the web page calls "taken"). */
export function taken(rs: Reservation[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rs ?? []) if (r.status !== 'declined') for (const x of r.shares) out[x.e] = r2((out[x.e] ?? 0) + x.p);
  return out;
}

/** A whole package's reservation is the same % everywhere: show it as one number. */
export function reservationLabel(r: Pick<Reservation, 'shares'>): { pct: number | null; events: number } {
  const ps = new Set(r.shares.map((x) => x.p));
  return { pct: ps.size === 1 ? r.shares[0].p : null, events: r.shares.length };
}

/**
 * A confirmed reservation as staking records: the backer you already have with
 * that name (or a new one) and a package with the offer's markup.
 */
export function dealRecords(r: Reservation, backers: Backer[], title: string, markup: number, ids: { backer: string; pkg: string }, now = Date.now()) {
  const known = backers.find((b) => b.name.trim().toLowerCase() === r.name.trim().toLowerCase());
  const backer: Backer = known ?? { id: ids.backer, name: r.name.trim(), note: r.contact ?? '', createdAt: now };
  const label = reservationLabel(r);
  const pkg: StakePackage = { id: ids.pkg, backerId: backer.id, name: title, kind: 'action', share: label.pct ?? Math.max(...r.shares.map((x) => x.p)), markup, playerCut: 0, createdAt: now };
  return { backer, isNew: !known, pkg };
}

/**
 * The backers' stakes for a session started from this event: one per confirmed
 * reservation that covers it. Pieces not paid for yet count against the backer.
 */
export function stakesFor(offers: ActionOffer[], festivalId: string, eventId: string): Stake[] {
  const out: Stake[] = [];
  for (const o of offers) {
    if (o.festivalId !== festivalId) continue;
    for (const r of o.reservations ?? []) {
      const deal = o.deals[r.id];
      if (r.status !== 'confirmed' || !deal) continue;
      const piece = r.shares.find((x) => x.e === eventId);
      if (piece) out.push({ backerId: deal.backerId, packageId: deal.packageId, share: piece.p, markup: o.markup, unpaid: deal.paid ? undefined : true });
    }
  }
  return out;
}

/**
 * Puts the offer's stakes on a session, replacing the ones it put there before
 * (same package) and keeping any the player added by hand.
 */
export function withOfferStakes(existing: Stake[] | undefined, fromOffer: Stake[], packageIds: Set<string>): Stake[] {
  return [...(existing ?? []).filter((x) => !x.packageId || !packageIds.has(x.packageId)), ...fromOffer];
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const KEY = 'rl.actionOffers.v1';
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

export function deleteOffer(id: string) {
  const { [id]: _, ...rest } = offers;
  offers = rest;
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(offers)).catch(() => {});
}

export function useOffers(): ActionOffer[] {
  return useSyncExternalStore(subscribe, () => list, () => list);
}
