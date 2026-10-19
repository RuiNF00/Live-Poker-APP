// A reinstall opens two things by itself on the empty app: the offer to bring
// the cloud copy back (AutoCloudBackup) and the welcome flow (useOnboarding).
// The offer goes first; accepted, the welcome is skipped (the history is back),
// declined, it opens as on any first run. No imports: the hands list reads this
// at launch, before the backup code is loaded.

/**
 * unknown: not checked yet (AutoCloudBackup loads after the first frame).
 * none: nothing to offer, or not now (no signal): the welcome may open.
 * due: an offer is waiting for the lock to open, or on screen.
 */
export type RestoreOffer = 'unknown' | 'none' | 'due' | 'accepted' | 'declined';

let offer: RestoreOffer = 'unknown';
const subs = new Set<() => void>();

export const restoreOffer = {
  get: (): RestoreOffer => offer,
  /** The answer stands until the next launch: the checks after it find nothing due. */
  set(next: RestoreOffer) {
    if (next === offer || offer === 'accepted' || offer === 'declined') return;
    offer = next;
    subs.forEach((f) => f());
  },
  /** «Recuperar» was tapped but the copy didn't come down: the welcome opens after all (offered again next launch). */
  failed() {
    if (offer !== 'accepted') return;
    offer = 'declined';
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};

/** How long the welcome waits for the check before opening anyway. */
export const OFFER_WAIT_MS = 4000;

/** The welcome flow on a fresh install: open it, wait for the offer, or leave it out. */
export function welcomeStep(o: RestoreOffer, waitedOut: boolean): 'open' | 'wait' | 'skip' {
  if (o === 'accepted') return 'skip';
  if (o === 'due') return 'wait';
  // The check never answered (it failed to load): the first run still gets its welcome.
  if (o === 'unknown') return waitedOut ? 'open' : 'wait';
  return 'open';
}

/**
 * The offer on an empty app. `due`: a remembered code never offered on this
 * install. Never over the welcome: when it opened first (no signal at launch,
 * or the check came late), the offer waits for it to close.
 */
export function offerStep(p: { due: boolean; online: boolean; lockUp: boolean; welcomeUp: boolean }): 'ask' | 'wait' | 'later' | 'none' {
  if (!p.due) return 'none';
  if (p.welcomeUp) return 'later';
  // Nothing can be downloaded: the welcome goes ahead, the offer comes with the signal.
  if (!p.online) return 'later';
  if (p.lockUp) return 'wait';
  return 'ask';
}
