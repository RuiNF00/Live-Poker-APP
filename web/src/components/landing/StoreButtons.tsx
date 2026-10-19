'use client';

import { useEffect, useState } from 'react';
import type { LandingCopy } from './copy';
import type { Locale } from '@/lib/i18n';
import { track } from '@/lib/track';

export interface StoreLinks {
  ios: string;
  android: string;
}

type Platform = 'ios' | 'android' | 'other';

function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('other');
  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other');
  }, []);
  return platform;
}

/** The store for this phone, or the download section when the stores aren't live yet. */
export function useStoreLink(stores: StoreLinks) {
  const platform = usePlatform();
  if (platform === 'ios' && stores.ios) return stores.ios;
  if (platform === 'android' && stores.android) return stores.android;
  return '#baixar';
}

/**
 * The stores' official badges, only once the app is published there. Apple and Google don't
 * allow a redrawn badge (nor a "coming soon" one with their logo), so until a store link exists
 * the page shows plain text. At launch: put each official SVG, in the page's language and
 * unaltered (developer.apple.com/app-store/marketing/guidelines, play.google.com/intl/en_us/badges),
 * in web/public/badges/ and list it here by store and language.
 */
const BADGES: Record<'ios' | 'android', Partial<Record<Locale, string>>> = { ios: {}, android: {} };
const BADGE_NAME = { ios: 'App Store', android: 'Google Play' } as const;

/** App Store and Google Play badges; on a phone, its own store comes first. Before launch, one line of text. */
export function StoreButtons({
  c,
  stores,
  from,
  shareId,
}: {
  c: Pick<LandingCopy, 'soonBoth' | 'getOn' | 'getOnPlay' | 'lang'>;
  stores: StoreLinks;
  from: string;
  /** Kept for callers: there is no "coming soon" badge to link anywhere any more. */
  fallback?: string;
  shareId?: string;
}) {
  const platform = usePlatform();
  if (!stores.ios && !stores.android) return <p className="lp-stores-soon">{c.soonBoth}</p>;
  const badge = (store: 'ios' | 'android') => {
    const href = stores[store];
    if (!href) return null;
    const src = BADGES[store][c.lang] ?? BADGES[store].en;
    const label = `${store === 'ios' ? c.getOn : c.getOnPlay} ${BADGE_NAME[store]}`;
    return (
      <a key={store} className={src ? 'lp-badge' : 'lp-store'} href={href} onClick={() => track('store_click', { store, from, live: true, ...(shareId ? { shareId } : {}) })}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the store's own artwork, as published */}
        {src ? <img src={src} alt={label} height={52} /> : <span>{label}</span>}
      </a>
    );
  };
  const order: ('ios' | 'android')[] = platform === 'android' ? ['android', 'ios'] : ['ios', 'android'];
  return <div className="lp-stores">{order.map(badge)}</div>;
}

/** Counts a landing visit once per page load (top of the site → store funnel). */
export function LandingView() {
  useEffect(() => track('landing_view'), []);
  return null;
}
