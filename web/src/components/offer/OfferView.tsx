'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mark, Wordmark } from '@/components/Brand';
import { StoreButtons } from '@/components/landing/StoreButtons';
import { landingCopy } from '@/components/landing/copy';
import type { Locale } from '@/lib/i18n';
import { readLocal, writeLocal } from '@/lib/local';
import { offerPrice, remaining, soldOut, type Offer, type Share } from '@/lib/offer';
import { storeLinks } from '@/lib/storeLinks';
import { track } from '@/lib/track';
import { offerCopy, offerFormat } from './copy';
import '@/app/landing.css';
import '@/components/live/live.css';
import '@/components/backing/backing.css';
import './offer.css';

interface Sent {
  rid: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A festival action package as a backer sees it: what is on sale, what is still free per
 * event, and a form to reserve a piece. Other backers are never shown, only how much of
 * each event they hold together.
 */
export function OfferView({
  id,
  locale,
  initial,
  initialTaken,
  invite,
}: {
  id: string;
  locale: Locale;
  initial: Offer;
  initialTaken: Record<string, number>;
  invite: string | null;
}) {
  const c = offerCopy(locale);
  const f = offerFormat(locale);
  const [offer, setOffer] = useState(initial);
  const [taken, setTaken] = useState(initialTaken);
  const [sent, setSent] = useState<Sent | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [whole, setWhole] = useState(initial.min);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const key = `offer:${id}`;
  useEffect(() => {
    track('share_viewed', { kind: 'offer', offerId: id });
    if (invite) writeLocal('invite', invite);
    const s = readLocal<Sent>(key);
    if (s?.rid) setSent(s);
    const n = readLocal<string>('offerName');
    if (n) setName(n);
  }, [id, invite, key]);

  const left = useMemo(() => remaining(offer, taken), [offer, taken]);
  const step = offer.min % 1 !== 0 || offer.cap <= 5 ? 0.5 : 1;
  const maxFor = (e: string) => Math.min(offer.cap, left[e] ?? 0);
  const wholeMax = Math.min(offer.cap, ...offer.events.map((e) => left[e.id] ?? 0));

  const shares: Share[] = offer.whole
    ? wholeMax >= offer.min
      ? offer.events.map((e) => ({ e: e.id, p: Math.min(whole, wholeMax) }))
      : []
    : offer.events.map((e) => ({ e: e.id, p: Math.min(picks[e.id] ?? 0, maxFor(e.id)) })).filter((s) => s.p >= offer.min);
  const price = offerPrice(offer, shares);

  const totalBuyIns = offer.events.reduce((a, e) => a + e.b, 0);
  const sMin = Math.min(...offer.events.map((e) => e.s));
  const sMax = Math.max(...offer.events.map((e) => e.s));
  const perPercent = round2((totalBuyIns * offer.markup) / 100);
  const isSoldOut = soldOut(offer, taken);
  const stores = storeLinks({ utm_source: 'web', utm_medium: 'action_offer' }, invite);
  const date = (d: number) =>
    new Date(d).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const refresh = async () => {
    try {
      const res = await fetch(`/api/offers/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const j = (await res.json()) as { offer: Offer; taken: Record<string, number> };
      setOffer(j.offer);
      setTaken(j.taken);
    } catch {}
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy || !name.trim() || !shares.length) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/offers/${encodeURIComponent(id)}/reserve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reservation: { name: name.trim(), contact: contact.trim(), shares } }),
      });
      const j = (await res.json().catch(() => ({}))) as { rid?: string; error?: string };
      if (res.ok && j.rid) {
        const s = { rid: j.rid };
        writeLocal(key, s);
        writeLocal('offerName', name.trim());
        setSent(s);
        setPicks({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const code = (j.error ?? (res.status === 429 ? 'rate_limited' : 'generic')) as keyof typeof c.errors;
        setError(c.errors[code] ?? c.errors.generic);
      }
      if (!res.ok || j.rid) await refresh();
    } catch {
      setError(c.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    writeLocal(key, null);
    setSent(null);
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
        <h1>{c.heading(offer.player)}</h1>
        <p className="live-sub">{[offer.title, c.events(offer.events.length)].filter(Boolean).join(' · ')}</p>
      </section>

      {sent ? (
        <section className="live-card of-sent" role="status">
          <p className="of-sent-title">{c.sent(offer.player)}</p>
          <p className="of-muted">{c.sentBody}</p>
          <button type="button" className="of-link" onClick={again}>
            {c.another}
          </button>
        </section>
      ) : null}

      <section className="live-card live-result of-hero">
        <p className="live-label">{c.totalBuyIns}</p>
        <p className="of-big">{f.money(totalBuyIns, offer.cur)}</p>
        <div className="of-chips">
          <span className="live-sold">{c.markup(f.markup(offer.markup))}</span>
          <span className="of-chip">{c.onSale(sMin === sMax ? f.pct(sMax) : `${f.pct(sMin)}–${f.pct(sMax)}`)}</span>
        </div>
        <div className="of-per">
          <div>
            <p className="of-per-label">{c.perPercent}</p>
            <p className="of-muted of-small">{c.perPercentHint}</p>
          </div>
          <p className="of-per-value">{f.money(perPercent, offer.cur)}</p>
        </div>
      </section>

      <section className="bk-list of-events">
        <p className="live-label">{c.schedule}</p>
        {offer.events.map((e) => {
          const free = left[e.id] ?? 0;
          const used = e.s > 0 ? Math.min(1, (e.s - free) / e.s) : 1;
          return (
            <div className="of-event" key={e.id}>
              <div className="of-event-top">
                <div className="bk-main">
                  <p className="bk-name">{e.n || '—'}</p>
                  <p className="bk-sub" suppressHydrationWarning>
                    {date(e.d)}
                  </p>
                </div>
                <p className="bk-amt">{f.money(e.b, offer.cur)}</p>
              </div>
              <div className="of-bar" aria-hidden>
                <i style={{ width: `${Math.round(used * 100)}%` }} />
              </div>
              <p className={`of-free ${free < offer.min ? 'of-out' : ''}`}>{free < offer.min ? c.soldOutEvent : c.free(f.pct(free), f.pct(e.s))}</p>
            </div>
          );
        })}
      </section>

      {offer.closed || isSoldOut ? (
        <section className="live-card of-state">
          <h2>{offer.closed ? c.closedTitle : c.soldOutTitle}</h2>
          <p className="of-muted">{offer.closed ? c.closedBody(offer.player) : c.soldOutBody}</p>
        </section>
      ) : sent ? null : (
        <form className="live-card of-form" onSubmit={submit}>
          <h2>{c.formTitle}</h2>
          <label className="of-field">
            <span>{c.name}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder={c.namePh} autoComplete="name" />
          </label>
          <label className="of-field">
            <span>{c.contact}</span>
            <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={60} placeholder={c.contactPh} autoComplete="tel" />
          </label>

          {offer.whole ? (
            <div className="of-pick">
              <div className="of-pick-row">
                <div className="bk-main">
                  <p className="bk-name">{c.wholeTitle}</p>
                  <p className="bk-sub">{c.wholeHint}</p>
                </div>
                <Stepper value={Math.min(whole, wholeMax)} min={offer.min} max={wholeMax} step={step} zero={false} onChange={setWhole} c={c} pct={f.pct} />
              </div>
            </div>
          ) : (
            <div className="of-pick">
              <p className="of-muted of-small">{c.perEventHint}</p>
              {offer.events.map((e) => {
                const max = maxFor(e.id);
                return (
                  <div className="of-pick-row" key={e.id}>
                    <div className="bk-main">
                      <p className="bk-name">{e.n || '—'}</p>
                      <p className="bk-sub">{max >= offer.min ? c.upTo(f.pct(max)) : c.soldOutEvent}</p>
                    </div>
                    <Stepper
                      value={Math.min(picks[e.id] ?? 0, max)}
                      min={offer.min}
                      max={max}
                      step={step}
                      zero
                      onChange={(v) => setPicks((p) => ({ ...p, [e.id]: v }))}
                      c={c}
                      pct={f.pct}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <p className="of-muted of-small">{c.limits(f.pct(offer.min), f.pct(offer.cap))}</p>

          <div className="of-pay">
            {shares.length ? <p className="of-pay-value">{c.youPay(f.money(price, offer.cur))}</p> : <p className="of-muted of-center">{c.pickSome}</p>}
            <button type="submit" className="bk-save of-submit" disabled={busy || !name.trim() || !shares.length}>
              {busy ? c.sending : c.reserve}
            </button>
          </div>
          {error ? (
            <p className="of-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="of-muted of-small of-center">{c.privacy}</p>
        </form>
      )}

      <section className="live-cta">
        <Mark size={44} />
        <h2>{c.ctaTitle}</h2>
        <p>{c.ctaBody}</p>
        <StoreButtons c={landingCopy(locale)} stores={stores} from="action_offer" fallback="/" />
      </section>
    </main>
  );
}

function Stepper({
  value,
  min,
  max,
  step,
  zero,
  onChange,
  c,
  pct,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Can go down to 0 (per-event picks); a whole package starts at min. */
  zero: boolean;
  onChange: (v: number) => void;
  c: { less: string; more: string };
  pct: (n: number) => string;
}) {
  const off = max < min;
  const down = () => {
    if (value <= min) return onChange(zero ? 0 : min);
    // Back onto the step grid from a clamped value (e.g. 2.75 -> 2).
    const v = Math.ceil(round2(value - min) / step - 1e-9) * step + min - step;
    onChange(round2(Math.max(min, v)));
  };
  const up = () => {
    if (value < min) return onChange(min);
    onChange(round2(Math.min(max, value + step)));
  };
  return (
    <div className={`of-stepper ${value > 0 ? 'on' : ''}`}>
      <button type="button" onClick={down} disabled={off || value <= (zero ? 0 : min)} aria-label={c.less}>
        −
      </button>
      <output aria-live="polite">{pct(off ? 0 : value)}</output>
      <button type="button" onClick={up} disabled={off || value >= max} aria-label={c.more}>
        +
      </button>
    </div>
  );
}
