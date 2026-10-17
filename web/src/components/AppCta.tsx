'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/config/brand';
import { t, type Locale } from '@/lib/i18n';
import { Mark, Wordmark } from './Brand';
import { track } from '@/lib/track';
import { storeLinks } from '@/lib/storeLinks';
import { StoreButtons } from './landing/StoreButtons';
import { landingCopy, REWARD_DAYS_PUBLIC } from './landing/copy';
import { writeLocal } from '@/lib/local';
import '@/app/landing.css';

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/** The acquisition hook: every viewer of a shared hand is a potential user. */
export function AppCta({ locale, shareId, invite }: { locale: Locale; shareId: string; invite: string | null }) {
  const d = t(locale);
  const [platform, setPlatform] = useState<Platform>('other');
  useEffect(() => setPlatform(detectPlatform()), []);

  const { ios, android } = storeLinks({ utm_source: 'share', utm_medium: 'hand', utm_campaign: shareId }, invite);
  useEffect(() => {
    if (invite) writeLocal('invite', invite);
  }, [invite]);
  const primary = platform === 'ios' ? ios : platform === 'android' ? android : ios || android;

  return (
    <>
      <section className="cta">
        <div className="cta-logo">
          <Mark size={56} />
        </div>
        <h2 className="cta-title">{d.ctaTitle}</h2>
        <p className="cta-body">{d.ctaBody}</p>
        {invite && <p className="cta-invite">🎁 {d.ctaInvite(REWARD_DAYS_PUBLIC)}</p>}
        <div className="cta-badges">
          <StoreButtons c={landingCopy(locale)} stores={{ ios, android }} from="share" fallback="/" shareId={shareId} />
        </div>
        {platform !== 'other' && (
          <a className="cta-open" href={`${brand.appScheme}://h/${shareId}${invite ? `?r=${invite}` : ''}`}>
            {d.openInApp}
          </a>
        )}
      </section>

      <div className="sticky-cta">
        <div className="sticky-brand">
          <Wordmark className="sticky-word" />
          <span>{brand.tagline[locale]}</span>
        </div>
        {primary ? (
          <a
            className="btn btn-primary btn-sm"
            href={primary}
            onClick={() => track('store_click', { store: primary === ios ? 'ios' : 'android', from: 'share_sticky', shareId })}
          >
            {d.ctaDownload}
          </a>
        ) : (
          <a className="btn btn-primary btn-sm" href="#comments">
            {d.send}
          </a>
        )}
      </div>
    </>
  );
}
