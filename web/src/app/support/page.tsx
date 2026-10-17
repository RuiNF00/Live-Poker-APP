import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { ArticleList } from '@/components/help/ArticleList';
import { BlockView } from '@/components/help/ArticleView';
import { HELP_BASE, HELP_INDEXED, helpLocale, LANG_NAME, LANG_TAG } from '@/components/help/copy';
import { HelpShell, sameIn } from '@/components/help/HelpShell';
import { SupportForm } from '@/components/help/SupportForm';
import { SUPPORT_COPY as COPY } from '@/components/help/support-copy';
import { articles, SUPPORT_EMAIL, textOf, type HelpLocale } from '@/lib/help/articles';

// sweatbook.poker/support: the app's Settings → Sugestões e suporte opens it with
// ?topic=suggestion|bug&app=<version>&os=<os>&lang=pt|pt-BR|es|en. Email only: nothing is stored here.
type Search = Record<string, string | string[] | undefined>;
type Topic = 'suggestion' | 'bug' | 'question';

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
const clean = (v: string, max: number) => v.replace(/[^\w .()\-]/g, '').slice(0, max).trim();

/** Articles worth a look before writing, by topic. */
const SUGGESTED: Record<Topic, string[]> = {
  bug: ['unfinished-hands', 'backup', 'restore-purchases'],
  suggestion: ['free-plan', 'export', 'import'],
  question: ['getting-started', 'backup', 'restore-purchases', 'cancel'],
};

/** The questions both stores expect a support page to answer, from the help articles. */
const FAQ = ['import', 'backup', 'share-a-hand', 'cancel', 'restore-purchases', 'erase-all'];

async function localeFor(search: Search): Promise<HelpLocale> {
  const fromApp = helpLocale(one(search.lang));
  if (fromApp) return fromApp;
  const first = (await headers()).get('accept-language')?.split(',')[0];
  return helpLocale(first) ?? 'pt';
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const locale = await localeFor(await searchParams);
  return { title: COPY[locale].meta, robots: HELP_INDEXED ? undefined : { index: false, follow: false } };
}

export default async function SupportPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const locale = await localeFor(search);
  const c = COPY[locale];
  const t = one(search.topic);
  const topic: Topic = t === 'suggestion' || t === 'bug' ? t : 'question';
  const app = clean(one(search.app), 20);
  const os = clean(one(search.os), 40);

  const details: [string, string][] = [];
  if (app) details.push([c.labels.app, app]);
  if (os) details.push([c.labels.os, os]);
  if (app || os) details.push([c.labels.lang, LANG_NAME[locale]]);

  const query = (l: HelpLocale) =>
    new URLSearchParams({ ...(t ? { topic: t } : {}), ...(app ? { app } : {}), ...(os ? { os } : {}), lang: LANG_TAG[l] }).toString();
  const list = articles().filter((a) => SUGGESTED[topic].includes(a.id));

  return (
    <HelpShell locale={locale} hrefs={sameIn((l) => `/support?${query(l)}`)}>
      <section className="hc-hero">
        <h1>{c.titles[topic]}</h1>
        <p className="hc-lede">{c.ledes[topic]}</p>
      </section>

      <SupportForm to={SUPPORT_EMAIL} subject={`Sweatbook · ${c.subjects[topic]}${app ? ` · ${app}` : ''}`} details={details} c={c.form} />

      <section className="hc-cat">
        <h2>{c.first}</h2>
        <ArticleList locale={locale} list={list} />
        <p className="hc-more">
          <Link href={HELP_BASE[locale]}>{c.allHelp}</Link>
        </p>
      </section>

      <section className="hc-cat hc-faq">
        <h2>{c.faq}</h2>
        {articles()
          .filter((a) => FAQ.includes(a.id))
          .map((a) => {
            const x = textOf(a, locale);
            return (
              <details key={a.id}>
                <summary>{x.title}</summary>
                {x.body.map((b, i) => (
                  <BlockView key={i} b={b} />
                ))}
                {a.id === 'cancel' ? <p>{c.cancelInStore}</p> : null}
              </details>
            );
          })}
        <details>
          <summary>{c.money.q}</summary>
          <p>{c.money.a}</p>
        </details>
      </section>

      <section className="hc-cat">
        <h2>{c.gambling}</h2>
        <p className="hc-plain">
          {c.gamblingBody} <a href="https://www.srij.turismodeportugal.pt/pt/jogo-responsavel/">SRIJ (Portugal)</a>,{' '}
          <a href="https://www.begambleaware.org">BeGambleAware (UK)</a>, <a href="https://www.ncpgambling.org">1-800-GAMBLER (US)</a>.
        </p>
      </section>
    </HelpShell>
  );
}
