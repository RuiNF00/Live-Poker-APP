'use client';

import { useEffect, useState } from 'react';
import { Mark, Wordmark } from '@/components/Brand';
import { StoreButtons } from '@/components/landing/StoreButtons';
import { landingCopy } from '@/components/landing/copy';
import { checkStatement, decodeStatement, encodeStatement, type Statement } from '@/lib/backing';
import { openSealed, sealedRef, type Sealed } from '@/lib/sealed';
import { intlTag, numberTag, formatMoney, type Locale } from '@/lib/i18n';
import { appHref, useAndroid } from '@/lib/app-link';
import { readLocal, writeLocal } from '@/lib/local';
import { storeLinks } from '@/lib/storeLinks';
import { track } from '@/lib/track';
import { backingCopy } from './copy';
import '@/app/landing.css';
import '@/components/live/live.css';
import './backing.css';

/** How often an open fixed link asks for the player's latest (only while the tab is in view). */
const POLL_MS = 10000;

/**
 * A backer's statement. The numbers come from the URL fragment, read here in the
 * browser, so they never reach the server (not even in its logs). A fixed link
 * (#s=<id>.<key>) fetches its page sealed and opens it here with the key from the fragment.
 */
export function BackingView({ locale, invite }: { locale: Locale; invite: string | null }) {
  const c = backingCopy(locale);
  const [st, setSt] = useState<Statement | null | undefined>(undefined);
  const [data, setData] = useState('');
  const android = useAndroid();
  // "Recebi" / "Paguei" for this statement: when they told the player, kept on this phone only.
  const [told, setTold] = useState<number | null>(null);
  // A fixed link: the player turned it off, and when the page last changed.
  const [gone, setGone] = useState(false);
  const [fixed, setFixed] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let seq = 0;
    // A fixed link's "Recebi" is for the balance it showed: a new balance asks again.
    const toldKey = (x: Statement, sealed: boolean) => `bk-told:${x.id}:${sealed ? `b${x.bal}` : x.at}`;
    const show = (x: Statement | null, sealed: boolean) => {
      setSt(x);
      setData(x ? (sealed ? encodeStatement(x) : window.location.hash.slice(1)) : '');
      setTold(x ? readLocal<number>(toldKey(x, sealed)) : null);
    };
    const load = async (ref: { id: string; key: string }, n: number) => {
      // A tab in the background asks nothing; coming back to it reloads at once (below).
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`/api/backer-pages/${encodeURIComponent(ref.id)}`, { cache: 'no-store' });
        if (n !== seq) return;
        if (res.status === 404) {
          setGone(true);
          return show(null, true);
        }
        if (res.ok) {
          const j = (await res.json()) as { sealed: Sealed | null };
          const x = j.sealed ? checkStatement(await openSealed(j.sealed, ref.id, ref.key)) : null;
          if (n !== seq) return;
          // Not filled yet (the player's phone sends it a moment after the link): keep waiting.
          if (x || j.sealed) show(x, true);
        }
      } catch {
        // No signal: what's on screen stays, and the next poll tries again.
      }
      if (n === seq) timer = setTimeout(() => void load(ref, n), POLL_MS);
    };
    const read = () => {
      clearTimeout(timer);
      const n = ++seq;
      const ref = sealedRef(window.location.hash);
      setFixed(!!ref);
      setGone(false);
      if (ref) void load(ref, n);
      else show(decodeStatement(window.location.hash), false);
    };
    read();
    // Back to the tab: the latest at once, not at the next poll.
    const back = () => {
      if (document.visibilityState === 'visible' && sealedRef(window.location.hash)) read();
    };
    window.addEventListener('hashchange', read);
    document.addEventListener('visibilitychange', back);
    track('share_viewed', { kind: 'backer_statement' });
    if (invite) writeLocal('invite', invite);
    return () => {
      seq++;
      clearTimeout(timer);
      window.removeEventListener('hashchange', read);
      document.removeEventListener('visibilitychange', back);
    };
  }, [invite]);

  const fmt = new Intl.NumberFormat(numberTag(locale), { maximumFractionDigits: 2 });
  // Markup always with two decimals, as in the app (1,20).
  const fmt2 = new Intl.NumberFormat(numberTag(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n: number, cur: string) => formatMoney(n, cur, locale);
  const date = (t: number) => new Date(t).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'short' });
  // Today: the time; before: the day.
  const when = (t: number) =>
    new Date(t).toDateString() === new Date().toDateString()
      ? new Date(t).toLocaleTimeString(intlTag(locale), { hour: '2-digit', minute: '2-digit' })
      : date(t);
  const chips = new Intl.NumberFormat(numberTag(locale), { maximumFractionDigits: 2 });
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
          <h1>{gone ? c.gone : c.invalid}</h1>
          <p className="live-sub">{gone ? c.goneBody : c.invalidBody}</p>
        </section>
      </main>
    );

  const square = Math.abs(st.bal) < 0.01;
  // At the top: the session being played now, else the next event they have a piece of.
  const now = st.rows.find((r) => !r.e);
  const owed = money(Math.abs(st.bal), st.cur);
  // Tells the player in a message (records only: nothing is paid here), and remembers it on this phone.
  const tell = async () => {
    const text = st.bal > 0 ? c.receivedMsg(owed, date(st.at)) : c.paidMsg(owed, date(st.at));
    const mark = () => {
      const t = Date.now();
      writeLocal(`bk-told:${st.id}:${fixed ? `b${st.bal}` : st.at}`, t);
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
        <p className="live-sub">{fixed ? c.updated(when(st.at)) : c.sent(date(st.at))}</p>
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
            {now.lv ? (
              <span className="bk-stack">
                {[
                  c.stack(chips.format(now.lv.s), now.lv.bb ? new Intl.NumberFormat(numberTag(locale), { maximumFractionDigits: 1 }).format(now.lv.s / now.lv.bb) : ''),
                  now.lv.lv ? c.level(now.lv.lv) : '',
                  now.lv.dy ? c.day(now.lv.dy) : '',
                  now.lv.bg ? c.bagged : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
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
        {st.mk >= 0.01 ? <Tile label={c.makeup} value={money(st.mk, st.cur)} tone="warn" /> : null}
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
                    {row.mk >= 0.01 ? <span className="bk-pill bk-warn">{`${c.makeup} ${money(row.mk, st.cur)}`}</span> : null}
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
                  {[date(r.d), `${fmt.format(r.sh)}%`, r.mu !== 1 ? fmt2.format(r.mu) : '', r.p ?? ''].filter(Boolean).join(' · ')}
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
