import Link from 'next/link';
import { brand } from '@/config/brand';
import { Mark, Wordmark } from '@/components/Brand';
import { landingCopy } from '@/components/landing/copy';
import { MainCta, StickyCta } from '@/components/landing/Cta';
import { StoreButtons, type StoreLinks } from '@/components/landing/StoreButtons';
import { Card } from '@/components/landing/Visuals';
import type { Locale } from '@/lib/i18n';
import type { ProfilePayload, SessionCard } from '@/lib/profile-data';
import { profileCopy, type ProfileCopy } from './copy';
import { ProfileBeacon } from './ProfileBeacon';
import { ReportProfile } from './ReportProfile';
import '@/app/landing.css';
import './profile.css';

/** A shared hand as the profile lists it (built by the page from the stored share). */
export interface ProfileHand {
  id: string;
  title: string;
  hero: string[];
  board: string[];
  where: string;
  challenge: boolean;
}

export function ProfileView({
  handle,
  profile,
  hands,
  locale,
  stores,
}: {
  handle: string;
  profile: ProfilePayload;
  hands: ProfileHand[];
  locale: Locale;
  stores: StoreLinks;
}) {
  const c = profileCopy(locale);
  const lc = landingCopy(locale);
  const name = profile.name || `@${handle}`;
  const hours = Math.round(profile.sessions.reduce((n, s) => n + s.hours, 0));
  const ref = profile.ref ? `?r=${encodeURIComponent(profile.ref)}` : '';
  const empty = !profile.sessions.length && !hands.length;

  return (
    <div className="lp">
      <ProfileBeacon handle={handle} invite={profile.ref} />
      <header className="lp-bar">
        <Link className="lp-logo" href="/" aria-label={brand.name}>
          <Mark size={28} />
          <Wordmark />
        </Link>
        <nav className="lp-links" aria-label="Menu">
          <a className="lp-pill" href="#baixar">
            {lc.get}
          </a>
        </nav>
      </header>

      <main className="lp-main pf">
        <section className="pf-head">
          <div className="pf-avatar" aria-hidden>
            {(profile.name || handle).trim().charAt(0).toUpperCase()}
          </div>
          <h1>{name}</h1>
          {profile.name ? <p className="pf-handle">@{handle}</p> : null}
          {profile.bio ? <p className="pf-bio">{profile.bio}</p> : null}
          <ul className="pf-stats">
            <li>
              <b>{profile.sessions.length}</b>
              <span>{c.sessions}</span>
            </li>
            <li>
              <b>{hands.length}</b>
              <span>{c.hands}</span>
            </li>
            <li>
              <b>{hours}</b>
              <span>{c.hours}</span>
            </li>
          </ul>
          <div id="hero-cta" className="pf-follow">
            <MainCta label={c.follow(handle)} stores={stores} from="profile_follow" />
            <p>{c.followNote}</p>
          </div>
        </section>

        {empty ? <p className="pf-empty">{c.empty}</p> : null}

        {profile.sessions.length ? (
          <section className="pf-section" aria-labelledby="pf-sessions">
            <h2 id="pf-sessions">{c.sessions}</h2>
            {profile.hideAmounts ? <p className="pf-note">{c.amountsHidden}</p> : null}
            <div className="pf-grid">
              {profile.sessions.map((s) => (
                <SessionTile key={s.id} s={s} c={c} locale={locale} hide={profile.hideAmounts} />
              ))}
            </div>
          </section>
        ) : null}

        {hands.length ? (
          <section className="pf-section" aria-labelledby="pf-hands">
            <h2 id="pf-hands">{c.hands}</h2>
            <div className="pf-grid">
              {hands.map((h) => (
                <Link key={h.id} className="pf-hand" href={`/h/${h.id}${ref}${h.challenge ? (ref ? '&' : '?') + 'q=1' : ''}`}>
                  <div className="pf-hand-cards">
                    <span className="pf-hole">
                      {h.hero.length ? h.hero.map((x) => <Card key={x} code={x} size="sm" />) : <Card down size="sm" />}
                    </span>
                    {h.board.length ? (
                      <span className="pf-board">
                        {h.board.map((x) => (
                          <Card key={x} code={x} size="sm" />
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <div className="pf-hand-text">
                    <b>{h.title}</b>
                    <span>{h.where}</span>
                  </div>
                  <span className={`pf-hand-tag${h.challenge ? ' on' : ''}`}>{h.challenge ? c.challenge : c.open}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section id="baixar" className="pf-cta">
          <Mark size={44} />
          <h2>{c.ctaTitle}</h2>
          <p>{c.ctaBody}</p>
          <StoreButtons c={lc} stores={stores} from="profile" fallback="/" />
        </section>

        <footer className="pf-foot">
          <ReportProfile handle={handle} label={c.report} done={c.reported} />
          <span>
            <a href="/privacy">{lc.privacy}</a> · <a href="/terms">{lc.terms}</a>
          </span>
        </footer>
      </main>
      <StickyCta label={c.follow(handle)} note={c.followNote} stores={stores} />
    </div>
  );
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function SessionTile({ s, c, locale, hide }: { s: SessionCard; c: ProfileCopy; locale: Locale; hide: boolean }) {
  const nf = new Intl.NumberFormat(locale === 'pt' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 2 });
  const money = (n: number) => {
    const a = nf.format(Math.abs(n));
    const sign = n < 0 ? '−' : n > 0 ? '+' : '';
    return locale === 'pt' ? `${sign}${a}${s.currency}` : `${sign}${s.currency}${a}`;
  };
  // Spelled out here: the server's ICU can fall back to 9/10/2025, which reads as September in the US.
  const d = new Date(s.date);
  const date = `${d.getUTCDate()} ${(locale === 'pt' ? MONTHS_PT : MONTHS_EN)[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const h = `${nf.format(s.hours)}h`;
  const showResult = !hide && s.result !== undefined;
  const big = showResult ? money(s.result!) : s.finish ? c.place(s.finish, s.field) : h;
  const tone = showResult ? (s.result! > 0 ? 'up' : s.result! < 0 ? 'down' : '') : s.finish ? 'place' : '';
  return (
    <article className="pf-session">
      <p className="pf-kind">
        <span>{s.kind === 'mtt' ? c.tournament : c.cash}</span>
        {date}
      </p>
      <h3>{s.name || (s.kind === 'mtt' ? c.tournament : c.cash)}</h3>
      {s.venue ? <p className="pf-venue">{s.venue}</p> : null}
      <p className={`pf-big ${tone}`}>{big}</p>
      <p className="pf-meta">
        {[showResult && s.finish ? c.place(s.finish, s.field) : null, h, !hide && s.buyIn ? `${c.buyIn} ${money(s.buyIn).replace('+', '')}` : null, s.hands ? c.handsLogged(s.hands) : null]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </article>
  );
}
