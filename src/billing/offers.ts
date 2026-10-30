// When the app offers the Pro trial by itself, without the player hitting a
// limit. Pure so the rules can be tested; pro.tsx supplies the state.

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
