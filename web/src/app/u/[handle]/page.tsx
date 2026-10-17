import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { handTitle } from '@livepoker/hand-format';
import { brand } from '@/config/brand';
import { profileCopy } from '@/components/profile/copy';
import { ProfileView, type ProfileHand } from '@/components/profile/ProfileView';
import { resolveHand } from '@/lib/hand';
import { pickLocale } from '@/lib/i18n';
import { loadProfile as loadProfileByHandle, profileStore } from '@/lib/profiles';
import { loadShare } from '@/lib/store';
import { storeLinks } from '@/lib/storeLinks';

type Params = { params: Promise<{ handle: string }> };

const loadProfile = cache(loadProfileByHandle);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const rec = await loadProfile((await params).handle);
  const c = profileCopy('pt');
  if (!rec) return { title: c.notFound, robots: { index: false } };
  const name = rec.payload.name || `@${rec.handle}`;
  const title = `${name} (@${rec.handle})`;
  const description = c.metaDescription(name);
  const image = { url: `/u/${rec.handle}/og?v=${Date.parse(rec.updatedAt) || 0}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    // Opt-in, but still a person: shared by link, never listed by search engines.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'profile', url: `${brand.siteUrl}/u/${rec.handle}`, siteName: brand.name, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

/** A shared hand as a profile row; the board stays hidden on challenges so the row never spoils the answer. */
async function profileHand(id: string): Promise<ProfileHand | null> {
  const share = await loadShare(id).catch(() => null);
  const hand = share && resolveHand(share.payload)?.hand;
  if (!share || !hand) return null; // deleted or hidden since the profile was saved
  const challenge = !!share.quiz;
  const b = hand.board;
  return {
    id,
    title: share.title || handTitle(hand),
    hero: hand.players.find((p) => p.isHero)?.cards ?? [],
    board: challenge ? [] : [...(b?.flop ?? []), ...(b?.turn ? [b.turn] : []), ...(b?.river ? [b.river] : [])],
    where: hand.tournament?.name || hand.location || (hand.format === 'cash' ? 'Cash game' : ''),
    challenge,
  };
}

/** Public player profile: https://sweatbook.poker/u/<handle>. Made and kept up to date from the app. */
export default async function Profile({ params }: Params) {
  const rec = await loadProfile((await params).handle);
  if (!rec) notFound();
  const locale = pickLocale((await headers()).get('accept-language'));
  const hands = (await Promise.all(rec.payload.hands.map(profileHand))).filter((h): h is ProfileHand => !!h);
  after(() => profileStore().recordView(rec.handle).catch(() => {}));
  const stores = storeLinks({ utm_source: 'web', utm_medium: 'profile', utm_campaign: rec.handle }, rec.payload.ref);
  return <ProfileView handle={rec.handle} profile={rec.payload} hands={hands} locale={locale} stores={stores} />;
}
