// When the app offers the Pro trial by itself, without the player hitting a
// limit. Pure so the rules can be tested; pro.tsx supplies the state.

import { PLANS, TIER_PLANS, type PlanId } from './plans';

export interface WelcomeOfferState {
  isPro: boolean;
  /** Hands saved on this install. */
  handsSaved: number;
  /** The welcome offer was already shown once. */
  shown: boolean;
  /** Trial days the store would give this player on the annual plan. */
  trialDays: number;
  /** Came through a friend's invite, so the first hand already brings Pro days. */
  invited: boolean;
}

/**
 * Once, right after the first saved hand: the player has just seen what the app
 * does, which is when a free trial lands best. Never to someone with Pro, an
 * invite reward on the way, or no trial left to offer.
 */
export function shouldOfferWelcome(s: WelcomeOfferState): boolean {
  return !s.isPro && !s.shown && !s.invited && s.handsSaved >= 1 && s.trialDays > 0;
}

/**
 * «Primeira mão feita» only when it is true: a player who brought years of hands (import, a backup
 * on a new phone) sees the plain Pro title instead.
 */
export function welcomeReason(handsSaved: number): 'welcome' | 'generic' {
  return handsSaved <= 3 ? 'welcome' : 'generic';
}

/** A switch to the yearly plan made from Settings: the monthly product and the end of its period then. */
export type AnnualSwitched = { product: string; ends: string };

/**
 * The yearly plan a monthly subscriber can switch to from Settings: the same tier's, while the
 * monthly renews, never during free days or with Pro paid once. On Google Play the switch replaces
 * the monthly product, so it needs that product's id (purchases.buy).
 */
export function annualSwitch<P extends { id: string }>(
  sub: { plan: PlanId; renews: boolean; trial?: boolean; product: string; ends?: string } | null,
  plans: readonly P[],
  o: { forGood: boolean; os: string; switched?: AnnualSwitched | null },
): P | undefined {
  if (!sub || !sub.renews || sub.trial || o.forGood) return undefined;
  // Already switched: the store keeps reporting the monthly until it renews into the yearly one.
  // Back only if the same monthly renews again (the switch didn't happen).
  if (o.switched && o.switched.product === sub.product && (!sub.ends || sub.ends <= o.switched.ends)) return undefined;
  const own = TIER_PLANS[PLANS[sub.plan].tier];
  if (sub.plan !== own.monthly || (o.os !== 'ios' && !sub.product)) return undefined;
  return plans.find((p) => p.id === own.annual);
}
