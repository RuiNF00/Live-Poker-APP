import { loadLive } from '@/lib/live';
import { liveOgImage } from '@/lib/og-pages';

/** Link preview for a backer live page: the session as it stands when the link is pasted. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await loadLive(id).catch(() => null);
  // A held result has no prize to show yet: the generic preview, not a misleading "busted".
  return liveOgImage(rec && !rec.snapshot.heldUntil ? rec.snapshot : null);
}
