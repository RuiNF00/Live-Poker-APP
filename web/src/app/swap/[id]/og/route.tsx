import { previewLocale } from '@/lib/i18n';
import { swapOgImage } from '@/lib/og-pages';
import { loadSwap } from '@/lib/swaps';

/** Link preview for a swap: the two players and the event, in `?lang=`. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = previewLocale(new URL(req.url).searchParams.get('lang'), req.headers.get('accept-language'));
  const rec = await loadSwap(id).catch(() => null);
  const t = rec?.terms;
  return swapOgImage(t ? { a: t.a.name, b: rec.confirmedName || t.b.name, title: t.title } : null, locale);
}
