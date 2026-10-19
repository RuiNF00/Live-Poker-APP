'use client';

import { useState } from 'react';
import type { LandingCopy } from './copy';
import { useStoreLink, type StoreLinks } from './StoreButtons';
import { track } from '@/lib/track';

/** Pro first (it's what we sell), annual by default, Free below. Purchases happen in the app. */
export function Pricing({ c, stores }: { c: LandingCopy; stores: StoreLinks }) {
  const href = useStoreLink(stores);
  // No store link yet: no trial or subscription to start, so the Pro button says "Em breve" (Store, 19 Oct).
  const early = !stores.ios && !stores.android;
  const [period, setPeriod] = useState<'annual' | 'monthly'>('annual');
  const p = c.plan[period];
  return (
    <div className="lp-pricing">
      <div className="lp-seg lp-seg-lg" role="group" aria-label={`${c.annual} / ${c.monthly}`}>
        <button type="button" aria-pressed={period === 'annual'} className={period === 'annual' ? 'on' : ''} onClick={() => setPeriod('annual')}>
          {c.annual} <span className="lp-save">{c.save}</span>
        </button>
        <button type="button" aria-pressed={period === 'monthly'} className={period === 'monthly' ? 'on' : ''} onClick={() => setPeriod('monthly')}>
          {c.monthly}
        </button>
      </div>

      <div className="lp-plan pro">
        <div className="lp-plan-head">
          <h3>Pro</h3>
          {period === 'annual' && <span className="lp-tag">{c.proTag}</span>}
        </div>
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
        <a className="lp-btn main" href={href} onClick={() => track('store_click', { from: 'pricing_pro', plan: period })}>
          {early ? c.ctaSoon : p.cta}
        </a>
        <p className="lp-fine">{p.fine}</p>
      </div>

      <div className="lp-plan">
        <div className="lp-plan-head">
          <h3>{c.free}</h3>
          <span className="lp-price-inline">
            <b>{c.freePrice}</b> {c.freePeriod}
          </span>
        </div>
        <ul className="lp-f">
          {c.freeFeatures.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <a className="lp-btn ghost" href={href} onClick={() => track('store_click', { from: 'pricing_free' })}>
          {c.freeCta}
        </a>
      </div>
      <p className="lp-fine lp-center">{c.storeOnly}</p>
    </div>
  );
}
