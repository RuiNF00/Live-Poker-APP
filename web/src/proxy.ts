import { NextResponse, type NextRequest } from 'next/server';
import { PAGE_LANG_HEADER, pageLang } from '@/lib/page-lang';
import { pageLocale } from '@/lib/i18n';

// Pages in a language chosen by their route or ?lang= tell the root layout which
// <html lang> to set, so screen readers use the right voice.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(PAGE_LANG_HEADER);
  const { pathname, searchParams } = request.nextUrl;
  // A shared hand (/h/<id>) picks its language like the page does: the reader's phone, else ?lang=.
  const shared = pathname.startsWith('/h/') ? pageLocale(searchParams.get('lang'), request.headers.get('accept-language')) : null;
  const lang = shared ? (shared === 'pt' ? 'pt-PT' : shared) : pageLang(pathname, searchParams.get('lang'));
  if (lang) headers.set(PAGE_LANG_HEADER, lang);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/ajuda/:path*', '/help/:path*', '/es/ayuda/:path*', '/pt-br/ajuda/:path*', '/support', '/delete-account', '/press', '/h/:path*'],
};
