import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { Article } from '@/lib/help/articles';
import { HELP_BASE } from './copy';

export function ArticleList({ locale, list }: { locale: Locale; list: Article[] }) {
  return (
    <ul className="hc-list">
      {list.map((a) => (
        <li key={a.id}>
          <Link href={`${HELP_BASE[locale]}/${a[locale].slug}`}>
            <strong>{a[locale].title}</strong>
            <span>{a[locale].summary}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
