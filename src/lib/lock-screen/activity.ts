// Web (and anything without a native lock screen): nothing to show. The real
// implementations are activity.ios.tsx (Live Activity) and
// activity.android.tsx (ongoing notification).

import type { LiveProps } from './live-state';

export async function showSession(_props: LiveProps): Promise<void> {}

export async function endSession(): Promise<void> {}

export function onLockButton(_cb: (target: string) => void): () => void {
  return () => {};
}

export function onLiveToken(_cb: ((token: string) => void) | null): void {}
