import Link from 'next/link';
import { headers } from 'next/headers';
import { notFoundCopy } from '@/components/not-found/copy';
import { pickLocale } from '@/lib/i18n';

export default async function NotFound() {
  const c = notFoundCopy(pickLocale((await headers()).get('accept-language')));
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
