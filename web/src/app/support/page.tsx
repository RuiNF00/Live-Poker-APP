import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { ArticleList } from '@/components/help/ArticleList';
import { HELP_BASE, HELP_INDEXED, helpLocale, LANG_NAME, LANG_TAG } from '@/components/help/copy';
import { HelpShell, sameIn } from '@/components/help/HelpShell';
import { SupportForm } from '@/components/help/SupportForm';
import { articles, SUPPORT_EMAIL, type HelpLocale } from '@/lib/help/articles';

// sweatbook.poker/support: the app's Settings → Sugestões e suporte opens it with
// ?topic=suggestion|bug&app=<version>&os=<os>&lang=pt|pt-BR|es|en. Email only: nothing is stored here.
type Search = Record<string, string | string[] | undefined>;
type Topic = 'suggestion' | 'bug' | 'question';

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
const clean = (v: string, max: number) => v.replace(/[^\w .()\-]/g, '').slice(0, max).trim();

const COPY = {
  pt: {
    meta: 'Suporte',
    titles: { suggestion: 'Enviar uma sugestão', bug: 'Reportar um problema', question: 'Falar com o suporte' },
    ledes: {
      suggestion: 'O que falta ou o que mudavas? Lemos todas as sugestões, e muitas já estão na app.',
      bug: 'Conta-nos o que aconteceu e o que estavas a fazer. Uma captura de ecrã ajuda muito.',
      question: 'Escreve-nos. Responde quem faz a Sweatbook, normalmente em 2 dias úteis.',
    },
    subjects: { suggestion: 'Sugestão', bug: 'Problema', question: 'Pergunta' },
    first: 'Antes de escrever, isto pode resolver',
    form: {
      message: 'Mensagem',
      placeholder: 'Escreve aqui…',
      attached: 'Vai junto no email:',
      send: 'Abrir no email',
      hint: `Abre a tua app de email com a mensagem pronta. Não abre? Escreve para ${SUPPORT_EMAIL}.`,
      copy: 'Copiar endereço',
      copied: 'Copiado',
    },
    labels: { app: 'App', os: 'Sistema', lang: 'Idioma' },
    gambling: 'Jogo responsável',
    gamblingBody: 'Se o jogo te está a causar problemas, pede ajuda:',
    allHelp: 'Ver toda a ajuda',
  },
  en: {
    meta: 'Support',
    titles: { suggestion: 'Send a suggestion', bug: 'Report a problem', question: 'Contact support' },
    ledes: {
      suggestion: "What's missing, or what would you change? We read every suggestion, and many are already in the app.",
      bug: 'Tell us what happened and what you were doing. A screenshot helps a lot.',
      question: 'Write to us. The person who builds Sweatbook replies, usually within 2 working days.',
    },
    subjects: { suggestion: 'Suggestion', bug: 'Problem', question: 'Question' },
    first: 'Before you write, this may help',
    form: {
      message: 'Message',
      placeholder: 'Write here…',
      attached: 'Included in the email:',
      send: 'Open in email',
      hint: `Opens your email app with the message ready. Nothing opens? Write to ${SUPPORT_EMAIL}.`,
      copy: 'Copy address',
      copied: 'Copied',
    },
    labels: { app: 'App', os: 'OS', lang: 'Language' },
    gambling: 'Responsible gaming',
    gamblingBody: 'If gambling is causing you problems, get help:',
    allHelp: 'See all help',
  },
  es: {
    meta: 'Soporte',
    titles: { suggestion: 'Enviar una sugerencia', bug: 'Reportar un problema', question: 'Hablar con soporte' },
    ledes: {
      suggestion: '¿Qué falta o qué cambiarías? Leemos todas las sugerencias, y muchas ya están en la app.',
      bug: 'Cuéntanos qué pasó y qué estabas haciendo. Una captura de pantalla ayuda mucho.',
      question: 'Escríbenos. Responde quien hace Sweatbook, normalmente en 2 días hábiles.',
    },
    subjects: { suggestion: 'Sugerencia', bug: 'Problema', question: 'Pregunta' },
    first: 'Antes de escribir, esto puede ayudarte',
    form: {
      message: 'Mensaje',
      placeholder: 'Escribe aquí…',
      attached: 'Va incluido en el email:',
      send: 'Abrir en el email',
      hint: `Abre tu app de email con el mensaje listo. ¿No se abre? Escribe a ${SUPPORT_EMAIL}.`,
      copy: 'Copiar dirección',
      copied: 'Copiado',
    },
    labels: { app: 'App', os: 'Sistema', lang: 'Idioma' },
    gambling: 'Juego responsable',
    gamblingBody: 'Si el juego te está causando problemas, pide ayuda:',
    allHelp: 'Ver toda la ayuda',
  },
  br: {
    meta: 'Suporte',
    titles: { suggestion: 'Enviar uma sugestão', bug: 'Reportar um problema', question: 'Falar com o suporte' },
    ledes: {
      suggestion: 'O que está faltando ou o que você mudaria? Lemos todas as sugestões, e muitas já estão no app.',
      bug: 'Conte o que aconteceu e o que você estava fazendo. Um print da tela ajuda muito.',
      question: 'Escreva para a gente. Quem responde é quem faz o Sweatbook, normalmente em 2 dias úteis.',
    },
    subjects: { suggestion: 'Sugestão', bug: 'Problema', question: 'Pergunta' },
    first: 'Antes de escrever, isto pode resolver',
    form: {
      message: 'Mensagem',
      placeholder: 'Escreva aqui…',
      attached: 'Vai junto no email:',
      send: 'Abrir no email',
      hint: `Abre o seu app de email com a mensagem pronta. Não abriu? Escreva para ${SUPPORT_EMAIL}.`,
      copy: 'Copiar endereço',
      copied: 'Copiado',
    },
    labels: { app: 'App', os: 'Sistema', lang: 'Idioma' },
    gambling: 'Jogo responsável',
    gamblingBody: 'Se o jogo está causando problemas para você, peça ajuda:',
    allHelp: 'Ver toda a ajuda',
  },
};

/** Articles worth a look before writing, by topic. */
const SUGGESTED: Record<Topic, string[]> = {
  bug: ['unfinished-hands', 'backup', 'restore-purchases'],
  suggestion: ['free-plan', 'export', 'import'],
  question: ['getting-started', 'backup', 'restore-purchases', 'cancel'],
};

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
