import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { normalizeCode } from '@/lib/refcode';
import { after } from 'next/server';
import Link from 'next/link';
import { cache } from 'react';
import { handTitle } from '@livepoker/hand-format';
import { challengeTeaser, heroLastSpot, resolveHand } from '@/lib/hand';
import { brand } from '@/config/brand';
import { ogLocale, pickLocale, previewLocale, t } from '@/lib/i18n';
import { previewCopy } from '@/lib/preview-copy';
import { getStore, loadShare as loadShareById } from '@/lib/store';
import { ShareView } from '@/components/ShareView';
import { PageFooter } from '@/components/PageFooter';

type Params = { params: Promise<{ id: string }> };
type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const loadShare = cache(loadShareById);

export async function generateMetadata({ params, searchParams }: Params & SearchParams): Promise<Metadata> {
  const { id } = await params;
  const { q, lang } = await searchParams;
  const locale = previewLocale(lang, (await headers()).get('accept-language'));
  const c = previewCopy(locale);
  const share = await loadShare(id);
  const hand = share && resolveHand(share.payload)?.hand;
  if (!share || !hand) {
    // Deleted or never existed: still a branded card in the sharer's language, never a bare link.
    const site = { url: '/opengraph-image', width: 1200, height: 630, alt: brand.name };
    return {
      title: c.notFound,
      description: c.goneBody,
      robots: { index: false },
      openGraph: { title: c.notFound, description: c.goneBody, type: 'website', siteName: brand.name, locale: ogLocale(locale), images: [site] },
      twitter: { card: 'summary_large_image', title: c.notFound, description: c.goneBody, images: [site.url] },
    };
  }
  const challenge = q === '1' || !!share.quiz;
  const title = challenge ? c.challengeTitle(share.title || handTitle(hand)) : share.title || handTitle(hand);
  const where = hand.tournament?.name || hand.location;
  const description = [where, challenge ? c.challengeDescription : c.description].filter(Boolean).join(' · ');
  // The challenge preview stops at the hero's decision so it never spoils the result. The image's
  // language is in its URL, so a cached copy never answers in another one.
  const image = { url: `/h/${id}/og?${challenge ? 'q=1&' : ''}lang=${locale}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: 'website', url: `${brand.siteUrl}/h/${id}${q === '1' ? '?q=1' : ''}`, siteName: brand.name, locale: ogLocale(locale), images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export default async function SharePage({ params, searchParams }: Params & SearchParams) {
  const { id } = await params;
  const { q, r, utm_source, utm_medium } = await searchParams;
  const param = (v: unknown) => (typeof v === 'string' && /^[\w.-]{1,40}$/.test(v) ? v : null);
  // Invite code of the player who shared (the app appends ?r=<code> to its share links).
  const invite = typeof r === 'string' ? normalizeCode(r) : null;
  const share = await loadShare(id);
  const locale = pickLocale((await headers()).get('accept-language'));
  if (!share) {
    const c = previewCopy(locale);
    return (
      <main className="page page-center">
        <h1 className="hand-title">{c.notFound}</h1>
        <p className="muted">{c.goneBody}</p>
        <Link className="btn btn-primary" href="/">
          {brand.name}
        </Link>
      </main>
    );
  }
  const store = getStore();
  after(() => store.recordView(id).catch(() => {}));

  const resolved = resolveHand(share.payload);
  if (!resolved) {
    return (
      <main className="page page-center">
        <p>{t(locale).invalid}</p>
      </main>
    );
  }
  const quiz = share.quiz ?? (q === '1' ? heroLastSpot(resolved, share.payload) : null);
  // A challenge page must not carry the answer, not even in the page source: it sends the hand
  // up to the decision, and the rest (and the comments) comes back with the friend's vote.
  const comments = share.allowComments && !quiz ? await store.listComments(id) : [];
  return (
    <>
      <ShareView
        invite={invite}
        utm={{ source: param(utm_source) ?? 'share', medium: param(utm_medium) ?? 'hand' }}
        shareId={id}
        hand={quiz ? challengeTeaser(resolved.hand, quiz) : resolved.hand}
        teaser={!!quiz}
        title={share.title}
        ask={askOf(share.payload)}
        revealAll={share.revealAll}
        quiz={quiz}
        allowComments={share.allowComments}
        initialComments={comments}
        viewCount={share.viewCount}
        locale={locale}
        shareUrl={`${brand.siteUrl}/h/${id}`}
      />
      <PageFooter locale={locale} page={`h/${id}`} />
    </>
  );
}

const askOf = (payload: unknown) => {
  const a = (payload as { ask?: unknown } | null)?.ask;
  return typeof a === 'string' && a ? a.slice(0, 140) : null;
};
