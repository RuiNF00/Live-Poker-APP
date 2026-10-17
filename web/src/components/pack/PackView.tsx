'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HandRecord } from '@livepoker/hand-format';
import { ShareView } from '@/components/ShareView';
import { PlayingCard } from '@/components/PlayingCard';
import type { Locale } from '@/lib/i18n';
import type { HandComment } from '@/lib/types';
import { packCopy } from './copy';
import './pack.css';

export interface PackHand {
  shareId: string;
  hand: HandRecord;
  title: string | null;
  revealAll: boolean;
  allowComments: boolean;
  comments: HandComment[];
  viewCount: number;
}

interface Props {
  title: string;
  hands: PackHand[];
  hideAmounts: boolean;
  locale: Locale;
  siteUrl: string;
  invite: string | null;
  utm: { source: string; medium: string };
}

/** Several shared hands behind one link: the /h replayer for each, with a picker on top. #n opens hand n. */
export function PackView({ title, hands, hideAmounts, locale, siteUrl, invite, utm }: Props) {
  const c = packCopy(locale);
  const [i, setI] = useState(0);
  useEffect(() => {
    const n = Number(window.location.hash.slice(1));
    // Opening on the hand the link points at is a one-off read of the URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Number.isInteger(n) && n >= 1 && n <= hands.length) setI(n - 1);
  }, [hands.length]);
  const go = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(hands.length - 1, n));
      setI(next);
      history.replaceState(null, '', `#${next + 1}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [hands.length],
  );
  const cur = hands[i];

  const nav = (
    <nav className="pk" aria-label={c.kicker}>
      <div className="pk-top">
        <div className="pk-titles">
          <p className="pk-kicker">
            {c.kicker} · {c.hands(hands.length)}
          </p>
          {title ? <h1 className="pk-title">{title}</h1> : null}
        </div>
        <div className="pk-pager">
          <button className="ctl" onClick={() => go(i - 1)} disabled={i === 0} aria-label={c.prev}>
            ‹
          </button>
          <span className="pk-of">{c.of(i + 1, hands.length)}</span>
          <button className="ctl" onClick={() => go(i + 1)} disabled={i === hands.length - 1} aria-label={c.next}>
            ›
          </button>
        </div>
      </div>
      <div className="pk-tabs" role="tablist">
        {hands.map((h, n) => {
          const hero = h.hand.players.find((p) => p.isHero);
          return (
            <button key={h.shareId} role="tab" aria-selected={n === i} className={`pk-tab${n === i ? ' on' : ''}`} onClick={() => go(n)}>
              <span className="pk-tab-n">{n + 1}</span>
              <span className="pk-tab-cards">{hero?.cards?.length ? hero.cards.map((cd) => <PlayingCard key={cd} card={cd} size="xs" />) : '—'}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <ShareView
      key={cur.shareId}
      nav={nav}
      shareId={cur.shareId}
      hand={cur.hand}
      title={cur.title}
      revealAll={cur.revealAll}
      quiz={null}
      allowComments={cur.allowComments}
      initialComments={cur.comments}
      viewCount={cur.viewCount}
      locale={locale}
      shareUrl={`${siteUrl}/h/${cur.shareId}`}
      invite={invite}
      utm={utm}
      initialMode={hideAmounts ? 'bb' : 'chips'}
    />
  );
}
