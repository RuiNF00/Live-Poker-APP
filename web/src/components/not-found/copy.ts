import type { Locale } from '../../lib/i18n';

// The site's 404, for any address: a deleted hand, offer, profile, swap or live link, or a typo.
const pt = {
  title: 'Esta página não existe.',
  body: 'O endereço pode estar errado, ou quem partilhou o link apagou-o.',
  home: 'Ir para o início',
};

type NotFoundCopy = typeof pt;

const COPY: Record<Locale, NotFoundCopy> = {
  pt,
  'pt-BR': {
    title: 'Esta página não existe.',
    body: 'O endereço pode estar errado, ou quem compartilhou o link apagou.',
    home: 'Ir para o início',
  },
  es: {
    title: 'Esta página no existe.',
    body: 'Puede que la dirección esté mal o que quien compartió el link lo haya borrado.',
    home: 'Ir al inicio',
  },
  en: {
    title: "This page doesn't exist.",
    body: 'The address may be wrong, or whoever shared the link deleted it.',
    home: 'Go to the home page',
  },
};

export function notFoundCopy(locale: Locale): NotFoundCopy {
  return COPY[locale];
}
