'use client';

import { useEffect, useState } from 'react';
import { appHref } from '@/lib/app-link';

/**
 * "Open in app" for a phone that already has it. A tapped link opens the app on its own (universal
 * link / App Link), but Instagram's, Telegram's and other in-app browsers never hand it over, so this
 * opens it by its scheme. Phones only: on a computer there is no app to open.
 */
export function OpenInApp({ path, invite, label }: { path: string; invite: string | null; label: string }) {
  const [phone, setPhone] = useState<'ios' | 'android' | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    setPhone(/Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : null);
  }, []);
  if (!phone) return null;
  return (
    <a className="cta-open" href={appHref(`${path}${invite ? `?r=${encodeURIComponent(invite)}` : ''}`, phone === 'android')}>
      {label}
    </a>
  );
}
