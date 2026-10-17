import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { BackingView } from '@/components/backing/BackingView';
import { backingCopy } from '@/components/backing/copy';
import { ogLocale, pickLocale, previewLocale } from '@/lib/i18n';
import { normalizeCode } from '@/lib/refcode';

type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// A backer's statement: sweatbook.poker/b#<data>. The page is the same for everyone;
// the numbers are in the fragment and only the browser reads them.
export async function generateMetadata({ searchParams }: SearchParams): Promise<Metadata> {
  // The preview in the player's language (the app adds ?lang=); no amounts, they are in the fragment.
  const locale = previewLocale((await searchParams).lang, (await headers()).get('accept-language'));
  const c = backingCopy(locale);
  return {
    title: { absolute: c.metaTitle },
    description: c.metaDescription,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    openGraph: { title: c.metaTitle, description: c.metaDescription, type: 'website', siteName: 'Sweatbook', locale: ogLocale(locale), images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Sweatbook' }] },
  };
}

export default async function BackingPage({ searchParams }: SearchParams) {
  const { r } = await searchParams;
  const locale = pickLocale((await headers()).get('accept-language'));
  return <BackingView locale={locale} invite={typeof r === 'string' ? normalizeCode(r) : null} />;
}
