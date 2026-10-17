'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/config/brand';

/**
 * "Open in app" for a phone that already has it. A tapped link opens the app on its own (universal
 * link / App Link), but Instagram's, Telegram's and other in-app browsers never hand it over, so this
 * opens it by its scheme. Phones only: on a computer there is no app to open.
 */
export function OpenInApp({ path, invite, label }: { path: string; invite: string | null; label: string }) {
  const [phone, setPhone] = useState(false);
  useEffect(() => setPhone(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)), []);
  if (!phone) return null;
  return (
    <a className="cta-open" href={`${brand.appScheme}://${path}${invite ? `?r=${encodeURIComponent(invite)}` : ''}`}>
      {label}
    </a>
  );
}
