'use client';

import { useEffect, useState } from 'react';
import { Mark, Wordmark } from '@/components/Brand';
import { StoreButtons } from '@/components/landing/StoreButtons';
import { landingCopy } from '@/components/landing/copy';
import type { Locale } from '@/lib/i18n';
import type { LiveSnapshot } from '@/lib/live-snapshot';
import { writeLocal } from '@/lib/local';
import { storeLinks } from '@/lib/storeLinks';
import { track } from '@/lib/track';
import { liveCopy } from './copy';
import '@/app/landing.css';
import './live.css';

const POLL_MS = 20000;
/** No update for this long while "playing": say so instead of claiming it's live. */
const STALE_MS = 45 * 60000;

export function LiveView({
  id,
  locale,
  initial,
  initialUpdatedAt,
  invite,
}: {
  id: string;
  locale: Locale;
  initial: LiveSnapshot;
  initialUpdatedAt: number;
  invite: string | null;
}) {
  const c = liveCopy(locale);
  const [s, setS] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [gone, setGone] = useState(false);
  const [now, setNow] = useState(initialUpdatedAt);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    track('share_viewed', { kind: 'live', liveId: id });
    if (invite) writeLocal('invite', invite);
  }, [id, invite]);

  useEffect(() => {
    if (s.endedAt && gone) return;
    let alive = true;
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (res.status === 404) return alive && setGone(true);
        if (!res.ok) return;
        const j = (await res.json()) as { snapshot: LiveSnapshot; updatedAt: string };
        if (!alive) return;
        setS(j.snapshot);
        setUpdatedAt(Date.parse(j.updatedAt));
      } catch {}
    };
    const t = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, s.endedAt, gone]);

  // Chip counts read best with a dot (pt) or comma (en): pt-PT's space is a full cell in a mono font.
  const fmt = new Intl.NumberFormat(locale === 'pt' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1 });
  const num = (n: number) => fmt.format(n);
  const money = (n: number) => {
    const sign = n < 0 ? '−' : '';
    const a = num(Math.abs(n));
    return locale === 'pt' ? `${sign}${a}${s.currency}` : `${sign}${s.currency}${a}`;
  };
  const time = (t: number) => new Date(t).toLocaleTimeString(locale === 'pt' ? 'pt-PT' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  const ended = !!s.endedAt;
  const stale = !ended && now - updatedAt > STALE_MS;
  // The app sends the time played when it last saved; the page keeps the clock running.
  const played = s.playedMs + (ended || s.paused || stale ? 0 : Math.max(0, now - s.updatedAt));
  const state = ended ? 'ended' : stale ? 'stale' : s.paused ? 'paused' : 'live';
  const first = s.stackLog[0]?.stack ?? s.stack;
  const delta = s.stack - first;
  const bb = s.bb ? Math.round((s.stack / s.bb) * 10) / 10 : null;
  const mtt = s.kind === 'mtt';
  const result = s.cashOut - s.invested;
  const agoMin = Math.max(0, Math.round((now - updatedAt) / 60000));
  const ago = agoMin < 1 ? c.justNow : agoMin < 60 ? c.minutesAgo(agoMin) : c.hoursAgo(Math.round(agoMin / 60));
  const stores = storeLinks({ utm_source: 'web', utm_medium: 'backer_live', utm_campaign: id }, invite);

  return (
    <main className="live">
      <header className="live-top">
        <a href="/" className="live-brand" aria-label="Sweatbook">
          <Mark size={26} />
          <Wordmark className="live-word" />
        </a>
        <span className={`live-state live-state-${state}`}>
          <i />
          {c[state]}
        </span>
      </header>

      <section className="live-head">
        <p className="live-eyebrow">{[mtt ? c.tournament : c.cash, s.venue].filter(Boolean).join(' · ')}</p>
        <h1>{s.name || (mtt ? c.tournament : c.cash)}</h1>
        <p className="live-sub">{[s.player, c.startedAt(time(s.startedAt))].filter(Boolean).join(' · ')}</p>
      </section>

      {ended && s.heldUntil ? (
        <section className="live-card live-result">
          <p className="live-label">{c.ended}</p>
          <p className="live-delta">{c.resultAt(time(s.heldUntil))}</p>
        </section>
      ) : ended ? (
        <section className="live-card live-result">
          <p className="live-label">{mtt ? (s.cashOut ? c.prize : c.busted) : c.cashOut}</p>
          {s.cashOut || !mtt ? <p className="live-big">{money(s.cashOut)}</p> : null}
          {s.finish ? <p className="live-place">{c.place(s.finish, s.field)}</p> : null}
          <p className={`live-delta ${result >= 0 ? 'up' : 'down'}`}>
            {mtt ? c.resultTournament : c.resultSession} {result > 0 ? '+' : ''}
            {money(result)}
          </p>
          {/* The result above is the whole session's; backers own only their piece of the prize. */}
          {s.sold && s.cashOut ? (
            <p className="live-delta">
              {c.backersShare(s.sold)} {money((s.sold / 100) * s.cashOut)}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="live-card live-stack">
          <p className="live-label">{c.stack}</p>
          <p className="live-big">{num(s.stack)}</p>
          <p className="live-stack-sub">
            {bb !== null ? <span>{num(bb)} BB</span> : null}
            {delta ? (
              <span className={delta > 0 ? 'up' : 'down'}>
                {delta > 0 ? '+' : '−'}
                {num(Math.abs(delta))} {c.sinceStart}
              </span>
            ) : null}
          </p>
          {s.stackLog.length > 1 ? <Spark points={s.stackLog.map((p) => p.stack)} label={c.chart} /> : null}
        </section>
      )}

      <section className="live-grid">
        <Tile label={s.level ? c.level(s.level) : c.blinds} value={`${num(s.sb)}/${num(s.bb)}`} sub={s.ante ? `ante ${num(s.ante)}` : undefined} />
        <Tile label={c.time} value={clock(played)} />
        <Tile label={c.entries} value={`${s.entries} × ${money(s.buyIn)}`} sub={s.addOn ? `+ add-on ${money(s.addOn)}` : undefined} />
        <Tile label={c.invested} value={money(s.invested)} />
        {mtt && s.stage ? <Tile label={c.stage} value={c.stages[s.stage] ?? s.stage} /> : null}
        {s.hands ? <Tile label={c.hands} value={num(s.hands)} /> : null}
      </section>

      {s.sold ? <p className="live-sold">{c.sold(s.sold)}</p> : null}
      <p className="live-updated">
        {c.updated(ago)}
        {ended ? '' : ` · ${c.autoRefresh}`}
      </p>

      <section className="live-cta" id="baixar">
        <Mark size={44} />
        <h2>{c.ctaTitle}</h2>
        <p>{c.ctaBody}</p>
        <StoreButtons c={landingCopy(locale)} stores={stores} from="backer_live" fallback="/" />
      </section>
    </main>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="live-tile">
      <p className="live-label">{label}</p>
      <p className="live-value">{value}</p>
      {sub ? <p className="live-tile-sub">{sub}</p> : null}
    </div>
  );
}

/** Stack line, scaled to its own range, with the start as a dashed reference. */
function Spark({ points, label }: { points: number[]; label: string }) {
  const w = 320;
  const h = 84;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - 6 - ((v - min) / span) * (h - 12);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = points[points.length - 1] >= points[0];
  return (
    <svg className="live-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <line x1="0" x2={w} y1={y(points[0])} y2={y(points[0])} className="live-spark-base" />
      <path d={`${d} L${w},${h} L0,${h} Z`} className={`live-spark-fill ${up ? 'up' : 'down'}`} />
      <path d={d} className={`live-spark-line ${up ? 'up' : 'down'}`} />
    </svg>
  );
}

function clock(ms: number) {
  const m = Math.floor(ms / 60000);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}
