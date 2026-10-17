'use client';

import { useState } from 'react';
import type { LandingCopy } from './copy';
import { useStoreLink, type StoreLinks } from './StoreButtons';

/** Free vs Pro with the annual/monthly toggle. Purchases happen in the app, so CTAs go to the store. */
export function Pricing({ c, stores }: { c: LandingCopy; stores: StoreLinks }) {
  const downloadHref = useStoreLink(stores);
  const [period, setPeriod] = useState<'annual' | 'monthly'>('annual');
  const p = c.plan[period];
  return (
    <>
      <div className="lp-toggle" role="group" aria-label={`${c.annual} / ${c.monthly}`}>
        <button type="button" aria-pressed={period === 'annual'} onClick={() => setPeriod('annual')}>
          {c.annual} <span className="lp-save">{c.save}</span>
        </button>
        <button type="button" aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>
          {c.monthly}
        </button>
      </div>
      <div className="lp-plans">
        <div className="lp-plan">
          <h3>{c.free}</h3>
          <div className="lp-price">
            <b>{c.freePrice}</b>
            <span>{c.freePeriod}</span>
          </div>
          <div className="lp-price-note">{c.freeNote}</div>
          <ul className="lp-f">
            {c.freeFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
            {c.freeMissing.map((f) => (
              <li key={f} className="x">
                {f}
              </li>
            ))}
          </ul>
          <a className="lp-cta alt" href={downloadHref}>
            {c.freeCta}
          </a>
        </div>
        <div className="lp-plan pro">
          <h3>
            Pro {period === 'annual' && <span className="lp-tag">{c.proTag}</span>}
          </h3>
          <div className="lp-price">
            <b>{p.price}</b>
            <span>{p.period}</span>
          </div>
          <div className="lp-price-note">{p.note}</div>
          <ul className="lp-f">
            {c.proFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <a className="lp-cta main" href={downloadHref}>
            {p.cta}
          </a>
          <p className="lp-fine">{p.fine}</p>
        </div>
      </div>
      <p className="lp-fine lp-store-only">{c.storeOnly}</p>
    </>
  );
}
