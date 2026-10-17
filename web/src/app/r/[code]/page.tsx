import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { brand } from '@/config/brand';
import { Landing, type Search } from '@/components/landing/Landing';
import { landingCopy } from '@/components/landing/copy';
import { ogLocale, previewLocale } from '@/lib/i18n';
import { normalizeCode } from '@/lib/refcode';

/** The preview (WhatsApp, X, Instagram) in the sharer's language: the app adds `?lang=` to its invite links. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const { lang } = await searchParams;
  const locale = previewLocale(lang, (await headers()).get('accept-language'));
  const { title, body: description } = landingCopy(locale).invite;
  const image = { url: `/og/invite?lang=${locale}`, width: 1200, height: 630, alt: title };
  return {
    title: { absolute: title },
    description,
    robots: { index: false },
    openGraph: { title, description, type: 'website', siteName: brand.name, locale: ogLocale(locale), images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: image.url, alt: title }] },
  };
}

/** Invite link: https://sweatbook.poker/r/<code>. Opens the app when installed (universal link). */
export default async function Invite({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Search> }) {
  // A code that is not ours gets an invalid-invite hero (null), not the hand 404.
  const code = normalizeCode((await params).code);
  return <Landing search={await searchParams} invite={code} />;
}
