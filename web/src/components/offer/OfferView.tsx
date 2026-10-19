'use client';

import { useEffect, useState } from 'react';
import { Mark, Wordmark } from '@/components/Brand';
import { StoreButtons } from '@/components/landing/StoreButtons';
import { landingCopy } from '@/components/landing/copy';
import { intlTag, type Locale } from '@/lib/i18n';
import { writeLocal } from '@/lib/local';
import { agreementCost, eventCost, type Agreement } from '@/lib/offer';
import { storeLinks } from '@/lib/storeLinks';
import { track } from '@/lib/track';
import { offerCopy, offerFormat } from './copy';
import '@/app/landing.css';
import '@/components/live/live.css';
import '@/components/backing/backing.css';
import './offer.css';

/**
 * A backer's private link to the piece they agreed with the player: each event with their
 * % and its cost, the total, and one button to confirm. A record, not a sale: there is
 * nothing to pay here and nothing about other backers.
 */
export function OfferView({
  id,
  locale,
  agreement: a,
  initialConfirmedAt,
  version,
  invite,
}: {
  id: string;
  locale: Locale;
  agreement: Agreement;
  initialConfirmedAt: string | null;
  /** The updatedAt of the terms shown: the confirm only counts while they are still these. */
  version: string;
  invite: string | null;
}) {
  const c = offerCopy(locale);
  const f = offerFormat(locale);
  const [confirmedAt, setConfirmedAt] = useState(initialConfirmedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  useEffect(() => {
    track('share_viewed', { kind: 'action_agreement', offerId: id });
    if (invite) writeLocal('invite', invite);
  }, [id, invite]);

  const loc = intlTag(locale);
  const date = (d: number) => new Date(d).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' });
  const longDate = (iso: string) => new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
  const stores = storeLinks({ utm_source: 'web', utm_medium: 'action_agreement' }, invite);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/offers/${encodeURIComponent(id)}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seen: version }),
      });
      const j = (await res.json().catch(() => ({}))) as { confirmedAt?: string };
      if (res.ok && j.confirmedAt) setConfirmedAt(j.confirmedAt);
      else if (res.status === 409) setStale(true);
      else setError(res.status === 429 ? c.rateLimited : c.error);
    } catch {
      setError(c.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="live of">
      <header className="live-top">
        <a href="/" className="live-brand" aria-label="Sweatbook">
          <Mark size={26} />
          <Wordmark className="live-word" />
        </a>
      </header>

      <section className="live-head">
        <p className="live-eyebrow">{c.eyebrow}</p>
        <h1>{c.heading(a.player)}</h1>
        <p className="live-sub">{c.sub(a.title, a.backer) || c.events(a.events.length)}</p>
      </section>

      <section className="bk-list of-events">
        <p className="live-label">{c.schedule}</p>
        <div className="of-cols" aria-hidden>
          <span />
          <span>{c.yourPct}</span>
          <span>{c.cost}</span>
        </div>
        {a.events.map((e) => (
          <div className="of-event" key={e.id}>
            <div className="bk-main">
              <p className="bk-name">{e.n || '—'}</p>
              <p className="bk-sub" suppressHydrationWarning>
                {date(e.d)} · {c.buyIn} {f.money(e.b, a.cur)}
              </p>
            </div>
            <p className="of-pct">{f.pct(e.p)}</p>
            <p className="bk-amt of-cost">{f.money(eventCost(a, e), a.cur)}</p>
          </div>
        ))}
      </section>

      <section className="live-card live-result of-total">
        <p className="of-total-label">{c.total(f.markup(a.markup))}</p>
        <p className="of-big">{f.money(agreementCost(a), a.cur)}</p>
        <p className="of-muted of-small">{c.totalHint}</p>
      </section>

      {stale ? (
        <section className="of-confirm" role="alert">
          <p className="of-center">{c.changed}</p>
          <button type="button" className="bk-save of-button" onClick={() => window.location.reload()}>
            {c.review}
          </button>
        </section>
      ) : confirmedAt ? (
        <section className="live-card of-done" role="status">
          <p className="of-done-title" suppressHydrationWarning>
            <span aria-hidden>✓ </span>
            {c.confirmed(longDate(confirmedAt))}
          </p>
          <p className="of-muted">{c.confirmedHint}</p>
        </section>
      ) : (
        <section className="of-confirm">
          <p className="of-muted of-center">{c.confirmHint}</p>
          <button type="button" className="bk-save of-button" onClick={confirm} disabled={busy}>
            {busy ? c.confirming : c.confirm}
          </button>
          {error ? (
            <p className="of-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      )}

      <p className="live-updated">{c.footer}</p>

      <section className="live-cta">
        <Mark size={44} />
        <h2>{c.ctaTitle}</h2>
        <p>{c.ctaBody}</p>
        <StoreButtons c={landingCopy(locale)} stores={stores} from="action_agreement" fallback="/" />
      </section>
    </main>
  );
}
