import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { articles, findArticle, HELP_LOCALES, textOf, type HelpLocale } from '@/lib/help/articles';
import { ArticleView } from './ArticleView';
import { HELP_BASE, HELP_INDEXED, helpCopy, LANG_TAG } from './copy';
import { HelpIndex } from './HelpIndex';

// /ajuda, /pt-br/ajuda, /es/ayuda and /help are the same pages in four languages; these build them.
const robots = HELP_INDEXED ? undefined : { index: false, follow: false };

const languages = (fn: (l: HelpLocale) => string) => Object.fromEntries(HELP_LOCALES.map((l) => [LANG_TAG[l], fn(l)]));

export function indexMetadata(locale: HelpLocale): Metadata {
  const c = helpCopy[locale];
  return {
    title: c.help,
    description: c.lede,
    robots,
    alternates: { canonical: HELP_BASE[locale], languages: languages((l) => HELP_BASE[l]) },
  };
}

export function IndexPage({ locale }: { locale: HelpLocale }) {
  return <HelpIndex locale={locale} />;
}

export function articleParams(locale: HelpLocale) {
  return articles().map((a) => ({ slug: textOf(a, locale).slug }));
}

export async function articleMetadata(locale: HelpLocale, params: Promise<{ slug: string }>): Promise<Metadata> {
  const a = findArticle(locale, (await params).slug);
  if (!a) return { robots: { index: false } };
  const t = textOf(a, locale);
  return {
    title: `${t.title} · ${helpCopy[locale].help}`,
    description: t.summary,
    robots,
    alternates: { canonical: `${HELP_BASE[locale]}/${t.slug}`, languages: languages((l) => `${HELP_BASE[l]}/${textOf(a, l).slug}`) },
  };
}

export async function ArticlePage({ locale, params }: { locale: HelpLocale; params: Promise<{ slug: string }> }) {
  const a = findArticle(locale, (await params).slug);
  if (!a) notFound();
  return <ArticleView article={a} locale={locale} />;
}
