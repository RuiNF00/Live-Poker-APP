// The Sentry SDK, on phones only (crash-sdk.ts keeps it out of the web bundle).
import { Directory, Paths } from 'expo-file-system';

export const loadSentry = () => import('@sentry/react-native');

/** Reports the native SDK queued on disk and hasn't sent yet (Android cache/sentry, iOS Caches/io.sentry). */
export function wipeSentryCache(): void {
  for (const name of ['sentry', 'io.sentry']) {
    try {
      const d = new Directory(Paths.cache, name);
      if (d.exists) d.delete();
    } catch {
      // Nothing there, or already gone.
    }
  }
}
