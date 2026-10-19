// Web (and anything without a native lock screen): nothing to show. The real
// implementations are activity.ios.tsx (Live Activity) and
// activity.android.tsx (ongoing notification).

import type { LiveProps } from './live-state';

export async function showSession(_props: LiveProps): Promise<void> {}

export async function endSession(): Promise<void> {}
