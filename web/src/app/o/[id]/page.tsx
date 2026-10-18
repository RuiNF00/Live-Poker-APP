import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ogLocale, pickLocale, previewLocale } from '@/lib/i18n';
import { loadOffer as loadOfferById } from '@/lib/offers-store';
import { normalizeCode } from '@/lib/refcode';
import { OfferView } from '@/components/offer/OfferView';
import { offerCopy } from '@/components/offer/copy';
import { PageFooter } from '@/components/PageFooter';

type Params = { params: Promise<{ id: string }> };
type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// A backer's private link to the piece of a festival they agreed with the player:
// sweatbook.poker/o/<id>. Only for the backer the player sent it to: not indexed, no referrer.
const loadOffer = cache(loadOfferById);

export async function generateMetadata({ params, searchParams }: Params & SearchParams): Promise<Metadata> {
  const { id } = await params;
  const rec = await loadOffer(id);
  const locale = previewLocale((await searchParams).lang, (await headers()).get('accept-language'));
  const c = offerCopy(locale);
  const base = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
  if (!rec) return { title: c.notFound, ...base };
  const title = c.metaTitle(rec.offer.player);
  const description = c.metaDescription;
  return { title, description, ...base, openGraph: { title, description, type: 'website', locale: ogLocale(locale), images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Sweatbook' }] }, twitter: { card: 'summary', title, description } };
}

export default async function OfferPage({ params, searchParams }: Params & SearchParams) {
  const { id } = await params;
  const { r } = await searchParams;
  const rec = await loadOffer(id);
  if (!rec) notFound();
  const locale = pickLocale((await headers()).get('accept-language'));
  const invite = typeof r === 'string' ? normalizeCode(r) : null;
  return (
    <>
      <OfferView id={id} locale={locale} agreement={rec.offer} initialConfirmedAt={rec.confirmedAt} invite={invite} />
      <PageFooter locale={locale} page={`o/${id}`} />
    </>
  );
}
