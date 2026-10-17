import { loadShare } from '@/lib/store';
import { handOgImage } from '@/lib/og';
import { previewLocale } from '@/lib/i18n';

/** Link preview image for /h/<id>; `?q=1` is the challenge version that hides the result, `?lang=` its language. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const share = await loadShare(id);
  return handOgImage(share, sp.get('q') === '1', previewLocale(sp.get('lang'), req.headers.get('accept-language')));
}
