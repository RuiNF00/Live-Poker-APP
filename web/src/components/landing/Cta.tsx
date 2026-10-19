'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/track';
import { useStoreLink, type StoreLinks } from './StoreButtons';

/** The one big button: this phone's store, or the download section while stores aren't live. */
export function MainCta({ label, soon, stores, from, className = '', onClick }: { label: string; soon?: string; stores: StoreLinks; from: string; className?: string; onClick?: () => void }) {
  const href = useStoreLink(stores);
  // Before any store link: "Em breve", no download icon, since there is nothing to download yet.
  const early = !!soon && !stores.ios && !stores.android;
  return (
    <a
      className={`lp-btn main ${className}`}
      href={href}
      onClick={() => {
        onClick?.();
        track('store_click', { from, live: href !== '#baixar' });
      }}>
      {early ? null : <DownloadIcon />}
      {early ? soon : label}
    </a>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}

/**
 * Bottom bar on phones, like the app's action dock: shows once the hero button has scrolled
 * away, hides again at the download section so it never covers the store badges.
 */
export function StickyCta({ label, soon, note, stores }: { label: string; soon?: string; note: string; stores: StoreLinks }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('hero-cta');
    const end = document.getElementById('baixar');
    if (!hero || !end || !('IntersectionObserver' in window)) return;
    let heroOut = false;
    let endIn = false;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) heroOut = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === end) endIn = e.isIntersecting;
      }
      setShow(heroOut && !endIn);
    });
    io.observe(hero);
    io.observe(end);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`lp-sticky${show ? ' on' : ''}`} aria-hidden={!show}>
      <span className="lp-sticky-note">{note}</span>
      <MainCta label={label} soon={soon} stores={stores} from="sticky" />
    </div>
  );
}
