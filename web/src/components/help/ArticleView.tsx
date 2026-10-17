import Link from 'next/link';
import { articles, CATEGORIES, textOf, type Article, type Block, type HelpLocale } from '@/lib/help/articles';
import { ArticleList } from './ArticleList';
import { HELP_BASE, helpCopy } from './copy';
import { ContactCard } from './HelpIndex';
import { HelpShell, sameIn } from './HelpShell';

export function BlockView({ b }: { b: Block }) {
  if (typeof b === 'string') return <p>{b}</p>;
  if ('steps' in b)
    return (
      <ol className="hc-steps">
        {b.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    );
  if ('list' in b)
    return (
      <ul className="hc-bullets">
        {b.list.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    );
  return <p className="hc-note">{b.note}</p>;
}

export function ArticleView({ article, locale }: { article: Article; locale: HelpLocale }) {
  const c = helpCopy[locale];
  const a = textOf(article, locale);
  const related = articles().filter((x) => x.cat === article.cat && x.id !== article.id).slice(0, 3);

  return (
    <HelpShell locale={locale} hrefs={sameIn((l) => `${HELP_BASE[l]}/${textOf(article, l).slug}`)}>
      <nav className="hc-crumbs" aria-label={c.help}>
        <Link href={HELP_BASE[locale]}>{c.help}</Link> <span aria-hidden>›</span> {CATEGORIES[article.cat][locale]}
      </nav>
      <article className="hc-article">
        <h1>{a.title}</h1>
        <p className="hc-lede">{a.summary}</p>
        {a.body.map((b, i) => (
          <BlockView key={i} b={b} />
        ))}
      </article>
      {related.length ? (
        <section className="hc-cat">
          <h2>{c.related}</h2>
          <ArticleList locale={locale} list={related} />
        </section>
      ) : null}
      <ContactCard locale={locale} />
    </HelpShell>
  );
}
