import type { Metadata, Viewport } from 'next';
import { brand } from '@/config/brand';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
