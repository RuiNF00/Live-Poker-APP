import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { brand } from '@/config/brand';
import { ogLocale, pickLocale, previewLocale } from '@/lib/i18n';
import { normalizeCode } from '@/lib/refcode';
import { loadSwap as loadSwapById, publicSwap } from '@/lib/swaps';
import { SwapView } from '@/components/swap/SwapView';
import { swapCopy } from '@/components/swap/copy';

type Params = { params: Promise<{ id: string }> };
type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const loadSwap = cache(loadSwapById);

export async function generateMetadata({ params, searchParams }: Params & SearchParams): Promise<Metadata> {
  const { id } = await params;
  const { lang } = await searchParams;
  const rec = await loadSwap(id);
  const locale = previewLocale(lang, (await headers()).get('accept-language'));
  const c = swapCopy(locale);
  if (!rec) return { title: c.notFound, robots: { index: false } };
  const t = rec.terms;
  const title = c.metaTitle(t.a.name, rec.confirmedName || t.b.name, t.title);
  // No amounts in the preview: the chat it lands in may have more than the two players.
  const image = { url: `/swap/${id}/og?lang=${locale}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description: c.metaDescription,
    robots: { index: false },
    openGraph: { title, description: c.metaDescription, type: 'website', url: `${brand.siteUrl}/swap/${id}`, siteName: brand.name, locale: ogLocale(locale), images: [image] },
    twitter: { card: 'summary_large_image', title, description: c.metaDescription, images: [image.url] },
  };
}

export default async function SwapPage({ params, searchParams }: Params & SearchParams) {
  const { id } = await params;
  const { r } = await searchParams;
  const rec = await loadSwap(id);
  if (!rec) notFound();
  const locale = pickLocale((await headers()).get('accept-language'));
  const invite = typeof r === 'string' ? normalizeCode(r) : null;
  return <SwapView locale={locale} initial={publicSwap(rec, null)} invite={invite} />;
}
