import { loadLive } from '@/lib/live';
import { liveOgImage } from '@/lib/og-pages';

/** Link preview for a backer live page: the session as it stands when the link is pasted. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await loadLive(id).catch(() => null);
  return liveOgImage(rec?.snapshot ?? null);
}
