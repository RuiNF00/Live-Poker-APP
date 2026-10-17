'use client';

import { useEffect, useState } from 'react';
import { Mark, Wordmark } from '@/components/Brand';
import { StoreButtons } from '@/components/landing/StoreButtons';
import { landingCopy } from '@/components/landing/copy';
import { decodeStatement, type Statement } from '@/lib/backing';
import { intlTag, numberTag, formatMoney, type Locale } from '@/lib/i18n';
import { appHref, useAndroid } from '@/lib/app-link';
import { readLocal, writeLocal } from '@/lib/local';
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
  const android = useAndroid();
  // "Recebi" / "Paguei" for this statement: when they told the player, kept on this phone only.
  const [told, setTold] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const x = decodeStatement(window.location.hash);
      setSt(x);
      setData(x ? window.location.hash.slice(1) : '');
      setTold(x ? readLocal<number>(`bk-told:${x.id}:${x.at}`) : null);
    };
    read();
    window.addEventListener('hashchange', read);
    track('share_viewed', { kind: 'backer_statement' });
    if (invite) writeLocal('invite', invite);
    return () => window.removeEventListener('hashchange', read);
  }, [invite]);

  const fmt = new Intl.NumberFormat(numberTag(locale), { maximumFractionDigits: 2 });
  const money = (n: number, cur: string) => formatMoney(n, cur, locale);
  const date = (t: number) => new Date(t).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'short' });
  // The venue's own clock ('2026-11-03T12:00'), shown as is wherever the backer is.
  const venueTime = (s: string) => {
    const [d, hm] = s.split('T');
    const [y, mo, da] = d.split('-').map(Number);
    const [h, mi] = hm.split(':').map(Number);
    return new Date(Date.UTC(y, mo - 1, da, h, mi)).toLocaleString(intlTag(locale), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };
  const stores = storeLinks({ utm_source: 'web', utm_medium: 'backer_statement' }, invite);

  // The statement is in the link's #, which only the phone reads: the frame paints at once.
  if (st === undefined)
    return (
      <main className="live">
        <Top />
      </main>
    );
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
  // At the top: the session being played now, else the next event they have a piece of.
  const now = st.rows.find((r) => !r.e);
  const owed = money(Math.abs(st.bal), st.cur);
  // Tells the player in a message (records only: nothing is paid here), and remembers it on this phone.
  const tell = async () => {
    const text = st.bal > 0 ? c.receivedMsg(owed, date(st.at)) : c.paidMsg(owed, date(st.at));
    const mark = () => {
      const t = Date.now();
      writeLocal(`bk-told:${st.id}:${st.at}`, t);
      setTold(t);
    };
    if (navigator.share) {
      try {
        await navigator.share({ text });
        mark();
      } catch {}
      return;
    }
    mark();
    window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  };
  // The app opens this and saves it (sweatbook://backing/add).
  const appLink = appHref(`backing/add?d=${data}${invite ? `&r=${encodeURIComponent(invite)}` : ''}`, android);

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
        {square ? null : <p className={`live-big ${st.bal > 0 ? 'up' : 'warn'}`}>{owed}</p>}
        {now ? (
          <p className="bk-when">
            <span className="bk-pill bk-live">{c.running}</span> {now.n || (now.k === 'mtt' ? 'MTT' : 'Cash')}
            {now.l ? (
              <a className="bk-follow" href={`/live/${encodeURIComponent(now.l)}${invite ? `?r=${encodeURIComponent(invite)}` : ''}`}>
                {c.follow}
              </a>
            ) : null}
          </p>
        ) : st.nx ? (
          <p className="bk-when">{c.next(st.nx.n, venueTime(st.nx.s))}</p>
        ) : null}
        {square ? null : (
          <button type="button" className="bk-tell" onClick={tell}>
            {st.bal > 0 ? c.received : c.paid}
          </button>
        )}
        {told && !square ? <p className="bk-told">{c.told(st.pl, date(told))}</p> : null}
      </section>

      <section className="live-grid">
        <Tile label={c.invested} value={money(st.inv, st.cur)} />
        <Tile label={c.result} value={(st.res > 0 ? '+' : '') + money(st.res, st.cur)} tone={st.res > 0 ? 'up' : st.res < 0 ? 'down' : undefined} />
        {st.mk >= 0.5 ? <Tile label={c.makeup} value={money(st.mk, st.cur)} tone="warn" /> : null}
      </section>

      {st.yr ? (
        <section className="bk-list">
          <p className="live-label">{c.year(st.yr.y)}</p>
          {[...st.yr.pk, ...(st.yr.pk.length > 1 ? [null] : [])].map((p, i) => {
            const y = st.yr!;
            const row = p ?? { n: c.yearTotal, s: y.pk.reduce((a, x) => a + x.s, 0), c: y.pk.reduce((a, x) => a + x.c, 0), o: y.pk.reduce((a, x) => a + x.o, 0), mk: y.pk.reduce((a, x) => a + x.mk, 0), net: y.pk.reduce((a, x) => a + x.net, 0) };
            return (
              <div className="bk-row" key={i}>
                <div className="bk-main">
                  <p className="bk-name">{row.n || c.outside}</p>
                  <p className="bk-sub">
                    {c.yearSub(row.s, money(row.c, st.cur), money(row.o, st.cur))}
                    {row.mk >= 0.5 ? <span className="bk-pill bk-warn">{`${c.makeup} ${money(row.mk, st.cur)}`}</span> : null}
                  </p>
                </div>
                <div className="bk-right">
                  <p className={`bk-amt ${row.net > 0 ? 'up' : row.net < 0 ? 'down' : ''}`}>{(row.net > 0 ? '+' : '') + money(row.net, st.cur)}</p>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="bk-list">
        <p className="live-label">{c.sessions}</p>
        {st.rows.map((r, i) => {
          const net = r.o - r.c;
          return (
            <div className="bk-row" key={i}>
              <div className="bk-main">
                <p className="bk-name">{r.n || (r.k === 'mtt' ? 'MTT' : 'Cash')}</p>
                <p className="bk-sub">
                  {[date(r.d), `${fmt.format(r.sh)}%`, r.mu !== 1 ? fmt.format(r.mu) : '', r.p ?? ''].filter(Boolean).join(' · ')}
                  {!r.e ? <span className="bk-pill bk-live">{c.running}</span> : null}
                  {r.u ? <span className="bk-pill bk-warn">{c.unpaid}</span> : null}
                </p>
              </div>
              <div className="bk-right">
                {r.e ? (
                  <p className={`bk-amt ${net > 0 ? 'up' : net < 0 ? 'down' : ''}`}>{(net > 0 ? '+' : '') + money(net, r.cu ?? st.cur)}</p>
                ) : r.l ? (
                  <a className="bk-follow" href={`/live/${encodeURIComponent(r.l)}${invite ? `?r=${encodeURIComponent(invite)}` : ''}`}>
                    {c.follow}
                  </a>
                ) : (
                  <p className="bk-sub">{c.youPaid(money(r.c, r.cu ?? st.cur))}</p>
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
