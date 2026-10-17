import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { handTitle, validateHand } from '@livepoker/hand-format';
import { brand } from '@/config/brand';
import { pickLocale, t } from '@/lib/i18n';
import { getStore, loadShare as loadShareById } from '@/lib/store';
import { ShareView } from '@/components/ShareView';

type Params = { params: Promise<{ id: string }> };

const loadShare = cache(loadShareById);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const share = await loadShare(id);
  if (!share) return { title: 'Mão não encontrada', robots: { index: false } };
  const hand = share.hand;
  const title = share.title || handTitle(hand);
  const where = hand.tournament?.name || hand.location;
  const description = [where, 'Vê a mão e diz como jogavas.'].filter(Boolean).join(' · ');
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: 'website', url: `${brand.siteUrl}/h/${id}`, siteName: brand.name },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SharePage({ params }: Params) {
  const { id } = await params;
  const share = await loadShare(id);
  if (!share) notFound();
  const locale = pickLocale((await headers()).get('accept-language'));
  const store = getStore();
  after(() => store.recordView(id).catch(() => {}));

  if (validateHand(share.hand).length) {
    return (
      <main className="page page-center">
        <p>{t(locale).invalid}</p>
      </main>
    );
  }
  const comments = share.allowComments ? await store.listComments(id) : [];
  return (
    <ShareView
      shareId={id}
      hand={share.hand}
      title={share.title}
      revealAll={share.revealAll}
      quiz={share.quiz}
      allowComments={share.allowComments}
      initialComments={comments}
      viewCount={share.viewCount}
      locale={locale}
      shareUrl={`${brand.siteUrl}/h/${id}`}
    />
  );
}
