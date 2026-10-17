import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { brand } from '@/config/brand';
import { ogLocale, pageLocale, previewLocale } from '@/lib/i18n';
import { limited } from '@/lib/abuse';
import { liveStore, loadLive as loadLiveById } from '@/lib/live';
import { normalizeCode } from '@/lib/refcode';
import { LiveView } from '@/components/live/LiveView';
import { liveCopy } from '@/components/live/copy';
import { PageFooter } from '@/components/PageFooter';

type Params = { params: Promise<{ id: string }> };
type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const loadLive = cache(loadLiveById);

export async function generateMetadata({ params, searchParams }: Params & SearchParams): Promise<Metadata> {
  const { id } = await params;
  const { lang } = await searchParams;
  const rec = await loadLive(id);
  const locale = previewLocale(lang, (await headers()).get('accept-language'));
  const c = liveCopy(locale);
  if (!rec) return { title: c.notFound, robots: { index: false } };
  const s = rec.snapshot;
  const title = c.metaTitle(s.player, s.name || (s.kind === 'mtt' ? c.tournament : c.cash));
  const description = [s.venue, c.metaDescription].filter(Boolean).join(' · ');
  // Versioned by the last update, so WhatsApp doesn't keep showing an old stack forever.
  const image = { url: `/live/${id}/og?v=${Date.parse(rec.updatedAt) || 0}&lang=${locale}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: 'website', url: `${brand.siteUrl}/live/${id}`, siteName: brand.name, locale: ogLocale(locale), images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: image.url, alt: title }] },
  };
}

export default async function LivePage({ params, searchParams }: Params & SearchParams) {
  const { id } = await params;
  const { r, lang } = await searchParams;
  const rec = await loadLive(id);
  if (!rec) notFound();
  const h = await headers();
  const locale = pageLocale(lang, h.get('accept-language'));
  // One view per visitor (IP) per link per day, so reloads don't inflate the count.
  const req = new Request(`${brand.siteUrl}/live/${id}`, { headers: h });
  after(async () => {
    if (!(await limited(req, `live-view:${id}`, 1, 86400))) await liveStore().recordView(id).catch(() => {});
  });
  const invite = typeof r === 'string' ? normalizeCode(r) : null;
  return (
    <>
      <LiveView id={id} locale={locale} initial={rec.snapshot} initialUpdatedAt={Date.parse(rec.updatedAt)} invite={invite} />
      <PageFooter locale={locale} page={`live/${id}`} />
    </>
  );
}
