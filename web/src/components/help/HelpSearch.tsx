'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface SearchItem {
  href: string;
  title: string;
  summary: string;
  text: string;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Every word typed must appear somewhere in the article; titles rank first. */
export function HelpSearch({
  items,
  label,
  placeholder,
  noResults,
  results,
  children,
}: {
  items: SearchItem[];
  label: string;
  placeholder: string;
  noResults: string;
  results: { one: string; many: string };
  children: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const index = useMemo(() => items.map((i) => ({ ...i, t: fold(i.title), all: fold(`${i.title} ${i.summary} ${i.text}`) })), [items]);
  const words = fold(q).split(/\s+/).filter(Boolean);
  const hits = words.length
    ? index
        .filter((i) => words.every((w) => i.all.includes(w)))
        .sort((a, b) => Number(words.some((w) => b.t.includes(w))) - Number(words.some((w) => a.t.includes(w))))
    : [];

  return (
    <>
      <label className="hc-search">
        <span className="hc-sr">{label}</span>
        <svg viewBox="0 0 24 24" aria-hidden width="18" height="18">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoComplete="off" enterKeyHint="search" />
      </label>
      {words.length ? (
        <section className="hc-results" aria-live="polite">
          <p className="hc-count">{hits.length === 1 ? results.one : hits.length ? results.many.replace('{n}', String(hits.length)) : noResults}</p>
          <ul className="hc-list">
            {hits.map((h) => (
              <li key={h.href}>
                <Link href={h.href}>
                  <strong>{h.title}</strong>
                  <span>{h.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        children
      )}
    </>
  );
}
