'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/config/brand';
import { t, type Locale } from '@/lib/i18n';
import { Mark, Wordmark } from './Brand';
import { track } from '@/lib/track';

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/** The acquisition hook: every viewer of a shared hand is a potential user. */
export function AppCta({ locale, shareId }: { locale: Locale; shareId: string }) {
  const d = t(locale);
  const [platform, setPlatform] = useState<Platform>('other');
  useEffect(() => setPlatform(detectPlatform()), []);

  const utm = `utm_source=share&utm_medium=hand&utm_campaign=${encodeURIComponent(shareId)}`;
  const withUtm = (url: string) => (url ? `${url}${url.includes('?') ? '&' : '?'}${utm}` : '');
  const ios = withUtm(brand.appStoreUrl);
  const android = withUtm(brand.playStoreUrl);
  const primary = platform === 'ios' ? ios : platform === 'android' ? android : ios || android;
  const hasStores = !!(ios || android);

  return (
    <>
      <section className="cta">
        <div className="cta-logo">
          <Mark size={56} />
        </div>
        <h2 className="cta-title">{d.ctaTitle}</h2>
        <p className="cta-body">{d.ctaBody}</p>
        {hasStores ? (
          <div className="cta-stores">
            {ios && (platform !== 'android') && (
              <a className="btn btn-primary" href={ios} onClick={() => track('store_click', { store: 'ios', from: 'share', shareId })}>
                App Store
              </a>
            )}
            {android && (platform !== 'ios') && (
              <a className="btn btn-primary" href={android} onClick={() => track('store_click', { store: 'android', from: 'share', shareId })}>
                Google Play
              </a>
            )}
          </div>
        ) : (
          <p className="muted">{d.comingSoon}</p>
        )}
        {platform !== 'other' && (
          <a className="cta-open" href={`${brand.appScheme}://h/${shareId}`}>
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
