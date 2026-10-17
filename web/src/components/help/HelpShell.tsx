import Link from 'next/link';
import { brand } from '@/config/brand';
import { Mark, Wordmark } from '@/components/Brand';
import type { Locale } from '@/lib/i18n';
import { HELP_BASE, helpCopy } from './copy';
import './help.css';

/** Header and footer shared by /ajuda, /help and /support. `otherHref` is the same page in the other language. */
export function HelpShell({ locale, otherHref, children }: { locale: Locale; otherHref: string; children: React.ReactNode }) {
  const c = helpCopy[locale];
  return (
    <div className="hc" lang={locale}>
      <header className="hc-bar">
        <Link className="hc-logo" href="/" aria-label={brand.name}>
          <Mark size={26} />
          <Wordmark />
        </Link>
        <nav className="hc-nav">
          <Link href={HELP_BASE[locale]}>{c.help}</Link>
          <Link href={otherHref} hrefLang={locale === 'pt' ? 'en' : 'pt'}>
            {c.otherLang}
          </Link>
        </nav>
      </header>
      <main className="hc-main">{children}</main>
      <footer className="hc-foot">
        <p>{c.footer}</p>
        <p>
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/delete-account">Delete data</a>
        </p>
      </footer>
    </div>
  );
}
