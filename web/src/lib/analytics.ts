// Optional product analytics. Every app and site event already lands in our
// own app_events table; when POSTHOG_KEY is set, the events route also
// forwards a copy to PostHog (EU by default). Without the key this does
// nothing. The copy carries no personal data: the random install id, the
// event and its small props, with free text and content ids dropped. It is sent from the
// server, so the player's IP address never reaches PostHog.

import type { AppEvent } from './store';

/**
 * Kept in our own table only: anything the player typed (the cancel note), and
 * ids that point at a person's content or invite (Security, 17 Oct).
 */
const PRIVATE = new Set(['note', 'share_id', 'shareId', 'ref', 'live_id', 'liveId', 'handle']);

export interface AnalyticsProvider {
  capture(e: AppEvent): Promise<void>;
}

export function posthog(key: string, host = 'https://eu.i.posthog.com'): AnalyticsProvider {
  return {
    async capture(e) {
      const props = Object.fromEntries(Object.entries(e.props).filter(([k]) => !PRIVATE.has(k)));
      await fetch(`${host.replace(/\/$/, '')}/i/v0/e/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          event: e.event,
          distinct_id: e.installId,
          properties: { ...props, platform: e.platform, $process_person_profile: false, $geoip_disable: true },
        }),
        signal: AbortSignal.timeout(3000),
      });
    },
  };
}

let provider: AnalyticsProvider | null | undefined;

/** The configured provider, or null when analytics is off. */
export function analytics(): AnalyticsProvider | null {
  if (provider === undefined) {
    const key = process.env.POSTHOG_KEY;
    provider = key ? posthog(key, process.env.POSTHOG_HOST || undefined) : null;
  }
  return provider;
}
