import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { brand } from '@/config/brand';
import { Landing, type Search } from '@/components/landing/Landing';
import { landingCopy } from '@/components/landing/copy';
import { isLocale, pickLocale } from '@/lib/i18n';

/** Title and description in the page's language (same choice as Landing: ?lang=, else the browser). */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const { lang } = await searchParams;
  const locale = isLocale(lang) ? lang : pickLocale((await headers()).get('accept-language'));
  return {
    title: { absolute: `${brand.name} · ${brand.tagline[locale]}` },
    description: landingCopy(locale).metaDescription,
    alternates: { canonical: '/' },
    openGraph: { type: 'website', siteName: brand.name, url: '/' },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  return <Landing search={await searchParams} />;
}
