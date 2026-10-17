import { loadShare } from '@/lib/store';
import { handOgImage } from '@/lib/og';

/** Link preview image for /h/<id>; `?q=1` is the challenge version that hides the result. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = new URL(req.url).searchParams.get('q') === '1';
  const share = await loadShare(id);
  return handOgImage(share, challenge);
}
