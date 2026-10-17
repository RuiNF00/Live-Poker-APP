import Link from 'next/link';
import { articles, CATEGORIES, plainText, textOf, type CategoryId, type HelpLocale } from '@/lib/help/articles';
import { ArticleList } from './ArticleList';
import { HELP_BASE, helpCopy } from './copy';
import { HelpSearch } from './HelpSearch';
import { HelpShell, sameIn } from './HelpShell';

export function HelpIndex({ locale }: { locale: HelpLocale }) {
  const c = helpCopy[locale];
  const list = articles();
  const items = list.map((a) => {
    const t = textOf(a, locale);
    return { href: `${HELP_BASE[locale]}/${t.slug}`, title: t.title, summary: t.summary, text: plainText(t) };
  });

  return (
    <HelpShell locale={locale} hrefs={sameIn((l) => HELP_BASE[l])}>
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

export function ContactCard({ locale }: { locale: HelpLocale }) {
  const c = helpCopy[locale];
  return (
    <section className="hc-contact">
      <strong>{c.stillStuck}</strong>
      <Link className="hc-btn" href={`/support?lang=${locale === 'br' ? 'pt-BR' : locale}`}>
        {c.contactUs}
      </Link>
    </section>
  );
}
