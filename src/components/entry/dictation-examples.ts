// "Como ditar uma mão": hands told the way players tell them, per language, each one
// read right by the parser (dictation-examples.test.ts). Not translated: each list is
// how that language says it, so the examples stay real.

import { locale, variant } from '@/i18n';

export type DictationLang = 'pt-PT' | 'pt-BR' | 'es' | 'es-MX' | 'en';

export const EXAMPLES: Record<DictationLang, string[]> = {
  'pt-PT': [
    'Estou no botão com ás rei de copas. O UTG abre para 2500, eu pago. Flop rei sete dois, ele faz bet de 3000, eu pago.',
    'Estou no big com nove oito. O botão abre para 1000, eu pago. Flop rei sete dois, passo, ele dispara 800, eu pago.',
    'Estou no UTG com noves, abro para 1100, o botão paga e o big também. Flop dez cinco dois, o big passa, eu faço bet de 2000, o botão paga.',
    'Estou no botão com A K, 15 bb. O UTG abre para 1000, eu vou all-in e ele paga.',
    'Estou no big com sete seis de espadas. O botão abre para 900, não, para 1100, eu pago.',
    'Estou no botão com ás rei. O UTG abre para 1000, eu pago. Flop rei sete dois, turn três, river quatro. Ele mostra dama dama.',
  ],
  'pt-BR': [
    'Tô no botão com ás rei, o UTG abre pra 1000 e eu pago.',
    'Tô no botão com dama dama. Fold até o cutoff, ele abre pra 1000, eu dou 3bet pra 3000, ele paga.',
    'Tô no botão com rei rei. O UTG abre pra 1000, eu pago. Flop ás oito três, ele dá mesa, eu dou mesa.',
    'Tô no botão com 40k e ás rei. O UTG abre pra 1000, eu vou all-in, ele paga.',
    'Tô no botão com ás rei, abro pra 1000, quer dizer, 1200, o big paga.',
    'Tô de big com dez nove. Botão abre pra 1000, small paga, eu pago.',
  ],
  es: [
    'Estoy en el botón con as rey, el UTG sube a 1000, hago 3000, él paga.',
    'Estoy en la ciega grande con siete ocho. La pequeña sube a 1200 y yo pago. Flop rey siete dos, pasa, pasa.',
    'Estoy en el botón con dama dama. El UTG sube a 1000, pagué. Flop nueve cinco dos, hace bet de 1500, pagué. Él tenía as rey.',
    'Estamos con 15 ciegas efectivas, estoy en el botón con as rey. El UTG sube a 1000, voy all in y paga.',
    'Estoy en UTG con nueves, subo a 1000, perdón, a 1100, el botón paga.',
    'Estoy en el botón con rey dama, subo a 1000, la pequeña se retira y la grande paga.',
  ],
  'es-MX': [
    'Ando en el botón con as rey, el UTG abre a mil, le subo a tres mil y me la paga.',
    'Estoy en la grande con nueve ocho, el botón sube a mil, pago. Flop rey siete dos, checo, betea 1200, me tiro.',
    'Estoy en el botón con par de reyes, el UTG sube a 1000, la veo.',
    'Ando con 20 mil, estoy en el botón con as rey, el UTG sube a 1000, me voy con todo y me paga.',
    'Estoy en el botón con as rey, el UTG sube a 900, más bien a 1100, pago.',
    'Estoy en el botón con as rey, el UTG sube a 1000, pago. Flop rey siete dos, turn tres, river cuatro. Voltea jota jota.',
  ],
  en: [
    "I'm on the button with ace king of hearts. UTG opens to 2500, I call. Flop king seven two, he bets 3000, I call.",
    "I'm on the button with queen jack. Folds to the cutoff, he opens to 1000 and I call.",
    "I'm in the big blind with nine eight. The button opens to eleven hundred and I call.",
    "I'm on the button with ace king, 15 big blinds. UTG opens to 1000, I shove and he calls.",
    "I'm on the button with ace king, UTG raises to 900, sorry, 1100, I call.",
    "I'm in the hijack with jack ten, I open to 1000, the cutoff calls, the rest fold. Flop queen nine three, I bet 1500, he calls.",
  ],
};

/** The examples for this phone: Spanish outside Spain gets the Mexican ones. */
export function dictationLang(v: string = variant, loc: string = locale): DictationLang {
  if (v === 'es') return /^es(-ES)?$/i.test(loc) ? 'es' : 'es-MX';
  return v === 'pt-BR' || v === 'en' ? v : 'pt-PT';
}
