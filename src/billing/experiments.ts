// Paywall settings that change without a release. RevenueCat Experiments
// give each player one offering; the offering's metadata (set in the
// RevenueCat dashboard) picks the layout and can replace the headline.
// Prices and plans never come from here: the offer is the same for everyone.

import type { PaywallReason } from './plans';

/** 'list': features then plans (the default). 'table': a Free vs Pro table then plans. */
export type PaywallLayout = 'list' | 'table';
export const LAYOUTS: PaywallLayout[] = ['list', 'table'];

export interface PaywallConfig {
  /** RevenueCat offering id, sent with paywall events so results split by variant. */
  offering: string;
  layout: PaywallLayout;
  /** Headline overrides per trigger, already in the player's language. */
  copy: Partial<Record<PaywallReason, { title?: string; body?: string }>>;
  /** Players who play a few sessions a month can start the trial at their next live session instead (trial-moments.ts). */
  defer: boolean;
}

export const DEFAULT_PAYWALL: PaywallConfig = { offering: 'default', layout: 'list', copy: {}, defer: false };

const LIMITS = { title: 60, body: 120 };

/** The text in the player's language; pt-BR falls back to pt, so a test reaches Brazil before its own copy is written. */
function text(v: unknown, lang: string, max: number): string | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const all = v as Record<string, unknown>;
  for (const l of lang === 'pt-BR' ? ['pt-BR', 'pt'] : [lang]) {
    const s = all[l];
    if (typeof s === 'string' && s.trim() && s.length <= max) return s.trim();
  }
  return undefined;
}

/**
 * Reads offering metadata such as
 * `{ "layout": "table", "defer": true, "copy": { "generic": { "title": { "pt": "…", "pt-BR": "…", "es": "…", "en": "…" } } } }`.
 * Anything missing, misspelt or too long falls back to the app's own copy.
 */
export function parsePaywallConfig(offering: string, metadata: Record<string, unknown> | null | undefined, lang: string): PaywallConfig {
  const m = metadata ?? {};
  const layout = LAYOUTS.includes(m.layout as PaywallLayout) ? (m.layout as PaywallLayout) : 'list';
  const copy: PaywallConfig['copy'] = {};
  if (m.copy && typeof m.copy === 'object') {
    for (const [reason, v] of Object.entries(m.copy as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const title = text((v as Record<string, unknown>).title, lang, LIMITS.title);
      const body = text((v as Record<string, unknown>).body, lang, LIMITS.body);
      if (title || body) copy[reason as PaywallReason] = { ...(title ? { title } : {}), ...(body ? { body } : {}) };
    }
  }
  return { offering: offering || 'default', layout, copy, defer: m.defer === true };
}
