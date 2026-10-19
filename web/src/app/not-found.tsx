import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFoundCopy } from '@/components/not-found/copy';
import { pickLocale } from '@/lib/i18n';

async function copy() {
  return notFoundCopy(pickLocale((await headers()).get('accept-language')));
}

// The tab says what happened, not just the brand.
export async function generateMetadata(): Promise<Metadata> {
  const c = await copy();
  return { title: c.title.replace(/\.$/, '') }; // the root layout adds " · Sweatbook"
}

export default async function NotFound() {
  const c = await copy();
  return (
    <main className="page page-center">
      <h1 className="hand-title">{c.title}</h1>
      <p className="muted">{c.body}</p>
      <Link className="btn btn-primary" href="/">
        {c.home}
      </Link>
    </main>
  );
}
