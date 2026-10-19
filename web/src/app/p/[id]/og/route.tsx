import { previewLocale } from '@/lib/i18n';
import { packOgImage } from '@/lib/og-pages';
import { PACK_ID_RE, packStore } from '@/lib/packs';
import { loadShare } from '@/lib/store';

/** Link preview for a pack of hands: its title and how many hands are still shared, in `?lang=`. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = previewLocale(new URL(req.url).searchParams.get('lang'), req.headers.get('accept-language'));
  const pack = PACK_ID_RE.test(id) ? await packStore().get(id).catch(() => null) : null;
  const shared = pack ? (await Promise.all(pack.handIds.map((h) => loadShare(h).catch(() => null)))).filter(Boolean).length : 0;
  return packOgImage(pack && shared ? { title: pack.title, hands: shared } : null, locale);
}
