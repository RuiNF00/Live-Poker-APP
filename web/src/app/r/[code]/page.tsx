import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { brand } from '@/config/brand';
import { Landing, type Search } from '@/components/landing/Landing';
import { normalizeCode } from '@/lib/refcode';


export const metadata: Metadata = {
  title: { absolute: `Convite para o ${brand.name}` },
  description: 'Um amigo convidou-te para o Sweatbook. Instala a app, guarda a tua primeira mão e ganham os dois 7 dias de Pro.',
  robots: { index: false },
};

/** Invite link: https://sweatbook.poker/r/<code>. Opens the app when installed (universal link). */
export default async function Invite({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Search> }) {
  const code = normalizeCode((await params).code);
  if (!code) notFound();
  return <Landing search={await searchParams} invite={code} />;
}
