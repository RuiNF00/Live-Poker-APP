// First-party funnel events (no third-party SDK): anonymous install id, event
// name and a few props, sent to our own API. Fire-and-forget; failures are
// dropped so nothing here can break the app.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { anonId } from './share-api';
import { BRAND } from '@/theme';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;
const KEY = 'rl.install.v1';

export type FunnelEvent =
  | 'app_open'
  | 'hand_saved'
  | 'limit_hit'
  | 'paywall_shown'
  | 'purchase'
  | 'share_created'
  | 'story_shared';

let install: Promise<string> | null = null;
function installId() {
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
