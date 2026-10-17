import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { brand } from '@/config/brand';
import { pickLocale } from '@/lib/i18n';
import { loadOffer as loadOfferById } from '@/lib/offers-store';
import { normalizeCode } from '@/lib/refcode';
import { OfferView } from '@/components/offer/OfferView';
import { offerCopy, offerFormat } from '@/components/offer/copy';

type Params = { params: Promise<{ id: string }> };
type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// A player's festival action package: sweatbook.poker/o/<id>. Backers reserve a piece here;
// the player confirms in the app. Not for search engines, and never shows who reserved.
const loadOffer = cache(loadOfferById);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const rec = await loadOffer(id);
  const locale = pickLocale((await headers()).get('accept-language'));
  const c = offerCopy(locale);
  if (!rec) return { title: c.notFound, robots: { index: false, follow: false } };
  const o = rec.offer;
  const title = c.metaTitle(o.player, o.title);
  const description = c.metaDescription(c.events(o.events.length), c.markup(offerFormat(locale).markup(o.markup)));
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', url: `${brand.siteUrl}/o/${id}`, siteName: brand.name },
    twitter: { card: 'summary', title, description },
  };
}

export default async function OfferPage({ params, searchParams }: Params & SearchParams) {
  const { id } = await params;
  const { r } = await searchParams;
  const rec = await loadOffer(id);
  if (!rec) notFound();
  const locale = pickLocale((await headers()).get('accept-language'));
  const invite = typeof r === 'string' ? normalizeCode(r) : null;
  return <OfferView id={id} locale={locale} initial={rec.offer} initialTaken={rec.taken} invite={invite} />;
}
