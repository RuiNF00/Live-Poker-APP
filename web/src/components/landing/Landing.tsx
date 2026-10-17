import Link from 'next/link';
import { headers } from 'next/headers';
import { brand } from '@/config/brand';
import { pickLocale } from '@/lib/i18n';
import { storeLinks, type Utm } from '@/lib/storeLinks';
import { Mark, Wordmark } from '@/components/Brand';
import { landingCopy } from './copy';
import { Pricing } from './Pricing';
import { LandingView, StoreButtons, type StoreLinks } from './StoreButtons';
import { InvalidInvite, InviteHero } from './InviteBanner';
import { MainCta, StickyCta } from './Cta';
import { Card, PhoneMock, Pos } from './Visuals';
import '@/app/landing.css';

export type Search = Record<string, string | string[] | undefined>;

/** Carries the visitor's utm_* (Instagram bio, story link) through to the store links. */
function utmFrom(search: Search): Utm {
  const utm: Utm = { utm_source: 'site' };
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const) {
    const v = search[k];
    if (typeof v === 'string' && v) utm[k] = v.slice(0, 80);
  }
  return utm;
}

/**
 * The site's front page, phone first, in the app's "Noite" design. With `invite` (/r/<code>)
 * the invite takes the top of the page and the product story follows below.
 */
export async function Landing({ search, invite }: { search: Search; invite?: string | null }) {
  const h = await headers();
  const lang = typeof search.lang === 'string' ? search.lang : null;
  const locale = lang === 'en' || lang === 'pt' ? lang : pickLocale(h.get('accept-language'));
  const c = landingCopy(locale);
  const utm = utmFrom(search);
  if (invite) Object.assign(utm, { utm_source: 'invite', utm_campaign: invite });
  const stores: StoreLinks = storeLinks(utm, invite);

  return (
    <div className="lp">
      <LandingView />
      <header className="lp-bar">
        <Link className="lp-logo" href="/" aria-label={brand.name}>
          <Mark size={28} />
          <Wordmark />
        </Link>
        <nav className="lp-links" aria-label="Menu">
          <a href="#como">{c.nav.how}</a>
          <a href="#precos">{c.nav.pricing}</a>
          <a className="lp-pill" href="#baixar">
            {c.get}
          </a>
        </nav>
      </header>

      <main className="lp-main">
        {invite ? (
          <InviteHero code={invite} c={c} stores={stores} />
        ) : invite === null ? (
          <InvalidInvite c={c} stores={stores} />
        ) : (
          <section className="lp-hero">
            <span className="lp-eyebrow">
              <span className="lp-live" /> {c.eyebrow}
            </span>
            <h1>
              {c.heroTitle[0]} <em>{c.heroTitle[1]}</em>
            </h1>
            <p className="lp-lede">{c.heroBody}</p>
            <div id="hero-cta" className="lp-hero-actions">
              <MainCta label={c.ctaFree} stores={stores} from="hero" />
              <Link className="lp-btn ghost" href="/h/demo?q=1">
                {c.tryDemo}
              </Link>
            </div>
            <p className="lp-note">{c.heroNote}</p>
          </section>
        )}

        <div className="lp-stage">
          <div className="lp-glow" aria-hidden />
          <PhoneMock m={c.mock} />
        </div>

        <ul className="lp-proof">
          {c.proof.map(([k, v]) => (
            <li key={k}>
              <b>{k}</b>
              <span>{v}</span>
            </li>
          ))}
        </ul>

        <section id="como" className="lp-section">
          <h2>{c.howTitle}</h2>
          <div className="lp-steps-cards">
            <article className="lp-card">
              <div className="lp-card-art">
                <div className="lp-pos-row">
                  {['UTG', 'LJ', 'HJ', 'CO', 'BTN'].map((p) => (
                    <Pos key={p} label={p} active={p === 'HJ' || p === 'BTN'} />
                  ))}
                </div>
                <div className="lp-tap" aria-hidden />
              </div>
              <span className="lp-k">{c.how[0][0]}</span>
              <h3>{c.how[0][1]}</h3>
              <p>{c.how[0][2]}</p>
            </article>
            <article className="lp-card">
              <div className="lp-card-art">
                <div className="lp-seg">
                  {['Preflop', 'Flop', 'Turn', 'River'].map((s) => (
                    <span key={s} className={s === 'Turn' ? 'on' : ''}>
                      {s}
                    </span>
                  ))}
                </div>
                <div className="lp-mini-board">
                  <Card code="Ks" size="sm" />
                  <Card code="9h" size="sm" />
                  <Card code="4h" size="sm" />
                  <Card code="2c" size="sm" />
                </div>
              </div>
              <span className="lp-k">{c.how[1][0]}</span>
              <h3>{c.how[1][1]}</h3>
              <p>{c.how[1][2]}</p>
            </article>
            <article className="lp-card">
              <div className="lp-card-art">
                <div className="lp-bars">
                  <span style={{ width: '64%' }}>
                    <b>Call</b> 64%
                  </span>
                  <span style={{ width: '36%' }} className="dim">
                    <b>Fold</b> 36%
                  </span>
                </div>
              </div>
              <span className="lp-k">{c.how[2][0]}</span>
              <h3>{c.how[2][1]}</h3>
              <p>{c.how[2][2]}</p>
            </article>
          </div>
        </section>

        <section className="lp-section">
          <h2>{c.shareTitle}</h2>
          <p className="lp-sub">{c.shareSub}</p>
          <Link className="lp-challenge" href="/h/demo?q=1">
            <span className="lp-challenge-meta">{c.handMeta}</span>
            <div className="lp-challenge-hand">
              <div className="lp-mini-board">
                <Card code="Ks" size="sm" />
                <Card code="9h" size="sm" />
                <Card code="4h" size="sm" />
                <Card code="2c" size="sm" />
              </div>
              <div className="lp-hole">
                <Card code="Ah" size="md" />
                <Card code="Qh" size="md" />
              </div>
            </div>
            <p className="lp-challenge-q">{c.handQ}</p>
            <div className="lp-challenge-votes">
              <span className="lp-vote-btn">{c.votes[0]}</span>
              <span className="lp-vote-btn main">{c.votes[1]}</span>
            </div>
            <span className="lp-challenge-cta">{c.shareCta} →</span>
          </Link>
        </section>

        <section id="precos" className="lp-section">
          <h2>{c.pricingTitle}</h2>
          <p className="lp-sub">{c.pricingSub}</p>
          <Pricing c={c} stores={stores} />
        </section>

        <section id="faq" className="lp-section">
          <h2>{c.faqTitle}</h2>
          <div className="lp-faq">
            {c.faq.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="baixar" className="lp-section lp-final">
          <Mark size={52} />
          <h2>{c.finalTitle}</h2>
          <StoreButtons c={c} stores={stores} from="final" />
          <p className="lp-note">{c.heroNote}</p>
        </section>
      </main>

      <footer className="lp-footer">
        <span>© 2026 {brand.name}</span>
        <a href="/privacy">{c.privacy}</a>
        <a href="/terms">{c.terms}</a>
        <a href="/support">{c.support}</a>
        <a href={`${invite ? `/r/${invite}` : '/'}?lang=${locale === 'pt' ? 'en' : 'pt'}`}>{locale === 'pt' ? 'English' : 'Português'}</a>
      </footer>

      <StickyCta label={c.ctaFree} note={c.heroNote} stores={stores} />
    </div>
  );
}
