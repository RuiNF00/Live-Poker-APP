// Which plan the voice needs. Rui's list (26 Oct): the voice goes in Plus, made for telling the hand
// after it's played. The plan comes from plans.ts (PLUS_UNLOCKS), so it changes in one place. Pro has
// everything Plus has.
import { tierFor } from './plans';

export type PlanTier = 'free' | 'plus' | 'pro';

export const VOICE_PLAN: PlanTier = tierFor('voiceHand');

const RANK: Record<PlanTier, number> = { free: 0, plus: 1, pro: 2 };

/** The player's plan as the voice sees it. */
export function playerPlan(p: { isPro: boolean; isPlus?: boolean }): PlanTier {
  return p.isPro ? 'pro' : p.isPlus ? 'plus' : 'free';
}

/** Telling a hand (or the session) by voice needs a plan this player doesn't have. Once the
 * entitlement hook answers `can('voiceHand')` (Plus or Pro), that answer wins. */
export function voiceLocked(p: { isPro: boolean; isPlus?: boolean; can?: (feature: 'voiceHand') => boolean }, need: PlanTier = VOICE_PLAN): boolean {
  if (p.can) return !p.can('voiceHand');
  return RANK[playerPlan(p)] < RANK[need];
}

/** The plan's name next to a locked «Voz»: «Voz · Pro», later «Voz · Plus». */
export function voicePlanName(need: PlanTier = VOICE_PLAN): string {
  return need === 'plus' ? 'Plus' : 'Pro';
}
