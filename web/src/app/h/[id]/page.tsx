import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { normalizeCode } from '@/lib/refcode';
import { after } from 'next/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { handTitle } from '@livepoker/hand-format';
import { heroLastSpot, resolveHand } from '@/lib/hand';
import { brand } from '@/config/brand';
import { pickLocale, t } from '@/lib/i18n';
import { getStore, loadShare as loadShareById } from '@/lib/store';
import { ShareView } from '@/components/ShareView';

type Params = { params: Promise<{ id: string }> };
type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const loadShare = cache(loadShareById);

export async function generateMetadata({ params, searchParams }: Params & SearchParams): Promise<Metadata> {
  const { id } = await params;
  const { q } = await searchParams;
  const share = await loadShare(id);
  const hand = share && resolveHand(share.payload)?.hand;
  if (!share || !hand) return { title: 'Mão não encontrada', robots: { index: false } };
  const challenge = q === '1' || !!share.quiz;
  const title = challenge ? `Desafio: o que fazes aqui? · ${share.title || handTitle(hand)}` : share.title || handTitle(hand);
  const where = hand.tournament?.name || hand.location;
  const description = [where, challenge ? 'Vota no que fazias antes de veres a jogada.' : 'Vê a mão e diz como jogavas.']
    .filter(Boolean)
    .join(' · ');
  // The challenge preview stops at the hero's decision so it never spoils the result.
  const image = { url: `/h/${id}/og${challenge ? '?q=1' : ''}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: 'website', url: `${brand.siteUrl}/h/${id}${q === '1' ? '?q=1' : ''}`, siteName: brand.name, images: [image] },
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
  if (!share) notFound();
  const locale = pickLocale((await headers()).get('accept-language'));
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
  const comments = share.allowComments ? await store.listComments(id) : [];
  return (
    <ShareView
      invite={invite}
      utm={{ source: param(utm_source) ?? 'share', medium: param(utm_medium) ?? 'hand' }}
      shareId={id}
      hand={resolved.hand}
      title={share.title}
      revealAll={share.revealAll}
      quiz={share.quiz ?? (q === '1' ? heroLastSpot(resolved, share.payload) : null)}
      allowComments={share.allowComments}
      initialComments={comments}
      viewCount={share.viewCount}
      locale={locale}
      shareUrl={`${brand.siteUrl}/h/${id}`}
    />
  );
}
