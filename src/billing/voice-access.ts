// Which plan the voice needs, in one place. Rui's list (26 Oct): the voice goes in Plus, made for
// telling the hand after it's played. Today it is Pro, as PRO_ONLY.voiceHand says. When Plus exists,
// VOICE_PLAN becomes 'plus' and the player's plan comes with `isPlus`. Pro has everything Plus has.
import { PRO_ONLY } from './plans';

export type PlanTier = 'free' | 'plus' | 'pro';

export const VOICE_PLAN: PlanTier = PRO_ONLY.voiceHand ? 'pro' : 'free';

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
