import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { cache } from 'react';
import { handTitle } from '@livepoker/hand-format';
import { Mark } from '@/components/Brand';
import { PackView, type PackHand } from '@/components/pack/PackView';
import { packCopy } from '@/components/pack/copy';
import { brand } from '@/config/brand';
import { resolveHand } from '@/lib/hand';
import { ogLocale, pickLocale, previewLocale } from '@/lib/i18n';
import { PACK_ID_RE, packStore } from '@/lib/packs';
import { normalizeCode } from '@/lib/refcode';
import { getStore, loadShare } from '@/lib/store';
import { PageFooter } from '@/components/PageFooter';

type Params = { params: Promise<{ id: string }> };
type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The pack with the hands that are still shared, in the order the player chose. */
const loadPack = cache(async (id: string) => {
  const pack = PACK_ID_RE.test(id) ? await packStore().get(id) : null;
  if (!pack) return null;
  const store = getStore();
  const hands: PackHand[] = [];
  for (const shareId of pack.handIds) {
    const share = await loadShare(shareId);
    const r = share && resolveHand(share.payload);
    if (!share || !r) continue;
    hands.push({
      shareId,
      hand: r.hand,
      title: share.title || handTitle(r.hand),
      revealAll: share.revealAll,
      allowComments: share.allowComments,
      comments: share.allowComments ? await store.listComments(shareId) : [],
      viewCount: share.viewCount,
    });
  }
  return hands.length ? { pack, hands } : null;
});

// Neutral on purpose: a preview in a group chat says how many hands, never whose or the amounts.
export async function generateMetadata({ params, searchParams }: Params & SearchParams): Promise<Metadata> {
  const { id } = await params;
  const { lang } = await searchParams;
  const locale = previewLocale(lang, (await headers()).get('accept-language'));
  const c = packCopy(locale);
  const found = await loadPack(id);
  const title = found ? c.metaTitle(found.pack.title, found.hands.length) : c.gone;
  // Gone: the site's own card, so the link still reads as Sweatbook.
  const image = found ? { url: `/p/${id}/og?lang=${locale}`, width: 1200, height: 630, alt: title } : { url: '/opengraph-image', width: 1200, height: 630, alt: brand.name };
  return {
    title: { absolute: `${title} · ${brand.name}` },
    description: c.metaDescription,
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
    openGraph: {
      title,
      description: c.metaDescription,
      type: 'website',
      url: `${brand.siteUrl}/p/${id}`,
      siteName: brand.name,
      locale: ogLocale(locale),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description: c.metaDescription, images: [image.url] },
  };
}

/** Several hands behind one link (a tournament, a folder): https://sweatbook.poker/p/<id>. Made from the app. */
export default async function PackPage({ params, searchParams }: Params & SearchParams) {
  const { id } = await params;
  const { r, utm_source, utm_medium } = await searchParams;
  const param = (v: unknown) => (typeof v === 'string' && /^[\w.-]{1,40}$/.test(v) ? v : null);
  const locale = pickLocale((await headers()).get('accept-language'));
  const found = await loadPack(id);
  if (!found) {
    // Unknown, deleted or every hand unshared: all look the same.
    return (
      <main className="page page-center">
        <Mark size={44} />
        <h1>{packCopy(locale).gone}</h1>
      </main>
    );
  }
  return (
    <>
      <PackView
        title={found.pack.title}
        hands={found.hands}
        hideAmounts={found.pack.hideAmounts}
        locale={locale}
        siteUrl={brand.siteUrl}
        invite={typeof r === 'string' ? normalizeCode(r) : null}
        utm={{ source: param(utm_source) ?? 'share', medium: param(utm_medium) ?? 'pack' }}
      />
      <PageFooter locale={locale} page={`p/${id}`} />
    </>
  );
}
