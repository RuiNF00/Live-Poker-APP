'use client';

import { useEffect, useState } from 'react';
import { writeLocal } from '@/lib/local';
import { appHref, useAndroid } from '@/lib/app-link';
import { INVITE_DISCOUNT_PUBLIC, type LandingCopy } from './copy';
import { MainCta } from './Cta';
import type { StoreLinks } from './StoreButtons';

/**
 * The friend's side of an invite (/r/<code>). Android picks the code up from the Play
 * referrer. On iPhone, tapping the App Store button also copies this invite link, and the
 * app's first screen has Apple's paste button to read it (one tap, no prompt, no device id).
 * Coming back to this link after installing still works too (universal link or the button).
 */
export function InviteHero({ code, c, stores }: { code: string; c: LandingCopy; stores: StoreLinks }) {
  const [ios, setIos] = useState(false);
  const [copied, setCopied] = useState(false);
  const android = useAndroid();
  useEffect(() => {
    setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
    writeLocal('invite', code);
  }, [code]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older browsers: the code is on screen to type.
    }
  };
  return (
    <section className="lp-invite" aria-labelledby="invite-title">
      <span className="lp-eyebrow">
        <GiftIcon /> {c.invite.eyebrow}
      </span>
      <h1 id="invite-title">{c.invite.title}</h1>
      <p className="lp-lede">{c.invite.body}</p>

      <div className="lp-code-card">
        <div>
          <small>{c.invite.code}</small>
          <code>{code}</code>
        </div>
        <button type="button" className="lp-copy" onClick={copy}>
          {copied ? c.invite.copied : c.invite.copy}
        </button>
        <div className="lp-reward">
          <span className="lp-reward-n">−{INVITE_DISCOUNT_PUBLIC}%</span>
          <span>{c.invite.days}</span>
        </div>
      </div>

      <ol className="lp-steps">
        {/* Step 2 per phone: iPhone pastes the copied link, Android gets it from the Play referrer. */}
        {c.invite.steps.map((s, i) => (i === 1 && !ios ? (android ? c.invite.stepAndroid : c.invite.stepOther) : s)).map((s, i) => (
          <li key={s}>
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <div id="hero-cta" className="lp-hero-actions">
        <MainCta label={c.ctaFree} soon={c.ctaSoon} stores={stores} from="invite" onClick={ios ? () => void navigator.clipboard?.writeText(`${location.origin}/r/${code}`).catch(() => {}) : undefined} />
        {(ios || android) && (
          <a className="lp-btn ghost" href={appHref(`r/${code}`, android)}>
            {c.invite.open}
          </a>
        )}
      </div>
    </section>
  );
}

/** /r/<code> with a code that is not one of ours: say so, and still offer the app. */
export function InvalidInvite({ c, stores }: { c: LandingCopy; stores: StoreLinks }) {
  return (
    <section className="lp-invite" aria-labelledby="invite-title">
      <span className="lp-eyebrow">
        <GiftIcon /> {c.invite.eyebrow}
      </span>
      <h1 id="invite-title">{c.invite.invalidTitle}</h1>
      <p className="lp-lede">{c.invite.invalidBody}</p>
      <div id="hero-cta" className="lp-hero-actions">
        <MainCta label={c.ctaFree} soon={c.ctaSoon} stores={stores} from="invite_invalid" />
      </div>
    </section>
  );
}

function GiftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}
