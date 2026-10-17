import { headers } from 'next/headers';
import Link from 'next/link';
import { brand } from '@/config/brand';
import { pickLocale } from '@/lib/i18n';
import { swapCopy } from '@/components/swap/copy';

// A swap or group link that no longer exists: says so in swap words, not the hand page's.
export default async function SwapNotFound() {
  const c = swapCopy(pickLocale((await headers()).get('accept-language')));
  return (
    <main className="page page-center">
      <h1 className="hand-title">{c.notFound}</h1>
      <p className="muted">{c.notFoundBody}</p>
      <Link className="btn btn-primary" href="/">
        {brand.name}
      </Link>
    </main>
  );
}
