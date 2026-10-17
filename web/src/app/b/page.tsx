import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { BackingView } from '@/components/backing/BackingView';
import { backingCopy } from '@/components/backing/copy';
import { pickLocale } from '@/lib/i18n';
import { normalizeCode } from '@/lib/refcode';

type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// A backer's statement: sweatbook.poker/b#<data>. The page is the same for everyone;
// the numbers are in the fragment and only the browser reads them.
export async function generateMetadata(): Promise<Metadata> {
  const c = backingCopy(pickLocale((await headers()).get('accept-language')));
  return { title: c.metaTitle, description: c.metaDescription, robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function BackingPage({ searchParams }: SearchParams) {
  const { r } = await searchParams;
  const locale = pickLocale((await headers()).get('accept-language'));
  return <BackingView locale={locale} invite={typeof r === 'string' ? normalizeCode(r) : null} />;
}
