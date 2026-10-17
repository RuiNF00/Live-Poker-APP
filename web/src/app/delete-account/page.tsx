import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { HELP_BASE, HELP_INDEXED, helpLocale, LANG_TAG } from '@/components/help/copy';
import { BackupDeleteForm } from '@/components/help/BackupDeleteForm';
import { DELETE_COPY as COPY } from '@/components/help/delete-copy';
import { DeleteRequestForm } from '@/components/help/DeleteRequestForm';
import { HelpShell, sameIn } from '@/components/help/HelpShell';
import { articles, SUPPORT_EMAIL, textOf, type HelpLocale } from '@/lib/help/articles';

// sweatbook.poker/delete-account: the deletion page Google Play asks for (Data safety → delete
// account URL; the store listings already use this path). Sweatbook has no accounts, so it explains
// "Apagar todos os meus dados" in the app and, for someone without the app, deletes the cloud
// backup with its recovery code (in the browser, like the app) or builds a request email.
// Language: ?lang=pt|pt-BR|es|en, else the browser's. /apagar-conta, /pt-br/apagar-conta and
// /es/eliminar-cuenta redirect here (next.config.ts). Replaces public/delete-account.html.
type Search = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

async function localeFor(search: Search): Promise<HelpLocale> {
  const fromParam = helpLocale(one(search.lang));
  if (fromParam) return fromParam;
  const first = (await headers()).get('accept-language')?.split(',')[0];
  return helpLocale(first) ?? 'pt';
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const locale = await localeFor(await searchParams);
  return { title: COPY[locale].meta, robots: HELP_INDEXED ? undefined : { index: false, follow: false } };
}

export default async function DeleteDataPage({ searchParams }: { searchParams: Promise<Search> }) {
  const locale = await localeFor(await searchParams);
  const c = COPY[locale];
  const cancel = articles().find((a) => a.id === 'cancel');

  return (
    <HelpShell locale={locale} hrefs={sameIn((l) => `/delete-account?lang=${LANG_TAG[l]}`)}>
      <section className="hc-hero">
        <h1>{c.title}</h1>
        <p className="hc-lede">{c.lede}</p>
      </section>

      <section className="hc-cat">
        <h2>{c.inApp.h}</h2>
        <ol className="hc-steps">
          {c.inApp.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="hc-plain">{c.inApp.after}</p>
      </section>

      <section className="hc-cat">
        <h2>{c.noApp.h}</h2>
        <p className="hc-plain">{c.noApp.p}</p>
        <h3 className="hc-sub">{c.backup.h}</h3>
        <p className="hc-plain">{c.backup.p}</p>
        <BackupDeleteForm c={c.backup.form} />
        <p className="hc-note">{c.backup.lost}</p>
        <h3 className="hc-sub">{c.noApp.mail}</h3>
        <p className="hc-plain">{c.noApp.linkOnly}</p>
        <DeleteRequestForm to={SUPPORT_EMAIL} c={c.noApp.form} />
      </section>

      <section className="hc-cat">
        <h2>{c.table.h}</h2>
        <dl className="hc-table">
          {c.table.rows.map(([what, when]) => (
            <div key={what}>
              <dt>{what}</dt>
              <dd>{when}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="hc-cat">
        <h2>{c.kept.h}</h2>
        <ul className="hc-bullets">
          {c.kept.items.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="hc-note">
          {c.cancel.text}{' '}
          {cancel ? <Link href={`${HELP_BASE[locale]}/${textOf(cancel, locale).slug}`}>{c.cancel.link}</Link> : null}
        </p>
      </section>
    </HelpShell>
  );
}
