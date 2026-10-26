// Two phones with the same cloud code: before one replaces the server copy, it
// joins in what the other wrote there. Same rule as a restore: the newer copy
// of each item wins, and what either phone deleted stays deleted unless it was
// edited after. Pure, so it can be tested.

import type { Festival } from '@/poker/festivals';

import { mergeById, type BackupData } from './backup';
import { emptyDuplicates, rehome, rehomeDeleted, separateBankrolls } from './bankroll-math';
import { alive, joinDeleted } from './deleted-math';
import { mergePlan, type FestivalPlan } from './festival-plan';
import { mergeGroups } from './swap-groups';
import { mergeSwaps } from './swaps';

const LISTS = ['hands', 'sessions', 'players', 'backers', 'packages', 'payments', 'backing', 'bankrolls', 'transfers', 'trips'] as const;

/** What goes up: this phone's backup with the server copy's items joined in. This phone's settings stay. */
export function mergeBackups(local: BackupData, remote: BackupData, now = Date.now()): BackupData {
  // Same bankroll id in two currencies: the server copy's takes its own id (bankroll-math.ts).
  remote = separateBankrolls(local.bankrolls ?? [], remote);
  const out: BackupData = { ...local };
  const deleted = joinDeleted(local.deleted, remote.deleted);
  out.deleted = deleted;
  for (const k of LISTS) (out as unknown as Record<string, unknown[]>)[k] = alive(mergeById((local[k] ?? []) as { id: string }[], (remote[k] ?? []) as { id: string }[]).list, k, deleted);
  // What this phone still had in a bankroll the other deleted moves to another in its currency (bankroll-math.ts).
  const before = mergeById(local.bankrolls ?? [], remote.bankrolls ?? []).list;
  const moved = rehomeDeleted(before, out.bankrolls ?? [], out.sessions, out.transfers ?? [], now, remote.bankrolls ?? []);
  out.bankrolls = moved.bankrolls;
  out.sessions = rehome(out.sessions, moved.to, now);
  out.transfers = rehome(out.transfers ?? [], moved.to, now);
  // The empty copies older syncs multiplied leave the server copy too, or each upload brings them back
  // (the same ones each phone drops on load, so no delete mark).
  const extra = emptyDuplicates(out.bankrolls ?? [], out.sessions, out.transfers ?? [], local.settings?.bankrollId);
  if (extra.length) out.bankrolls = out.bankrolls?.filter((b) => !extra.includes(b.id));
  out.swaps = mergeSwaps(local.swaps ?? [], remote.swaps ?? []).list;
  out.swapGroups = mergeGroups(local.swapGroups ?? [], remote.swapGroups ?? []).list;
  const plans: Record<string, FestivalPlan> = { ...local.festivalPlans };
  for (const [id, p] of Object.entries(remote.festivalPlans ?? {})) plans[id] = mergePlan(plans[id], p);
  out.festivalPlans = plans;
  // The later save of each (with no save times, this phone's copy stays), less what was deleted after it.
  out.ownFestivals = alive(mergeById<Festival>(local.ownFestivals ?? [], remote.ownFestivals ?? []).list, 'ownFestivals', deleted);
  out.weekly = alive(mergeById(local.weekly ?? [], remote.weekly ?? []).list, 'weekly', deleted);
  const q = local.quarantine ?? [];
  const more = (remote.quarantine ?? []).filter(([k]) => !q.some(([have]) => have === k));
  if (q.length || more.length) out.quarantine = [...q, ...more];
  return out;
}

/**
 * The server copy was written by another phone (or restored elsewhere) since this one last wrote or read it.
 * A phone that last copied before `sent` existed can't tell: the copy is taken as its own, so its first
 * upload after updating doesn't bring back what was deleted here since.
 */
export function writtenElsewhere(remote: Pick<BackupData, 'exportedAt'>, sent: number | undefined): boolean {
  return sent !== undefined && remote.exportedAt !== sent;
}

