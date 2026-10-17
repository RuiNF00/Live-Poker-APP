'use client';

import { useEffect, useState } from 'react';
import { Mark, Wordmark } from '@/components/Brand';
import { StoreButtons } from '@/components/landing/StoreButtons';
import { landingCopy } from '@/components/landing/copy';
import { decodeStatement, type Statement } from '@/lib/backing';
import { intlTag, numberTag, withCurrency, type Locale } from '@/lib/i18n';
import { writeLocal } from '@/lib/local';
import { storeLinks } from '@/lib/storeLinks';
import { track } from '@/lib/track';
import { backingCopy } from './copy';
import '@/app/landing.css';
import '@/components/live/live.css';
import './backing.css';

/**
 * A backer's statement. The numbers come from the URL fragment, read here in the
 * browser, so they never reach the server (not even in its logs).
 */
export function BackingView({ locale, invite }: { locale: Locale; invite: string | null }) {
  const c = backingCopy(locale);
  const [st, setSt] = useState<Statement | null | undefined>(undefined);
  const [data, setData] = useState('');

  useEffect(() => {
    const read = () => {
      const x = decodeStatement(window.location.hash);
      setSt(x);
      setData(x ? window.location.hash.slice(1) : '');
    };
    read();
    window.addEventListener('hashchange', read);
    track('share_viewed', { kind: 'backer_statement' });
    if (invite) writeLocal('invite', invite);
    return () => window.removeEventListener('hashchange', read);
  }, [invite]);

  const fmt = new Intl.NumberFormat(numberTag(locale), { maximumFractionDigits: 2 });
  const money = (n: number, cur: string) => {
    const a = fmt.format(Math.abs(n));
    const sign = n < 0 ? '−' : '';
    return withCurrency(a, cur, locale, sign);
  };
  const date = (t: number) => new Date(t).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'short' });
  const stores = storeLinks({ utm_source: 'web', utm_medium: 'backer_statement' }, invite);

  if (st === undefined) return <main className="live" />;
  if (st === null)
    return (
      <main className="live">
        <Top />
        <section className="live-head">
          <h1>{c.invalid}</h1>
          <p className="live-sub">{c.invalidBody}</p>
        </section>
      </main>
    );

  const square = Math.abs(st.bal) < 0.5;
  // The app opens this and saves it (sweatbook://backing/add).
  const appLink = `sweatbook://backing/add?d=${data}${invite ? `&r=${encodeURIComponent(invite)}` : ''}`;

  return (
    <main className="live">
      <Top />
      <section className="live-head">
        <p className="live-eyebrow">{c.eyebrow}</p>
        <h1>{c.title(st.pl)}</h1>
        <p className="live-sub">{c.sent(date(st.at))}</p>
      </section>

      <section className="live-card live-result">
        <p className="live-label">{square ? c.square : st.bal > 0 ? c.owesYou(st.pl) : c.youOwe(st.pl)}</p>
        {square ? null : <p className={`live-big ${st.bal > 0 ? 'up' : 'warn'}`}>{money(Math.abs(st.bal), st.cur)}</p>}
      </section>

      <section className="live-grid">
        <Tile label={c.invested} value={money(st.inv, st.cur)} />
        <Tile label={c.result} value={(st.res > 0 ? '+' : '') + money(st.res, st.cur)} tone={st.res > 0 ? 'up' : st.res < 0 ? 'down' : undefined} />
        {st.mk >= 0.5 ? <Tile label={c.makeup} value={money(st.mk, st.cur)} tone="warn" /> : null}
      </section>

      <section className="bk-list">
        <p className="live-label">{c.sessions}</p>
        {st.rows.map((r, i) => {
          const net = r.o - r.c;
          return (
            <div className="bk-row" key={i}>
              <div className="bk-main">
                <p className="bk-name">{r.n || (r.k === 'mtt' ? 'MTT' : 'Cash')}</p>
                <p className="bk-sub">
                  {[date(r.d), `${r.sh}%`, r.mu !== 1 ? fmt.format(r.mu) : '', r.p ?? ''].filter(Boolean).join(' · ')}
                  {!r.e ? <span className="bk-pill bk-live">{c.running}</span> : null}
                  {r.u ? <span className="bk-pill bk-warn">{c.unpaid}</span> : null}
                </p>
              </div>
              <div className="bk-right">
                {r.e ? (
                  <p className={`bk-amt ${net > 0 ? 'up' : net < 0 ? 'down' : ''}`}>{(net > 0 ? '+' : '') + money(net, st.cur)}</p>
                ) : r.l ? (
                  <a className="bk-follow" href={`/live/${encodeURIComponent(r.l)}${invite ? `?r=${encodeURIComponent(invite)}` : ''}`}>
                    {c.follow}
                  </a>
                ) : (
                  <p className="bk-sub">{c.youPaid(money(r.c, st.cur))}</p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="live-cta">
        <Mark size={44} />
        <h2>{c.saveTitle}</h2>
        <p>{c.saveBody}</p>
        <a className="bk-save" href={appLink}>
          {c.save}
        </a>
        <p className="bk-noapp">{c.noApp}</p>
        <StoreButtons c={landingCopy(locale)} stores={stores} from="backer_statement" fallback="/" />
      </section>
      <p className="live-updated">{c.privacy}</p>
    </main>
  );
}

function Top() {
  return (
    <header className="live-top">
      <a href="/" className="live-brand" aria-label="Sweatbook">
        <Mark size={26} />
        <Wordmark className="live-word" />
      </a>
    </header>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' | 'warn' }) {
  return (
    <div className="live-tile">
      <p className="live-label">{label}</p>
      <p className={`live-value ${tone ?? ''}`}>{value}</p>
    </div>
  );
}
