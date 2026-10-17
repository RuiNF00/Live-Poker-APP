import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { brand } from '@/config/brand';
import { pickLocale } from '@/lib/i18n';
import { PAGE_LANG_HEADER, pageLangFrom } from '@/lib/page-lang';
import localFont from 'next/font/local';
import './globals.css';

// Bundled (OFL, see src/fonts) so the build never depends on fetching Google Fonts.
const body = localFont({
  src: [
    { path: '../fonts/HankenGrotesk_400Regular.ttf', weight: '400' },
    { path: '../fonts/HankenGrotesk_500Medium.ttf', weight: '500' },
    { path: '../fonts/HankenGrotesk_600SemiBold.ttf', weight: '600' },
    { path: '../fonts/HankenGrotesk_700Bold.ttf', weight: '700' },
    { path: '../fonts/HankenGrotesk_800ExtraBold.ttf', weight: '800' },
  ],
  variable: '--font-body',
});
const mono = localFont({
  src: [
    { path: '../fonts/JetBrainsMono_400Regular.ttf', weight: '400' },
    { path: '../fonts/JetBrainsMono_500Medium.ttf', weight: '500' },
    { path: '../fonts/JetBrainsMono_700Bold.ttf', weight: '700' },
  ],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline.pt,
};

export const viewport: Viewport = {
  themeColor: brand.colors.bg,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Same choice the pages make: the route's language when it has one (help center, /support,
  // /delete-account; set by proxy.ts), else Accept-Language, so screen readers get the right voice.
  const h = await headers();
  const lang = pickLocale(h.get('accept-language'));
  return (
    <html lang={pageLangFrom(h.get(PAGE_LANG_HEADER)) ?? (lang === 'pt' ? 'pt-PT' : lang)} className={`${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
