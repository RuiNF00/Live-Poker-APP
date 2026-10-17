import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { brand } from '@/config/brand';
import { pickLocale } from '@/lib/i18n';
import { Mark, Wordmark } from '@/components/Brand';
import { PlayingCard } from '@/components/PlayingCard';
import { landingCopy } from '@/components/landing/copy';
import { Pricing } from '@/components/landing/Pricing';
import { StoreButtons, type StoreLinks } from '@/components/landing/StoreButtons';
import './landing.css';

export const metadata: Metadata = {
  title: { absolute: `${brand.name} · ${brand.tagline.pt}` },
  description:
    'Regista as mãos que jogas ao vivo em segundos, revê-as rua a rua e partilha com os amigos. Grátis para começar, Pro por 29,99 US$/mês ou 199,99 US$/ano.',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: brand.name, url: '/' },
  twitter: { card: 'summary_large_image' },
};

type Search = Record<string, string | string[] | undefined>;

/** Carries the visitor's utm_* (Instagram bio, story link) through to the store links. */
function withUtm(url: string, search: Search) {
  if (!url) return '';
  const u = new URL(url);
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const v = search[k];
    if (typeof v === 'string' && v) u.searchParams.set(k, v.slice(0, 80));
  }
  if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'site');
  return u.toString();
}

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const h = await headers();
  const lang = typeof search.lang === 'string' ? search.lang : null;
  const locale = lang === 'en' || lang === 'pt' ? lang : pickLocale(h.get('accept-language'));
  const c = landingCopy(locale);
  const stores: StoreLinks = { ios: withUtm(brand.appStoreUrl, search), android: withUtm(brand.playStoreUrl, search) };

  return (
    <div className="lp">
      <div className="lp-wrap">
        <nav className="lp-nav">
          <Link className="lp-logo" href="/" aria-label={brand.name}>
            <Mark size={30} />
            <Wordmark />
          </Link>
          <div className="lp-links">
            <a className="hide-sm" href="#como">
              {c.nav.how}
            </a>
            <a href="#precos">{c.nav.pricing}</a>
            <a href="#faq">{c.nav.faq}</a>
          </div>
        </nav>

        <header className="lp-hero">
          <div>
            <h1>
              {c.heroTitle[0]} <em>{c.heroTitle[1]}</em>
            </h1>
            <p className="lp-lede">{c.heroBody}</p>
            <StoreButtons c={c} stores={stores} />
            <p className="lp-note">
              {c.heroNote}{' '}
              <Link href="/h/demo?q=1">{c.tryDemo} →</Link>
            </p>
          </div>

          <Link className="lp-hand" href="/h/demo?q=1" aria-label={c.handVote}>
            <div className="lp-meta">{c.handMeta}</div>
            <div className="lp-felt">
              <div className="lp-cards">
                <PlayingCard card="Ks" size="sm" />
                <PlayingCard card="9h" size="sm" />
                <PlayingCard card="4h" size="sm" />
                <PlayingCard card="2c" size="sm" />
                <PlayingCard size="sm" faceDown />
              </div>
              <span className="lp-pot">{c.handPot}</span>
              <div className="lp-cards">
                <PlayingCard card="Ah" size="md" />
                <PlayingCard card="Qh" size="md" />
              </div>
            </div>
            <div className="lp-q">{c.handQ}</div>
            <div className="lp-votes">
              {c.votes.map((v, i) => (
                <div className="lp-vote" key={v}>
                  {v}
                  <div className="lp-bar">
                    <span style={{ width: `${[23, 60, 17][i]}%` }} />
                  </div>
                  <span className="lp-n">{[12, 31, 9][i]}</span>
                </div>
              ))}
            </div>
            <span className="lp-hand-cta">{c.handVote} →</span>
          </Link>
        </header>

        <section id="como" className="lp-section">
          <h2>{c.howTitle}</h2>
          <p className="lp-sub">{c.howSub}</p>
          <div className="lp-how">
            {c.how.map(([k, title, body]) => (
              <div key={k}>
                <span className="lp-k">{k}</span>
                <b>{title}</b>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section lp-share">
          <div>
            <h2>{c.shareTitle}</h2>
            <p className="lp-sub">{c.shareSub}</p>
            <Link className="lp-cta alt lp-inline" href="/h/demo?q=1">
              {c.shareCta}
            </Link>
          </div>
          <div className="lp-phones">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/vote.webp" alt="" width={585} height={996} loading="lazy" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/replay.webp" alt="" width={585} height={996} loading="lazy" />
          </div>
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
          <Mark size={56} />
          <h2>{c.finalTitle}</h2>
          <StoreButtons c={c} stores={stores} />
        </section>

        <footer className="lp-footer">
          <span>© 2026 {brand.name}</span>
          <a href="/privacy">{c.privacy}</a>
          <a href="/terms">{c.terms}</a>
          <a href="/support">{c.support}</a>
          <a href={locale === 'pt' ? '/?lang=en' : '/?lang=pt'}>{locale === 'pt' ? 'English' : 'Português'}</a>
        </footer>
      </div>
    </div>
  );
}
