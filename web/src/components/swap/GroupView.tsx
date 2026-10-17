'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mark } from '@/components/Brand';
import { StoreButtons } from '@/components/landing/StoreButtons';
import { landingCopy } from '@/components/landing/copy';
import { formatMoney, intlTag, numberTag, type Locale } from '@/lib/i18n';
import { readLocal, writeLocal } from '@/lib/local';
import { storeLinks } from '@/lib/storeLinks';
import { groupNet, minTransfers, type PublicGroup } from '@/lib/swap-group-terms';
import { track } from '@/lib/track';
import { swapCopy } from './copy';
import { AccountsInApp, AddEntry, EntryRow, payment, PrivateLink, Top } from './SwapView';
import '@/app/landing.css';
import '@/components/live/live.css';
import './swap.css';

const POLL_MS = 30000;

/**
 * /swap/g/<id>: a group swap. With the group's invite (in the link's fragment) a player picks
 * their name and gets their seat's private link; with a seat's token they record their own
 * prizes and payments. When the creator has Pro, everyone sees the fewest transfers that settle the group.
 */
export function GroupView({ locale, initial, accounts: initialAccounts, invite: ref }: { locale: Locale; initial: PublicGroup; accounts: boolean; invite: string | null }) {
  const c = swapCopy(locale);
  const id = initial.id;
  const [group, setGroup] = useState(initial);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [token, setToken] = useState<string | null>(null);
  const [inviteKey, setInviteKey] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = group.terms;
  const you = token ? group.you : null;
  const name = (seat: number) => {
    const n = group.seats.find((s) => s.seat === seat)?.name ?? '?';
    return n === '-' ? c.left : n;
  };

  const load = useCallback(
    async (tok: string | null) => {
      try {
        const res = await fetch(`/api/swap-groups/${encodeURIComponent(id)}`, { cache: 'no-store', headers: tok ? { 'x-edit-token': tok } : {} });
        if (res.status === 404) return setGone(true);
        if (!res.ok) return;
        const j = (await res.json()) as { group: PublicGroup; accounts?: boolean };
        setGroup(j.group);
        if (typeof j.accounts === 'boolean') setAccounts(j.accounts);
      } catch {}
    },
    [id],
  );

  // #i= is the group's invite (pick a seat), #k= a seat's private token. Neither reaches the server's logs.
  useEffect(() => {
    const k = /[#&]k=([a-f0-9]{32,128})/.exec(window.location.hash)?.[1];
    const i = /[#&]i=([a-f0-9]{32,128})/.exec(window.location.hash)?.[1];
    if (k) writeLocal(`swapg:${id}`, k);
    if (i) writeLocal(`swapg-invite:${id}`, i);
    if (k || i) history.replaceState(null, '', window.location.pathname + window.location.search);
    const tok = k ?? readLocal<string>(`swapg:${id}`);
    setToken(tok);
    setInviteKey(i ?? readLocal<string>(`swapg-invite:${id}`));
    // The name this browser used last time (here or in another swap) is picked already: joining is one tap.
    const mine = readLocal<string>('swap:name')?.trim().toLowerCase();
    const seat = mine ? initial.seats.find((x) => !x.confirmedAt && x.name.trim().toLowerCase() === mine) : undefined;
    if (seat) setPick(seat.seat);
    if (tok) load(tok);
    track('share_viewed', { kind: 'swap', swapId: id });
    if (ref) writeLocal('invite', ref);
  }, [id, ref, load, initial.seats]);

  useEffect(() => {
    if (gone) return;
    const poll = () => document.visibilityState === 'visible' && load(token);
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [gone, load, token]);

  // Same formats as the pair page, in all four languages.
  const fmt = new Intl.NumberFormat(numberTag(locale), { maximumFractionDigits: 2 });
  const money = (n: number) => formatMoney(n, t.currency, locale);
  const when = (iso: number) => new Date(iso).toLocaleString(intlTag(locale), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  async function send(url: string, init: RequestInit, onToken?: (tok: string) => void) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(token ? { 'x-edit-token': token } : {}), ...init.headers } });
      const j = (await res.json().catch(() => ({}))) as { group?: PublicGroup; token?: string; error?: string };
      if (j.group) setGroup(j.group);
      if (j.token && onToken) onToken(j.token);
      if (!res.ok) setError(c.errors[j.error ?? ''] ?? c.errors.generic);
      return res.ok;
    } catch {
      setError(c.errors.generic);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const join = () =>
    pick !== null &&
    send(`/api/swap-groups/${encodeURIComponent(id)}/claim`, { method: 'POST', body: JSON.stringify({ seat: pick, invite: inviteKey }) }, (tok) => {
      writeLocal(`swapg:${id}`, tok);
      writeLocal('swap:name', name(pick));
      setToken(tok);
    });

  if (gone) {
    return (
      <main className="live">
        <Top state={null} c={c} />
        <section className="live-card">
          <p className="live-sub">{c.gone}</p>
        </section>
      </main>
    );
  }

  const missing = group.seats.filter((s) => !s.confirmedAt).length;
  const ready = missing === 0;
  const someoneLeft = group.seats.some((s) => s.name === '-');
  const net = groupNet(t, group.seats, group.entries);
  const transfers = minTransfers(net);
  const results = group.entries.filter((e) => e.kind === 'result');
  const payments = group.entries.filter((e) => e.kind === 'payment');
  const stores = storeLinks({ utm_source: 'web', utm_medium: 'swap', utm_campaign: id }, ref);
  const privateLink = token && you !== null ? `${window.location.origin}/swap/g/${id}#k=${token}` : '';
  const pctLabel = `${fmt.format(t.pct)}%`;
  const canJoin = you === null && !!inviteKey && missing > 0;

  return (
    <main className="live">
      <Top state={ready ? 'confirmed' : 'pending'} c={c} />

      <section className="live-head">
        <p className="live-eyebrow">{[c.group, t.scope === 'series' ? c.series : c.event, t.venue].filter(Boolean).join(' · ')}</p>
        <h1>{t.title}</h1>
        <p className="live-sub">{c.players(group.seats.length)}</p>
      </section>

      <section className="live-card sw-terms">
        <p className="sw-term">
          {c.groupShare(pctLabel)}
        </p>
        {t.note ? <p className="sw-note">“{t.note}”</p> : null}
        {canJoin ? null : (
          <div className="sw-seats">
            {group.seats.map((s) => (
              <div key={s.seat} className="sw-seat">
                <span className="sw-seat-name">
                  {name(s.seat)}
                  {s.seat === you ? ` (${c.youTag})` : ''}
                </span>
                <span className={`sw-seat-state ${s.confirmedAt ? 'sw-seat-ok' : ''}`}>{s.confirmedAt ? `✓ ${when(Date.parse(s.confirmedAt))}` : c.notYet}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {canJoin ? (
        <section className="live-card sw-form">
          <h2>{c.pickSeat}</h2>
          <p className="sw-hint">{c.pickSeatHint}</p>
          <div className="sw-seats">
            {group.seats.map((s) => (
              <button
                key={s.seat}
                className={`sw-seat sw-seat-pick ${pick === s.seat ? 'on' : ''}`}
                disabled={!!s.confirmedAt || busy}
                onClick={() => setPick(s.seat)}>
                <span className="sw-seat-name">{name(s.seat)}</span>
                <span className={`sw-seat-state ${s.confirmedAt ? 'sw-seat-ok' : ''}`}>{s.confirmedAt ? c.joined : ''}</span>
              </button>
            ))}
          </div>
          <button className="lp-btn main sw-btn" disabled={busy || pick === null} onClick={join}>
            {busy ? c.joining : pick === null ? c.pickSeat : c.joinAs(name(pick))}
          </button>
          <p className="sw-hint">{c.groupFine}</p>
          <p className="sw-hint">
            {c.noMoney} {c.adults}
          </p>
          {error ? <p className="sw-error">{error}</p> : null}
        </section>
      ) : null}
      {you === null && !inviteKey && missing > 0 ? <p className="live-updated">{c.needInvite}</p> : null}
      {!ready && !canJoin ? <p className="live-updated">{c.waitingSeats(missing)}</p> : null}

      {ready && !accounts ? <AccountsInApp c={c} locale={locale} stores={stores} /> : null}

      {ready && accounts ? (
        <section className="live-card">
          <p className="live-label">{c.settleTitle}</p>
          {transfers.length ? (
            transfers.map((x) => (
              <div key={`${x.from}-${x.to}`} className="sw-transfer-row">
                <p className="sw-transfer">
                  <span>{c.pays(name(x.from), name(x.to))}</span>
                  <b>{money(x.amount)}</b>
                </p>
                {/* Mine to pay: one tap records it, for everyone. */}
                {x.from === you && !someoneLeft ? (
                  <button className="lp-btn main sw-btn" disabled={busy} onClick={() => send(`/api/swap-groups/${id}/entries`, { method: 'POST', body: JSON.stringify({ entry: payment(Math.round(x.amount * 100) / 100, x.to) }) })}>
                    {c.paidNow(money(x.amount))}
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="live-big sw-dim">{results.length ? c.groupSquare : c.square}</p>
          )}
          {transfers.some((x) => x.from === you) && !someoneLeft ? <p className="sw-hint">{c.paidNowHint}</p> : null}
        </section>
      ) : null}

      {ready && !group.entries.length ? <p className="live-updated">{c.noEntries}</p> : null}

      {results.length ? (
        <section className="sw-list">
          <p className="live-label">{c.prizes}</p>
          {results.map((e) => (
            <EntryRow key={e.id} e={e} mine={e.seat === you} c={c} onRemove={() => send(`/api/swap-groups/${id}/entries/${e.id}`, { method: 'DELETE' })} busy={busy}>
              <p className="sw-row-title">{e.event || t.title}</p>
              <p className="sw-row-sub">{[c.won(name(e.seat)) + ' ' + money(e.amount), e.finish ? c.place(e.finish) : ''].filter(Boolean).join(' · ')}</p>
              {accounts ? <p className="sw-row-owe">{c.owesPart(pctLabel, money((t.pct / 100) * e.amount))} × {group.seats.length - 1}</p> : null}
            </EntryRow>
          ))}
        </section>
      ) : null}

      {payments.length ? (
        <section className="sw-list">
          <p className="live-label">{c.payments}</p>
          {payments.map((e) => (
            <EntryRow key={e.id} e={e} mine={e.seat === you} c={c} onRemove={() => send(`/api/swap-groups/${id}/entries/${e.id}`, { method: 'DELETE' })} busy={busy}>
              <p className="sw-row-title">{c.paidTo(name(e.seat), name(e.to ?? -1))}</p>
              <p className="sw-row-sub">
                {money(e.amount)} · {when(e.at)}
              </p>
            </EntryRow>
          ))}
        </section>
      ) : null}

      {someoneLeft ? <p className="live-updated">{c.leftSomeone}</p> : null}

      {ready && you !== null && !someoneLeft ? (
        <AddEntry
          c={c}
          busy={busy}
          error={error}
          title={t.scope === 'event' ? t.title : ''}
          payees={group.seats.filter((s) => s.seat !== you && s.name !== '-').map((s) => ({ seat: s.seat, name: s.name }))}
          onAdd={(entry) => send(`/api/swap-groups/${id}/entries`, { method: 'POST', body: JSON.stringify({ entry }) })}
        />
      ) : null}

      {privateLink && you !== 0 ? <PrivateLink c={c} link={privateLink} appLink={`sweatbook://swap/g/${id}?k=${token}`} /> : null}

      <p className="live-updated">{c.autoRefresh}</p>
      {!canJoin ? (
        <p className="live-updated">
          {c.noMoney} {c.adults}
        </p>
      ) : null}

      {ready && accounts ? (
        <section className="live-cta sw-accounts" id="baixar">
          <Mark size={36} />
          <p>{c.groupConfirmedCta}</p>
          <StoreButtons c={landingCopy(locale)} stores={stores} from="swap" fallback="/" />
        </section>
      ) : null}
    </main>
  );
}
