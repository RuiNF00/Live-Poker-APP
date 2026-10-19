import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { handTitle } from '@livepoker/hand-format';
import { Mark } from '@/components/Brand';
import { CoachView, type CoachHand } from '@/components/coach/CoachView';
import { coachCopy } from '@/components/coach/copy';
import { coachStore, TOKEN_RE } from '@/lib/coach';
import { resolveHand } from '@/lib/hand';
import { withoutPrivateGame } from '@/lib/hand-private';
import { ogLocale, pickLocale, previewLocale } from '@/lib/i18n';
import '@/components/coach/coach.css';
import { PageFooter } from '@/components/PageFooter';

type Params = { params: Promise<{ token: string }> };

// Deliberately bland: a preview in a chat must not tell anyone whose hands these are.
// In the sharer's language (?lang=), like every other shared link.
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  const locale = previewLocale(lang, (await headers()).get('accept-language'));
  const c = coachCopy(locale);
  const title = c.kicker('');
  const description = `${c.privateBadge}. ${c.cta}`;
  return {
    title: { absolute: `${title} · Sweatbook` },
    description,
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
    openGraph: { title, description, type: 'website', siteName: 'Sweatbook', locale: ogLocale(locale), images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Sweatbook' }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/opengraph-image'] },
  };
}

/** Private coaching link: https://sweatbook.poker/c/<token>. Made from the app; the player can revoke it. */
export default async function CoachLink({ params }: Params) {
  const { token } = await params;
  const locale = pickLocale((await headers()).get('accept-language'));
  const link = TOKEN_RE.test(token) ? await coachStore().open(token) : null;
  if (!link) {
    // Wrong, revoked or expired all look the same: nothing tells a guesser which.
    const c = coachCopy(locale);
    return (
      <main className="page page-center">
        <Mark size={44} />
        <h1>{c.goneTitle}</h1>
        <p className="muted">{c.goneBody}</p>
      </main>
    );
  }
  const hands: CoachHand[] = [];
  for (const h of link.hands) {
    // Links made before the buy-in and venue were dropped (lib/hand-private) still have them stored.
    const r = resolveHand(withoutPrivateGame(h.payload));
    if (!r) continue;
    const title = (h.payload as { title?: unknown }).title;
    hands.push({ id: h.id, hand: r.hand, title: typeof title === 'string' && title.trim() ? title.trim() : handTitle(r.hand) });
  }
  return (
    <>
      <CoachView token={token} title={link.title} player={link.player} expiresAt={link.expiresAt} hands={hands} comments={link.comments} locale={locale} />
      <PageFooter locale={locale} page={`c`} />
    </>
  );
}
