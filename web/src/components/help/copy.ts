import type { HelpLocale } from '@/lib/help/articles';

/** Kept out of search engines until launch; flip to true when the app is in the stores. */
export const HELP_INDEXED = false;

export const HELP_BASE: Record<HelpLocale, string> = { pt: '/ajuda', en: '/help', es: '/es/ayuda', br: '/pt-br/ajuda' };

/** The html lang and hreflang of each help language. */
export const LANG_TAG: Record<HelpLocale, string> = { pt: 'pt-PT', en: 'en', es: 'es', br: 'pt-BR' };
export const LANG_NAME: Record<HelpLocale, string> = { pt: 'Português', br: 'Português (Brasil)', es: 'Español', en: 'English' };

/** Help language for a lang code from the app or a browser (pt-BR → br, es-* → es). */
export function helpLocale(tag: string | null | undefined): HelpLocale | null {
  const t = (tag || '').trim().toLowerCase().replace('_', '-');
  if (t === 'br' || t.startsWith('pt-br')) return 'br';
  if (t.startsWith('pt')) return 'pt';
  if (t.startsWith('es')) return 'es';
  if (t.startsWith('en')) return 'en';
  return null;
}

export const helpCopy = {
  pt: {
    deleteData: 'Apagar dados',
    help: 'Ajuda',
    title: 'Como podemos ajudar?',
    lede: 'Respostas curtas sobre a Sweatbook. Não encontras? Escreve-nos.',
    search: 'Procurar na ajuda',
    searchPlaceholder: 'Ex.: telemóvel novo, straddle, cancelar',
    noResults: 'Nada encontrado. Tenta outra palavra ou fala connosco.',
    results: { one: '1 resultado', many: '{n} resultados' },
    allHelp: 'Toda a ajuda',
    stillStuck: 'Ainda com dúvidas?',
    contactUs: 'Falar connosco',
    language: 'Idioma',
    related: 'Também pode ajudar',
    footer: '18+ · A Sweatbook é uma app de registo: não tem jogo a dinheiro e nenhum dinheiro passa por ela.',
  },
  en: {
    deleteData: 'Delete data',
    help: 'Help',
    title: 'How can we help?',
    lede: "Short answers about Sweatbook. Can't find it? Write to us.",
    search: 'Search help',
    searchPlaceholder: 'E.g. new phone, straddle, cancel',
    noResults: 'Nothing found. Try another word or contact us.',
    results: { one: '1 result', many: '{n} results' },
    allHelp: 'All help',
    stillStuck: 'Still stuck?',
    contactUs: 'Contact us',
    language: 'Language',
    related: 'This may also help',
    footer: '18+ · Sweatbook is a record-keeping app: it has no real-money games and no money moves through it.',
  },
  es: {
    deleteData: 'Eliminar datos',
    help: 'Ayuda',
    title: '¿Cómo podemos ayudarte?',
    lede: 'Respuestas cortas sobre Sweatbook. ¿No lo encuentras? Escríbenos.',
    search: 'Buscar en la ayuda',
    searchPlaceholder: 'Ej.: teléfono nuevo, straddle, cancelar',
    noResults: 'No encontramos nada. Prueba otra palabra o escríbenos.',
    results: { one: '1 resultado', many: '{n} resultados' },
    allHelp: 'Toda la ayuda',
    stillStuck: '¿Sigues con dudas?',
    contactUs: 'Escríbenos',
    language: 'Idioma',
    related: 'También puede ayudarte',
    footer: '18+ · Sweatbook es una app de registro: no tiene juego con dinero y ningún dinero pasa por ella.',
  },
  br: {
    deleteData: 'Excluir dados',
    help: 'Ajuda',
    title: 'Como podemos ajudar?',
    lede: 'Respostas curtas sobre o Sweatbook. Não encontrou? Fale com a gente.',
    search: 'Buscar na ajuda',
    searchPlaceholder: 'Ex.: celular novo, straddle, cancelar',
    noResults: 'Nada encontrado. Tente outra palavra ou fale com a gente.',
    results: { one: '1 resultado', many: '{n} resultados' },
    allHelp: 'Toda a ajuda',
    stillStuck: 'Ainda com dúvidas?',
    contactUs: 'Fale com a gente',
    language: 'Idioma',
    related: 'Também pode ajudar',
    footer: '18+ · O Sweatbook é um app de registro: não tem jogo a dinheiro e nenhum dinheiro passa por ele.',
  },
};
