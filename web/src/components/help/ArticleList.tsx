import Link from 'next/link';
import { textOf, type Article, type HelpLocale } from '@/lib/help/articles';
import { HELP_BASE } from './copy';

export function ArticleList({ locale, list }: { locale: HelpLocale; list: Article[] }) {
  return (
    <ul className="hc-list">
      {list.map((a) => {
        const t = textOf(a, locale);
        return (
          <li key={a.id}>
            <Link href={`${HELP_BASE[locale]}/${t.slug}`}>
              <strong>{t.title}</strong>
              <span>{t.summary}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
