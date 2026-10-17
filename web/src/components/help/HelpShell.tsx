import Link from 'next/link';
import { brand } from '@/config/brand';
import { Mark, Wordmark } from '@/components/Brand';
import { HELP_LOCALES, type HelpLocale } from '@/lib/help/articles';
import { HELP_BASE, helpCopy, LANG_NAME, LANG_TAG } from './copy';
import './help.css';

/**
 * Header and footer shared by the help pages and /support. `hrefs` is this page in every
 * help language, for the language links at the bottom.
 */
export function HelpShell({ locale, hrefs, children }: { locale: HelpLocale; hrefs: Record<HelpLocale, string>; children: React.ReactNode }) {
  const c = helpCopy[locale];
  return (
    <div className="hc" lang={LANG_TAG[locale]}>
      <header className="hc-bar">
        <Link className="hc-logo" href="/" aria-label={brand.name}>
          <Mark size={26} />
          <Wordmark />
        </Link>
        <nav className="hc-nav">
          <Link href={HELP_BASE[locale]}>{c.help}</Link>
          <a href="#idioma" aria-label={c.language}>
            {LANG_TAG[locale].toUpperCase()}
          </a>
        </nav>
      </header>
      <main className="hc-main">{children}</main>
      <footer className="hc-foot">
        <nav id="idioma" className="hc-langs" aria-label={c.language}>
          {HELP_LOCALES.map((l) =>
            l === locale ? (
              <span key={l} aria-current="page">
                {LANG_NAME[l]}
              </span>
            ) : (
              <Link key={l} href={hrefs[l]} hrefLang={LANG_TAG[l]}>
                {LANG_NAME[l]}
              </Link>
            ),
          )}
        </nav>
        <p>{c.footer}</p>
        <p>
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <Link href={`/apagar-conta?lang=${LANG_TAG[locale]}`}>{c.deleteData}</Link>
        </p>
      </footer>
    </div>
  );
}

/** The same path in every help language. */
export function sameIn(fn: (l: HelpLocale) => string): Record<HelpLocale, string> {
  return Object.fromEntries(HELP_LOCALES.map((l) => [l, fn(l)])) as Record<HelpLocale, string>;
}
