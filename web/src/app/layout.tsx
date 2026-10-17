import type { Metadata, Viewport } from 'next';
import { brand } from '@/config/brand';
import './globals.css';

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
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
