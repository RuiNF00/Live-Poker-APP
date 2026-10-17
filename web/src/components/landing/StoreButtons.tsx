'use client';

import { useEffect, useState } from 'react';
import type { LandingCopy } from './copy';

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

function AppleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.6 1.3-.1 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.2 3-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1ZM14 5.4c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z"
      />
    </svg>
  );
}

function PlayLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M4 2.6v18.8c0 .5.5.8 1 .6l10.6-10-10.6-10c-.5-.2-1 .1-1 .6Zm12.8 8.2L6.9 1.5l11.9 6.8-2 2.5Zm0 2.4 2 2.5-11.9 6.8 9.9-9.3Zm2.9-4.3 2.5 1.4c.7.4.7 1 0 1.4l-2.5 1.4-2.3-2.1 2.3-2.1Z" />
    </svg>
  );
}

/** App Store and Google Play badges; on a phone, its own store comes first. */
export function StoreButtons({ c, stores }: { c: LandingCopy; stores: StoreLinks }) {
  const platform = usePlatform();
  const ios = (
    <a key="ios" className={`lp-store${stores.ios ? '' : ' soon'}`} href={stores.ios || '#baixar'}>
      <AppleLogo />
      <span>
        <small>{stores.ios ? c.getOn : c.soon}</small>
        <b>App Store</b>
      </span>
    </a>
  );
  const android = (
    <a key="android" className={`lp-store${stores.android ? '' : ' soon'}`} href={stores.android || '#baixar'}>
      <PlayLogo />
      <span>
        <small>{stores.android ? c.getOnPlay : c.soonPlay}</small>
        <b>Google Play</b>
      </span>
    </a>
  );
  return <div className="lp-stores">{platform === 'android' ? [android, ios] : [ios, android]}</div>;
}
