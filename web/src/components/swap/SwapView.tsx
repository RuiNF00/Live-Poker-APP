'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mark, Wordmark } from '@/components/Brand';
import { StoreButtons } from '@/components/landing/StoreButtons';
import { landingCopy } from '@/components/landing/copy';
import { intlTag, numberTag, formatMoney, t as siteCopy, type Locale } from '@/lib/i18n';
import { readLocal, writeLocal } from '@/lib/local';
import { storeLinks } from '@/lib/storeLinks';
import { OpenInApp } from '@/components/OpenInApp';
import { swapBalance, type PublicSwap, type Side, type SwapEntry } from '@/lib/swap-terms';
import { track } from '@/lib/track';
import { swapCopy } from './copy';
import '@/app/landing.css';
import '@/components/live/live.css';
import './swap.css';

const POLL_MS = 30000;
const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');

/** `accounts`: the creator has Pro, so everyone sees who owes whom. Otherwise only the results. */
export function SwapView({ locale, initial, accounts: initialAccounts, invite }: { locale: Locale; initial: PublicSwap; accounts: boolean; invite: string | null }) {
  const c = swapCopy(locale);
  const id = initial.id;
  const [swap, setSwap] = useState(initial);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [token, setToken] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(initial.terms.b.name);
  const t = swap.terms;
  const you = token ? swap.you : null;
  const left = swap.leftSide ?? null;
  const shown = (n: string) => (n === '-' ? c.left : n);
  const names: Record<Side, string> = { a: shown(t.a.name), b: shown(swap.confirmedName || t.b.name) };

  const load = useCallback(
    async (tok: string | null) => {
      try {
        const res = await fetch(`/api/swaps/${encodeURIComponent(id)}`, { cache: 'no-store', headers: tok ? { 'x-edit-token': tok } : {} });
        if (res.status === 404) return setGone(true);
        if (!res.ok) return;
        const j = (await res.json()) as { swap: PublicSwap; accounts?: boolean };
        setSwap(j.swap);
        if (typeof j.accounts === 'boolean') setAccounts(j.accounts);
      } catch {}
    },
    [id],
  );

  // The private link carries the token in the fragment (never sent to the server); keep it here.
  useEffect(() => {
    const m = /[#&]k=([a-f0-9]{32,128})/.exec(window.location.hash);
    if (m) {
      writeLocal(`swap:${id}`, m[1]);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    const tok = m?.[1] ?? readLocal<string>(`swap:${id}`);
    setToken(tok);
    if (tok) load(tok);
    track('share_viewed', { kind: 'swap', swapId: id });
    if (invite) writeLocal('invite', invite);
  }, [id, invite, load]);

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

  const fmt = new Intl.NumberFormat(numberTag(locale), { maximumFractionDigits: 2 });
  const money = (n: number) => formatMoney(n, t.currency, locale);
  const pctLabel = (n: number) => `${fmt.format(n)}%`;
  const when = (iso: string | number) =>
    new Date(iso).toLocaleString(intlTag(locale), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function send(url: string, init: RequestInit, onToken?: (tok: string) => void) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(token ? { 'x-edit-token': token } : {}), ...init.headers } });
      const j = (await res.json().catch(() => ({}))) as { swap?: PublicSwap; token?: string; error?: string };
      if (j.swap) setSwap(j.swap);
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

  const confirm = () =>
    send(`/api/swaps/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: JSON.stringify({ name }) }, (tok) => {
      writeLocal(`swap:${id}`, tok);
      // The next group link picks this name by itself.
      writeLocal('swap:name', name.trim());
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

  const bal = swapBalance(t, swap.entries);
  const results = swap.entries.filter((e) => e.kind === 'result');
  const payments = swap.entries.filter((e) => e.kind === 'payment');
  const confirmed = !!swap.confirmedAt;
  const creditor: Side | null = Math.abs(bal.net) < 0.005 ? null : bal.net > 0 ? 'a' : 'b';
  const stores = storeLinks({ utm_source: 'web', utm_medium: 'swap', utm_campaign: id }, invite);
  const privateLink = token && you ? `${window.location.origin}/swap/${id}#k=${token}` : '';
  // What I owe, when the accounts are open to me: one tap records the payment.
  const owe = accounts && you && !left && creditor && creditor !== you ? Math.round(Math.abs(bal.net) * 100) / 100 : 0;

  return (
    <main className="live">
      <Top state={confirmed ? 'confirmed' : 'pending'} c={c} />

      <section className="live-head">
        <p className="live-eyebrow">{[c.swap, t.scope === 'series' ? c.series : c.event, t.venue].filter(Boolean).join(' · ')}</p>
        <h1>{t.title}</h1>
        <p className="live-sub">
          {names.a} × {names.b}
        </p>
      </section>

      <section className="live-card sw-terms">
        <p className="sw-term">
          <b>{pctLabel(t.a.pct)}</b> {c.share(names.a, names.b)}
        </p>
        <p className="sw-term">
          <b>{pctLabel(t.b.pct)}</b> {c.share(names.b, names.a)}
        </p>
        {t.note ? <p className="sw-note">“{t.note}”</p> : null}
        {confirmed ? (
          <div className="sw-seal">
            <p className="sw-seal-line">✓ {c.confirmedBy(swap.confirmedName ?? names.b, when(swap.confirmedAt!))}</p>
            {swap.code ? (
              <p className="sw-code">
                <span className="live-label">{c.code}</span> <b>{swap.code}</b>
              </p>
            ) : null}
            <p className="sw-hint">{c.codeHint}</p>
          </div>
        ) : null}
      </section>

      {!confirmed && you !== 'a' ? (
        <section className="live-card sw-form">
          <h2>{c.confirmTitle(t.a.name)}</h2>
          <label className="sw-field">
            <span className="live-label">{c.yourName}</span>
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <button className="lp-btn main sw-btn" disabled={busy || !name.trim()} onClick={confirm}>
            {busy ? c.confirming : c.confirm}
          </button>
          <p className="sw-hint">{c.confirmFine}</p>
          <p className="sw-hint">
            {c.noMoney} {c.adults}
          </p>
          {error ? <p className="sw-error">{error}</p> : null}
        </section>
      ) : null}
      {!confirmed && you === 'a' ? <p className="live-updated">{c.waitingFor(t.b.name)}</p> : null}

      {confirmed && !accounts ? <AccountsInApp c={c} locale={locale} stores={stores} /> : null}

      {confirmed && accounts ? (
        <section className="live-card">
          <p className="live-label">{creditor ? c.owes(names[other(creditor)], names[creditor]) : c.balance}</p>
          <p className={`live-big ${creditor ? '' : 'sw-dim'}`}>{creditor ? money(Math.abs(bal.net)) : c.square}</p>
          {bal.aOwes >= 0.005 && bal.bOwes >= 0.005 ? <p className="sw-hint sw-line">{c.owesSplit(names.a, money(bal.aOwes), names.b, money(bal.bOwes))}</p> : null}
          {bal.aPaid >= 0.005 ? <p className="sw-hint sw-line">{c.paid(names.a, money(bal.aPaid))}</p> : null}
          {bal.bPaid >= 0.005 ? <p className="sw-hint sw-line">{c.paid(names.b, money(bal.bPaid))}</p> : null}
          {owe ? (
            <>
              <button className="lp-btn main sw-btn" disabled={busy} onClick={() => send(`/api/swaps/${id}/entries`, { method: 'POST', body: JSON.stringify({ entry: payment(owe) }) })}>
                {c.paidNow(money(owe))}
              </button>
              <p className="sw-hint">{c.paidNowHint}</p>
            </>
          ) : null}
        </section>
      ) : null}

      {confirmed && !swap.entries.length ? <p className="live-updated">{c.noEntries}</p> : null}

      {results.length ? (
        <section className="sw-list">
          <p className="live-label">{c.prizes}</p>
          {results.map((e) => (
            <EntryRow key={e.id} e={e} mine={e.side === you} c={c} onRemove={() => send(`/api/swaps/${id}/entries/${e.id}`, { method: 'DELETE' })} busy={busy}>
              <p className="sw-row-title">{e.event || t.title}</p>
              <p className="sw-row-sub">
                {[c.won(names[e.side]) + ' ' + money(e.amount), e.finish ? c.place(e.finish) : ''].filter(Boolean).join(' · ')}
              </p>
              {accounts ? (
                <p className="sw-row-owe">
                  {c.owes(names[e.side], names[other(e.side)])}: {c.owesPart(pctLabel(t[e.side].pct), money((t[e.side].pct / 100) * e.amount))}
                </p>
              ) : null}
            </EntryRow>
          ))}
        </section>
      ) : null}

      {payments.length ? (
        <section className="sw-list">
          <p className="live-label">{c.payments}</p>
          {payments.map((e) => (
            <EntryRow key={e.id} e={e} mine={e.side === you} c={c} onRemove={() => send(`/api/swaps/${id}/entries/${e.id}`, { method: 'DELETE' })} busy={busy}>
              <p className="sw-row-title">{c.paidTo(names[e.side], names[other(e.side)])}</p>
              <p className="sw-row-sub">
                {money(e.amount)} · {when(e.at)}
              </p>
            </EntryRow>
          ))}
        </section>
      ) : null}

      {left ? <p className="live-updated">{c.leftNote(c.leftPlayer)}</p> : null}

      {confirmed && you && !left ? <AddEntry c={c} busy={busy} error={error} title={t.scope === 'event' ? t.title : ''} owe={owe} onAdd={(entry) => send(`/api/swaps/${id}/entries`, { method: 'POST', body: JSON.stringify({ entry }) })} /> : null}

      {privateLink && you === 'b' ? <PrivateLink c={c} link={privateLink} appLink={`sweatbook://swap/${id}?k=${token}`} /> : null}

      <p className="live-updated">{c.autoRefresh}</p>
      {confirmed || you === 'a' ? (
        <p className="live-updated">
          {c.noMoney} {c.adults}
        </p>
      ) : null}

      {/* Only once both confirmed: before that the page is about the deal, not the app. */}
      {confirmed && accounts ? (
        <section className="live-cta sw-accounts" id="baixar">
          <Mark size={36} />
          <p>{c.confirmedCta}</p>
          <StoreButtons c={landingCopy(locale)} stores={stores} from="swap" fallback="/" />
        </section>
      ) : null}
      {/* Whoever has the app can confirm and keep it there, before or after. */}
      <p className="live-updated">
        <OpenInApp path={`swap/${id}`} invite={invite} label={siteCopy(locale).openInApp} />
      </p>
    </main>
  );
}

export type C = ReturnType<typeof swapCopy>;

/** A payment entry for the API (the same shape AddEntry sends). */
export function payment(amount: number, to?: number) {
  return { cid: Math.random().toString(36).slice(2, 12), kind: 'payment', amount, event: '', finish: null, ...(to === undefined ? {} : { to }) };
}

/** In place of the accounts when the creator doesn't have Pro: the results stay, the app does the maths. */
export function AccountsInApp({ c, locale, stores }: { c: C; locale: Locale; stores: ReturnType<typeof storeLinks> }) {
  return (
    <section className="live-cta sw-accounts" id="baixar">
      <Mark size={36} />
      <p>
        <b>{c.accountsInApp}</b>
        <br />
        {c.accountsInAppBody}
      </p>
      <StoreButtons c={landingCopy(locale)} stores={stores} from="swap" fallback="/" />
    </section>
  );
}

export function Top({ state, c }: { state: 'pending' | 'confirmed' | null; c: C }) {
  return (
    <header className="live-top sw-top">
      <a href="/" className="live-brand" aria-label="Sweatbook">
        <Mark size={26} />
        <Wordmark className="live-word" />
      </a>
      {state ? (
        <span className={`live-state ${state === 'confirmed' ? 'live-state-live sw-state-ok' : 'live-state-paused'}`}>
          <i />
          {c[state]}
        </span>
      ) : null}
    </header>
  );
}

export function EntryRow({ e, mine, c, onRemove, busy, children }: { e: Pick<SwapEntry, 'id'> & { side?: string }; mine: boolean; c: C; onRemove: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <div className={`sw-row ${e.side ? `sw-side-${e.side}` : ''}`}>
      <div className="sw-row-main">{children}</div>
      {mine ? (
        <button className="sw-remove" disabled={busy} onClick={onRemove} aria-label={c.remove}>
          {c.remove}
        </button>
      ) : null}
    </div>
  );
}

export function AddEntry({
  c,
  busy,
  error,
  title,
  onAdd,
  payees,
  owe = 0,
}: {
  c: C;
  busy: boolean;
  error: string;
  title: string;
  onAdd: (e: object) => Promise<boolean>;
  /** Group swaps: who a payment can go to. */
  payees?: { seat: number; name: string }[];
  /** What I owe (0 when unknown): a payment starts at it. */
  owe?: number;
}) {
  const [kind, setKind] = useState<'result' | 'payment'>('result');
  const [to, setTo] = useState(payees?.[0]?.seat ?? -1);
  const [event, setEvent] = useState(title);
  const [amount, setAmount] = useState('');
  const [finish, setFinish] = useState('');
  const value = Number(amount.replace(/\s/g, '').replace(',', '.'));
  const ok = Number.isFinite(value) && (kind === 'result' ? value >= 0 && amount !== '' : value > 0);
  const submit = async () => {
    const done = await onAdd({
      cid: Math.random().toString(36).slice(2, 12),
      kind,
      amount: value,
      event: kind === 'result' ? event : '',
      finish: kind === 'result' && finish ? Number(finish) : null,
      ...(payees && kind === 'payment' ? { to } : {}),
    });
    if (done) {
      setAmount('');
      setFinish('');
    }
  };
  return (
    <section className="live-card sw-form">
      <p className="live-label">{c.addTitle}</p>
      <div className="sw-seg" role="tablist">
        <button role="tab" aria-selected={kind === 'result'} className={kind === 'result' ? 'on' : ''} onClick={() => setKind('result')}>
          {c.addPrize}
        </button>
        <button role="tab" aria-selected={kind === 'payment'} className={kind === 'payment' ? 'on' : ''} onClick={() => {
            setKind('payment');
            if (!amount && owe) setAmount(String(owe));
          }}>
          {c.addPayment}
        </button>
      </div>
      {kind === 'result' ? (
        <label className="sw-field">
          <span className="live-label">{c.eventName}</span>
          <input value={event} maxLength={80} placeholder={c.eventPlaceholder} onChange={(e) => setEvent(e.target.value)} />
        </label>
      ) : null}
      {payees && kind === 'payment' ? (
        <label className="sw-field">
          <span className="live-label">{c.payTo}</span>
          <select value={to} onChange={(e) => setTo(Number(e.target.value))}>
            {payees.map((p) => (
              <option key={p.seat} value={p.seat}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="sw-pair">
        <label className="sw-field">
          <span className="live-label">{kind === 'result' ? c.amountPrize : c.amountPayment}</span>
          <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
        </label>
        {kind === 'result' ? (
          <label className="sw-field sw-narrow">
            <span className="live-label">{c.finish}</span>
            <input value={finish} inputMode="numeric" onChange={(e) => setFinish(e.target.value.replace(/\D/g, ''))} />
          </label>
        ) : null}
      </div>
      <button className="lp-btn main sw-btn" disabled={busy || !ok} onClick={submit}>
        {busy ? c.saving : c.save}
      </button>
      <p className="sw-hint">{c.onlyYours}</p>
      {error ? <p className="sw-error">{error}</p> : null}
    </section>
  );
}

export function PrivateLink({ c, link, appLink }: { c: C; link: string; appLink: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="live-card sw-form">
      <p className="sw-hint">{c.keepLink}</p>
      <div className="sw-copy">
        <code>{link}</code>
        <button
          className="lp-btn ghost"
          onClick={() =>
            navigator.clipboard?.writeText(link).then(
              () => setCopied(true),
              () => {},
            )
          }>
          {copied ? c.copied : c.copy}
        </button>
      </div>
      <a className="lp-btn main sw-btn" href={appLink}>
        {c.openApp}
      </a>
    </section>
  );
}
