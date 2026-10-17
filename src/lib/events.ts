// First-party funnel events (no third-party SDK): anonymous install id, event
// name and a few props, sent to our own API. Fire-and-forget; failures are
// dropped so nothing here can break the app.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { anonId } from './share-api';
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
  | 'invite_claimed';

let install: Promise<string> | null = null;
export function installId(): Promise<string> {
  install ??= AsyncStorage.getItem(KEY)
    .then(async (v) => {
      if (v) return v;
      const id = anonId();
      await AsyncStorage.setItem(KEY, id);
      return id;
    })
    .catch(() => anonId());
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

export function track(event: FunnelEvent, props?: Record<string, string | number | boolean>) {
  if (__DEV__) return;
  installId()
    .then((id) =>
      fetch(`${API}/api/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event, installId: id, platform: Platform.OS, props }),
      }),
    )
    .catch(() => {});
}
