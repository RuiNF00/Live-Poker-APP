// What a screen reader says for a card on the web pages: "Rei de espadas", "King of spades".
import type { Locale } from './i18n';

const RANK: Record<'pt' | 'en' | 'es', Record<string, string>> = {
  pt: { A: 'Ás', K: 'Rei', Q: 'Dama', J: 'Valete', T: 'Dez', '9': 'Nove', '8': 'Oito', '7': 'Sete', '6': 'Seis', '5': 'Cinco', '4': 'Quatro', '3': 'Três', '2': 'Dois' },
  en: { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: 'Ten', '9': 'Nine', '8': 'Eight', '7': 'Seven', '6': 'Six', '5': 'Five', '4': 'Four', '3': 'Three', '2': 'Two' },
  es: { A: 'As', K: 'Rey', Q: 'Reina', J: 'Jota', T: 'Diez', '9': 'Nueve', '8': 'Ocho', '7': 'Siete', '6': 'Seis', '5': 'Cinco', '4': 'Cuatro', '3': 'Tres', '2': 'Dos' },
};
const SUIT: Record<'pt' | 'en' | 'es', Record<string, string>> = {
  pt: { s: 'espadas', h: 'copas', d: 'ouros', c: 'paus' },
  en: { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' },
  es: { s: 'picas', h: 'corazones', d: 'diamantes', c: 'tréboles' },
};
const OF = { pt: 'de', en: 'of', es: 'de' };
const HIDDEN = { pt: 'carta tapada', 'pt-BR': 'carta fechada', en: 'face-down card', es: 'carta tapada' };

const lang = (l: Locale) => (l === 'en' ? 'en' : l === 'es' ? 'es' : 'pt');

export function cardLabel(card: string, locale: Locale = 'pt'): string {
  const g = lang(locale);
  const r = RANK[g][card[0]];
  const s = SUIT[g][card[1]];
  return r && s ? `${r} ${OF[g]} ${s}` : card;
}

export function hiddenCardLabel(locale: Locale = 'pt'): string {
  return locale === 'pt-BR' ? HIDDEN['pt-BR'] : HIDDEN[lang(locale)];
}
