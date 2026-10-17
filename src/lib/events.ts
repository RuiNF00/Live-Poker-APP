// First-party funnel events (no third-party SDK): anonymous install id, event
// name and a few props, sent to our own API. Fire-and-forget; failures are
// dropped so nothing here can break the app.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { attribution, profile } from './attribution';
import { anonId } from './share-api';
import { outcomeOf, queue, registerSender } from './sync';
import { BRAND } from '@/theme';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const KEY = 'rl.install.v1';
const REF_KEY = 'rl.ref.v1';

export type FunnelEvent =
  | 'app_open'
  | 'hand_saved'
  | 'limit_hit'
  | 'paywall_shown'
  | 'purchase'
  | 'share_created'
  | 'story_shared'
  | 'link_shared'
  | 'link_opened'
  | 'invite_claimed'
  | 'cancel_flow'
  | 'onboarding_step'
  | 'paywall_closed'
  | 'trial_start'
  | 'lifetime_offer_shown'
  | 'lifetime_purchased';

// The install id also lives in the keychain, which survives deleting the app on iOS: a
// reinstall is the same install, so it can't claim the friend's 7 Pro days again.
// Loaded lazily so web and the Node tests never touch expo-secure-store.
type Keychain = Pick<typeof import('expo-secure-store'), 'getItemAsync' | 'setItemAsync'>;
function keychain(): Keychain | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-secure-store') as Keychain;
  } catch {
    return null;
  }
}
const KEYCHAIN_KEY = 'sweatbook.install.v1';

let install: Promise<string> | null = null;
/** Set when this launch created the install id: the very first open. */
let firstOpen = false;
export function installId(): Promise<string> {
  install ??= (async () => {
    const kc = keychain();
    const kept = kc ? await kc.getItemAsync(KEYCHAIN_KEY).catch(() => null) : null;
    const had = kept || (await AsyncStorage.getItem(KEY).catch(() => null));
    firstOpen = !had;
    const id = had || anonId();
    await AsyncStorage.setItem(KEY, id).catch(() => {});
    if (kc && kept !== id) await kc.setItemAsync(KEYCHAIN_KEY, id).catch(() => {});
    return id;
  })();
  return install;
}

let ref: Promise<string> | null = null;
/**
 * Short random referral code put on the links this install shares (`r=`), so a
 * new install can be credited to whoever sent the link. Separate from the
 * install id, which never appears in a URL.
 */
export function refCode(): Promise<string> {
  ref ??= AsyncStorage.getItem(REF_KEY)
    .then(async (v) => {
      if (v) return v;
      const code = anonId().replace(/-/g, '').slice(0, 10);
      await AsyncStorage.setItem(REF_KEY, code);
      return code;
    })
    .catch(() => anonId().replace(/-/g, '').slice(0, 10));
  return ref;
}

/** Adopt the server's code when it differs (e.g. it was assigned before ours was registered). */
export async function setRefCode(code: string): Promise<void> {
  ref = Promise.resolve(code);
  await AsyncStorage.setItem(REF_KEY, code).catch(() => {});
}

/** Events that carry where the install came from and what was going on (attribution.ts). */
const ATTRIBUTED: FunnelEvent[] = ['app_open', 'hand_saved', 'trial_start'];
/** Paywall events that carry the onboarding answers, to split the funnel by player type. */
const PROFILED: FunnelEvent[] = ['paywall_shown', 'paywall_closed', 'trial_start', 'purchase'];

export function track(event: FunnelEvent, props?: Record<string, string | number | boolean>) {
  if (__DEV__) return;
  // Queued on the phone and sent when there's signal: card rooms often have none.
  installId()
    .then(async (id) => {
      let all = props;
      if (ATTRIBUTED.includes(event)) {
        const first = event === 'app_open' && firstOpen;
        // First open from a link: give the link screen a moment to note its source.
        if (first) await new Promise((r) => setTimeout(r, 2000));
        all = { ...props, ...(await attribution()), ...(first ? { first: true } : {}) };
      }
      if (PROFILED.includes(event)) all = { ...all, ...(await profile()) };
      queue('event', { event, installId: id, platform: Platform.OS, props: all });
    })
    .catch(() => {});
}

registerSender('event', async (body) => {
  const res = await fetch(`${API}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return outcomeOf(res.status);
});
