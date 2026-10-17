import { voterId } from './local';

const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

/** Web side of the funnel (share_viewed, store_click, landing_view). Never throws, never blocks navigation. */
export function track(event: 'share_viewed' | 'store_click' | 'landing_view', props: Record<string, string | number | boolean> = {}) {
  try {
    const q = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const k of UTM) {
      const v = q.get(k);
      if (v) utm[k] = v;
    }
    // Sharer's invite code from the app's links (?r=), so views and store clicks tie back to them.
    const r = q.get('r');
    if (r && /^[0-9A-Za-z]{6,12}$/.test(r)) utm.ref = r;
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    const body = JSON.stringify({
      event,
      installId: voterId(),
      platform: 'web',
      props: { ...utm, ...(host && host !== window.location.hostname ? { from_host: host } : {}), ...props },
    });
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/events', blob)) {
      fetch('/api/events', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  } catch {}
}
