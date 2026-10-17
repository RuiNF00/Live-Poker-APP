import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { Landing, type Search } from '@/components/landing/Landing';

export const metadata: Metadata = {
  title: { absolute: `${brand.name} · ${brand.tagline.pt}` },
  description:
    'Regista as mãos que jogas ao vivo em segundos, revê-as rua a rua e partilha com os amigos. Grátis para começar, Pro por 29,99 US$/mês ou 199,99 US$/ano.',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: brand.name, url: '/' },
  twitter: { card: 'summary_large_image' },
};

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  return <Landing search={await searchParams} />;
}
