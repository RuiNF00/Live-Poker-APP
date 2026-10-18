// Android needs Firebase for a push token (google-services.json); without it there's none and the
// comment switch would look on while doing nothing, so it hides until this device can get one.
// The FCM token alone, asked once per run: no permission needed and nothing goes to Expo.

import { useEffect, useState } from 'react';

import { notifications } from './lock-screen/reminder';

let ready: Promise<boolean> | undefined;

export function commentPushReady(): Promise<boolean> {
  const n = notifications();
  if (!n) return Promise.resolve(false);
  ready ??= n
    .getDevicePushTokenAsync()
    .then((tok) => !!tok.data)
    .catch(() => false);
  return ready;
}

/** False until the token came back, so the switch never shows and then vanishes. */
export function useCommentPushReady(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    void commentPushReady().then(setOk);
  }, []);
  return ok;
}
