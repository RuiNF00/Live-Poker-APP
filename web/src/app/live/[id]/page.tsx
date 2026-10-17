import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { brand } from '@/config/brand';
import { pickLocale } from '@/lib/i18n';
import { liveStore, loadLive as loadLiveById } from '@/lib/live';
import { normalizeCode } from '@/lib/refcode';
import { LiveView } from '@/components/live/LiveView';
import { liveCopy } from '@/components/live/copy';

type Params = { params: Promise<{ id: string }> };
type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const loadLive = cache(loadLiveById);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const rec = await loadLive(id);
  const locale = pickLocale((await headers()).get('accept-language'));
  const c = liveCopy(locale);
  if (!rec) return { title: c.notFound, robots: { index: false } };
  const s = rec.snapshot;
  const title = c.metaTitle(s.player, s.name || (s.kind === 'mtt' ? c.tournament : c.cash));
  const description = [s.venue, c.metaDescription].filter(Boolean).join(' · ');
  // Versioned by the last update, so WhatsApp doesn't keep showing an old stack forever.
  const image = { url: `/live/${id}/og?v=${Date.parse(rec.updatedAt) || 0}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: 'website', url: `${brand.siteUrl}/live/${id}`, siteName: brand.name, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export default async function LivePage({ params, searchParams }: Params & SearchParams) {
  const { id } = await params;
  const { r } = await searchParams;
  const rec = await loadLive(id);
  if (!rec) notFound();
  const locale = pickLocale((await headers()).get('accept-language'));
  after(() => liveStore().recordView(id).catch(() => {}));
  const invite = typeof r === 'string' ? normalizeCode(r) : null;
  return <LiveView id={id} locale={locale} initial={rec.snapshot} initialUpdatedAt={Date.parse(rec.updatedAt)} invite={invite} />;
}
