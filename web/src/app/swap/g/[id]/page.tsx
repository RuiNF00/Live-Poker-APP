import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { brand } from '@/config/brand';
import { ogLocale, pickLocale, previewLocale } from '@/lib/i18n';
import { groupCreatorPro } from '@/lib/swap-pro';
import { normalizeCode } from '@/lib/refcode';
import { loadGroup as loadGroupById, publicGroup } from '@/lib/swap-groups';
import { GroupView } from '@/components/swap/GroupView';
import { swapCopy } from '@/components/swap/copy';

type Params = { params: Promise<{ id: string }> };
type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const loadGroup = cache(loadGroupById);

export async function generateMetadata({ params, searchParams }: Params & SearchParams): Promise<Metadata> {
  const { id } = await params;
  const rec = await loadGroup(id);
  const locale = previewLocale((await searchParams).lang, (await headers()).get('accept-language'));
  const c = swapCopy(locale);
  if (!rec) return { title: c.notFound, robots: { index: false }, referrer: 'no-referrer' };
  const title = c.groupMetaTitle(rec.terms.title, rec.seats.length);
  // No names or amounts in the preview: the chat it lands in is the whole group, maybe more.
  return {
    title,
    description: c.groupMetaDescription,
    robots: { index: false },
    referrer: 'no-referrer',
    openGraph: { title, description: c.groupMetaDescription, type: 'website', url: `${brand.siteUrl}/swap/g/${id}`, siteName: brand.name, locale: ogLocale(locale), images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Sweatbook' }] },
  };
}

export default async function GroupSwapPage({ params, searchParams }: Params & SearchParams) {
  const { id } = await params;
  const { r } = await searchParams;
  const rec = await loadGroup(id);
  if (!rec) notFound();
  const locale = pickLocale((await headers()).get('accept-language'));
  const invite = typeof r === 'string' ? normalizeCode(r) : null;
  // Who pays whom shows only when the group's creator has Pro; otherwise just the results.
  const accounts = await groupCreatorPro(id);
  return <GroupView locale={locale} initial={publicGroup(rec, null)} accounts={accounts} invite={invite} />;
}
