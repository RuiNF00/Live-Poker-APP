import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { brand } from '@/config/brand';
import { Landing, type Search } from '@/components/landing/Landing';
import { landingCopy } from '@/components/landing/copy';
import { langParam, ogLocale, previewLocale } from '@/lib/i18n';
import { siteImage } from '@/lib/site-image';

/** Title and description in the page's language (same choice as Landing: ?lang=, else the browser). */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const { lang } = await searchParams;
  // ?lang=pt-PT as the app writes it, as well as ?lang=pt.
  const locale = previewLocale(lang, (await headers()).get('accept-language'));
  const description = landingCopy(locale).metaDescription;
  const title = `${brand.name} · ${brand.tagline[locale]}`;
  // A link that names its language (?lang=en, marketing's links) keeps it in the preview: chat apps
  // fetch og:url again, so it carries the ?lang= too.
  const url = langParam(lang) ? `/?lang=${locale}` : '/';
  return {
    title: { absolute: title },
    description,
    alternates: {
      // Each language its own canonical, so Google takes the hreflang below.
      canonical: url,
      languages: { 'pt-PT': '/?lang=pt', 'pt-BR': '/?lang=pt-BR', en: '/?lang=en', es: '/?lang=es', 'x-default': '/' },
    },
    openGraph: { type: 'website', siteName: brand.name, url, title, description, locale: ogLocale(locale), images: [siteImage(locale)] },
    twitter: { card: 'summary_large_image', title, description, images: [siteImage(locale)] },
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  return <Landing search={await searchParams} />;
}
