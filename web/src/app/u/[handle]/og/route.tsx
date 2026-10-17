import { loadProfile } from '@/lib/profiles';
import { profileOgImage } from '@/lib/og-pages';

/** Link preview for a public profile: name, handle and what they share (never amounts). */
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const rec = await loadProfile((await params).handle).catch(() => null);
  return profileOgImage(rec);
}
