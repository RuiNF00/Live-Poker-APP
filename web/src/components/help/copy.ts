import type { Locale } from '@/lib/i18n';

/** Kept out of search engines until launch; flip to true when the app is in the stores. */
export const HELP_INDEXED = false;

export const HELP_BASE: Record<Locale, string> = { pt: '/ajuda', en: '/help' };

export const helpCopy = {
  pt: {
    help: 'Ajuda',
    title: 'Como podemos ajudar?',
    lede: 'Respostas curtas sobre a Sweatbook. Não encontras? Escreve-nos.',
    search: 'Procurar na ajuda',
    searchPlaceholder: 'Ex.: telemóvel novo, straddle, cancelar',
    noResults: 'Nada encontrado. Tenta outra palavra ou fala connosco.',
    results: { one: '1 resultado', many: '{n} resultados' },
    allHelp: 'Toda a ajuda',
    otherLang: 'English',
    stillStuck: 'Ainda com dúvidas?',
    contactUs: 'Falar connosco',
    related: 'Também pode ajudar',
    footer: '18+ · A Sweatbook é uma app de registo: não tem jogo a dinheiro e nenhum dinheiro passa por ela.',
  },
  en: {
    help: 'Help',
    title: 'How can we help?',
    lede: "Short answers about Sweatbook. Can't find it? Write to us.",
    search: 'Search help',
    searchPlaceholder: 'E.g. new phone, straddle, cancel',
    noResults: 'Nothing found. Try another word or contact us.',
    results: { one: '1 result', many: '{n} results' },
    allHelp: 'All help',
    otherLang: 'Português',
    stillStuck: 'Still stuck?',
    contactUs: 'Contact us',
    related: 'This may also help',
    footer: '18+ · Sweatbook is a record-keeping app: it has no real-money games and no money moves through it.',
  },
};
