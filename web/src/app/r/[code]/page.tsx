import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { Landing, type Search } from '@/components/landing/Landing';
import { normalizeCode } from '@/lib/refcode';


const title = `Convite para o ${brand.name}`;
const description = 'Um amigo convidou-te para o Sweatbook. Instala a app, guarda a tua primeira mão e ganham os dois 7 dias de Pro.';
const image = { url: '/og/invite', width: 1200, height: 630, alt: title };

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  robots: { index: false },
  openGraph: { title, description, type: 'website', siteName: brand.name, images: [image] },
  twitter: { card: 'summary_large_image', title, description, images: [image.url] },
};

/** Invite link: https://sweatbook.poker/r/<code>. Opens the app when installed (universal link). */
export default async function Invite({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Search> }) {
  // A code that is not ours gets an invalid-invite hero (null), not the hand 404.
  const code = normalizeCode((await params).code);
  return <Landing search={await searchParams} invite={code} />;
}
