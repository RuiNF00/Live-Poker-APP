'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/config/brand';
import { writeLocal } from '@/lib/local';
import { REWARD_DAYS_PUBLIC, type LandingCopy } from './copy';
import { MainCta } from './Cta';
import type { StoreLinks } from './StoreButtons';

/**
 * The friend's side of an invite (/r/<code>). Android picks the code up from the Play
 * referrer; on iPhone the friend comes back to this link after installing, and the universal
 * link (or the button) opens the app with the code. The code is also easy to copy.
 */
export function InviteHero({ code, c, stores }: { code: string; c: LandingCopy; stores: StoreLinks }) {
  const [ios, setIos] = useState(false);
  const [copied, setCopied] = useState(false);
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
          <span className="lp-reward-n">+{REWARD_DAYS_PUBLIC}</span>
          <span>{c.invite.days}</span>
        </div>
      </div>

      <ol className="lp-steps">
        {c.invite.steps.map((s, i) => (
          <li key={s}>
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <div id="hero-cta" className="lp-hero-actions">
        <MainCta label={c.ctaFree} stores={stores} from="invite" />
        {ios && (
          <a className="lp-btn ghost" href={`${brand.appScheme}://r/${code}`}>
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
        <MainCta label={c.ctaFree} stores={stores} from="invite_invalid" />
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
