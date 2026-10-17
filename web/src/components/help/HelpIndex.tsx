import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { articles, CATEGORIES, plainText, type CategoryId } from '@/lib/help/articles';
import { ArticleList } from './ArticleList';
import { HELP_BASE, helpCopy } from './copy';
import { HelpSearch } from './HelpSearch';
import { HelpShell } from './HelpShell';

export function HelpIndex({ locale }: { locale: Locale }) {
  const c = helpCopy[locale];
  const other: Locale = locale === 'pt' ? 'en' : 'pt';
  const list = articles();
  const href = (slug: string) => `${HELP_BASE[locale]}/${slug}`;
  const items = list.map((a) => ({ href: href(a[locale].slug), title: a[locale].title, summary: a[locale].summary, text: plainText(a[locale]) }));

  return (
    <HelpShell locale={locale} otherHref={HELP_BASE[other]}>
      <section className="hc-hero">
        <h1>{c.title}</h1>
        <p className="hc-lede">{c.lede}</p>
      </section>
      <HelpSearch items={items} label={c.search} placeholder={c.searchPlaceholder} noResults={c.noResults} results={c.results}>
        {(Object.keys(CATEGORIES) as CategoryId[]).map((cat) => {
          const inCat = list.filter((a) => a.cat === cat);
          if (!inCat.length) return null;
          return (
            <section key={cat} className="hc-cat">
              <h2>{CATEGORIES[cat][locale]}</h2>
              <ArticleList locale={locale} list={inCat} />
            </section>
          );
        })}
      </HelpSearch>
      <ContactCard locale={locale} />
    </HelpShell>
  );
}

export function ContactCard({ locale }: { locale: Locale }) {
  const c = helpCopy[locale];
  return (
    <section className="hc-contact">
      <strong>{c.stillStuck}</strong>
      <Link className="hc-btn" href={`/support?lang=${locale}`}>
        {c.contactUs}
      </Link>
    </section>
  );
}
