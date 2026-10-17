import { NextResponse, type NextRequest } from 'next/server';
import { PAGE_LANG_HEADER, pageLang } from '@/lib/page-lang';

// Pages in a language chosen by their route or ?lang= tell the root layout which
// <html lang> to set, so screen readers use the right voice.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(PAGE_LANG_HEADER);
  const lang = pageLang(request.nextUrl.pathname, request.nextUrl.searchParams.get('lang'));
  if (lang) headers.set(PAGE_LANG_HEADER, lang);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/ajuda/:path*', '/help/:path*', '/es/ayuda/:path*', '/pt-br/ajuda/:path*', '/support', '/delete-account', '/press'],
};
