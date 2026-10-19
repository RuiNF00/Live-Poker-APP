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