/** Everything with an id and an edit time that two devices join by id (bankrolls apart: see aheadOf). */
const SYNCED = ['hands', 'sessions', 'players', 'backers', 'packages', 'payments', 'backing', 'transfers', 'trips', 'ownFestivals', 'weekly', 'swaps', 'swapGroups'] as const;

/**
 * Does `data` hold something the server copy doesn't: an item it lacks, a later edit of one, a delete
 * it doesn't have yet, a festival pick or a set-aside value? Only what moves forward counts, never
 * what the copy has more of or the settings (each device keeps its own), so two devices that both
 * joined the same copies agree there is nothing to send and stop: a change goes up once, not back
 * and forth. Bankrolls are compared after the server copy's take this phone's names (separateBankrolls),
 * as the merge does. Pure, so it can be tested.
 */
export function aheadOf(data: BackupData, remote: BackupData): boolean {
  const there = separateBankrolls(data.bankrolls ?? [], remote);
  for (const k of [...SYNCED, 'bankrolls'] as const) {
    const have = new Map(((there[k] ?? []) as { id: string; updatedAt?: number }[]).map((x) => [x.id, x.updatedAt ?? 0]));
    for (const x of (data[k] ?? []) as { id: string; updatedAt?: number }[]) {
      const at = have.get(x.id);
      if (at === undefined || (x.updatedAt ?? 0) > at) return true;
    }
  }
  for (const [k, at] of Object.entries(data.deleted ?? {})) if (!((there.deleted?.[k] ?? 0) >= at)) return true;
  for (const [id, p] of Object.entries(data.festivalPlans ?? {})) {
    const r = there.festivalPlans?.[id];
    if (!r) return true;
    const has = (list: string[] | undefined, x: string) => !!list?.includes(x);
    if (p.picked.some((x) => !has(r.picked, x)) || (p.removed ?? []).some((x) => !has(r.removed, x))) return true;
    if ((p.events ?? []).some((e) => !r.events?.some((x) => x.id === e.id))) return true;
    if (Object.entries(p.picks ?? {}).some(([x, at]) => Math.abs(at) > Math.abs(r.picks?.[x] ?? 0))) return true;
  }
  return (data.quarantine ?? []).some(([k]) => !there.quarantine?.some(([x]) => x === k));
}

export interface SyncPlan {
  /** Another device wrote the server copy since this one last did. */
  other: boolean;
  /** It has that device's work and this phone hasn't joined it in yet: bring it here (importData, sync). */
  join: boolean;
  /** What this phone would send: its own backup, with the server copy's items joined in when another device wrote it. */
  data: BackupData;
  /** data holds something the server copy doesn't (aheadOf). */
  ahead: boolean;
  /**
   * Whether to send it. Not when this phone's last upload was itself an answer to a read (echo) and
   * nothing was saved or deleted here since: two devices that each keep a slightly different copy
   * (an empty bankroll each keeps, say) would otherwise answer each other forever. What this phone
   * holds still goes up with the next change made on it.
   */
  push: boolean;
}

/**
 * What a device does with the server copy it just read (cloud-backup.ts syncCloud): join it in when
 * another device wrote it, and send back only what the copy lacks. `c` is the device's saved state
 * (cloud-code.ts). Pure, so two, three devices can be played out in a test.
 */
export function syncPlan(local: BackupData, remote: BackupData, c: { sent?: number; seen?: number; echo?: boolean; lastAt?: number }, now = Date.now()): SyncPlan {
  const other = writtenElsewhere(remote, c.sent);
  const data = other ? mergeBackups(local, remote, now) : local;
  const ahead = aheadOf(data, remote);
  return { other, join: other && remote.exportedAt !== c.seen, data, ahead, push: ahead && !(c.echo && other && !editedSince(local, c.lastAt ?? 0)) };
}

/** Was anything in `data` saved or deleted after `at` (this phone's last upload)? */
export function editedSince(data: BackupData, at: number): boolean {
  for (const k of [...SYNCED, 'bankrolls'] as const) if (((data[k] ?? []) as { updatedAt?: number }[]).some((x) => (x.updatedAt ?? 0) > at)) return true;
  return Object.values(data.deleted ?? {}).some((v) => v > at);
}
