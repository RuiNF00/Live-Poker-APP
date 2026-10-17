import type { Metadata, Viewport } from 'next';
import { brand } from '@/config/brand';
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const body = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-mono' });

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
