// Two phones with the same cloud code: before one replaces the server copy, it
// joins in what the other wrote there. Same rule as a restore: the newer copy
// of each item wins and nothing is dropped. Pure, so it can be tested.

import type { Festival } from '@/poker/festivals';

import { mergeById, type BackupData } from './backup';
import { mergePlan, type FestivalPlan } from './festival-plan';
import { mergeGroups } from './swap-groups';
import { mergeSwaps } from './swaps';

const LISTS = ['hands', 'sessions', 'players', 'backers', 'packages', 'payments', 'backing', 'bankrolls', 'transfers', 'trips'] as const;

/** What goes up: this phone's backup with the server copy's items joined in. This phone's settings stay. */
export function mergeBackups(local: BackupData, remote: BackupData): BackupData {
  const out: BackupData = { ...local };
  for (const k of LISTS) (out as unknown as Record<string, unknown[]>)[k] = mergeById((local[k] ?? []) as { id: string }[], (remote[k] ?? []) as { id: string }[]).list;
  out.swaps = mergeSwaps(local.swaps ?? [], remote.swaps ?? []).list;
  out.swapGroups = mergeGroups(local.swapGroups ?? [], remote.swapGroups ?? []).list;
  const plans: Record<string, FestivalPlan> = { ...local.festivalPlans };
  for (const [id, p] of Object.entries(remote.festivalPlans ?? {})) plans[id] = mergePlan(plans[id], p);
  out.festivalPlans = plans;
  const own: Festival[] = local.ownFestivals ?? [];
  out.ownFestivals = [...own, ...(remote.ownFestivals ?? []).filter((f) => !own.some((x) => x.id === f.id))];
  const weekly = local.weekly ?? [];
  out.weekly = [...weekly, ...(remote.weekly ?? []).filter((w) => !weekly.some((x) => x.id === w.id))];
  const q = local.quarantine ?? [];
  const more = (remote.quarantine ?? []).filter(([k]) => !q.some(([have]) => have === k));
  if (q.length || more.length) out.quarantine = [...q, ...more];
  return out;
}

/** The server copy was written by another phone (or restored elsewhere) since this one last wrote or read it. */
export function writtenElsewhere(remote: Pick<BackupData, 'exportedAt'>, sent: number | undefined): boolean {
  return remote.exportedAt !== sent;
}
