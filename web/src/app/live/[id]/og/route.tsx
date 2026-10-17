import { previewLocale } from '@/lib/i18n';
import { loadLive } from '@/lib/live';
import { liveOgImage } from '@/lib/og-pages';

/** Link preview for a backer live page: the session as it stands when the link is pasted, in `?lang=`. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = previewLocale(new URL(req.url).searchParams.get('lang'), req.headers.get('accept-language'));
  const rec = await loadLive(id).catch(() => null);
  // A held result has no prize to show yet: the generic preview, not a misleading "busted".
  return liveOgImage(rec && !rec.snapshot.heldUntil ? rec.snapshot : null, locale);
}
