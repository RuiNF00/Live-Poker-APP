import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import { articles, findArticle } from '@/lib/help/articles';
import { ArticleView } from './ArticleView';
import { HELP_BASE, HELP_INDEXED, helpCopy } from './copy';
import { HelpIndex } from './HelpIndex';

// /ajuda and /help are the same pages in Portuguese and English; these build both.
const robots = HELP_INDEXED ? undefined : { index: false, follow: false };

export function indexMetadata(locale: Locale): Metadata {
  const c = helpCopy[locale];
  return {
    title: c.help,
    description: c.lede,
    robots,
    alternates: { canonical: HELP_BASE[locale], languages: { pt: HELP_BASE.pt, en: HELP_BASE.en } },
  };
}

export function IndexPage({ locale }: { locale: Locale }) {
  return <HelpIndex locale={locale} />;
}

export function articleParams(locale: Locale) {
  return articles().map((a) => ({ slug: a[locale].slug }));
}

export async function articleMetadata(locale: Locale, params: Promise<{ slug: string }>): Promise<Metadata> {
  const a = findArticle(locale, (await params).slug);
  if (!a) return { robots: { index: false } };
  return {
    title: `${a[locale].title} · ${helpCopy[locale].help}`,
    description: a[locale].summary,
    robots,
    alternates: {
      canonical: `${HELP_BASE[locale]}/${a[locale].slug}`,
      languages: { pt: `${HELP_BASE.pt}/${a.pt.slug}`, en: `${HELP_BASE.en}/${a.en.slug}` },
    },
  };
}

export async function ArticlePage({ locale, params }: { locale: Locale; params: Promise<{ slug: string }> }) {
  const a = findArticle(locale, (await params).slug);
  if (!a) notFound();
  return <ArticleView article={a} locale={locale} />;
}
