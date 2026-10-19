// "Contar a mão": the hand as the player tells it ("estou no botão com ás rei
// de copas, o UTG abre para 2500, eu pago, flop rei sete dois…"), turned into
// the same Hand the entry screen builds tap by tap. Pure and on the phone: the
// text comes from the keyboard's dictation (or typing) and never leaves it.
//
// Two passes. The words become atoms (a position, a verb, an amount, cards, a
// street…), in Portuguese (PT and BR), Spanish and English at once, since a
// player mixes poker English into every language. Then the atoms are played on
// the engine: whoever isn't mentioned folds (or checks) as the action passes
// them, exactly like the entry screen's own shortcuts, and every guess the app
// had to make (a suit, a size, a missing card) is listed for the player to fix.

import { apply, buttonForHeroPosition, legal, positions, replay, straddleSeats, totalPot, type TableState } from './engine';
import { resizeTable, rescaleStacks } from './factory';
import type { ActionKind, CardCode, Hand, HandAction, Street, Suit } from './types';

// ─── public shape ─────────────────────────────────────────

export type VoiceNoteCode =
  /** Suits nobody said, picked so they make no flush the player didn't mention. */
  | 'suits'
  /** A bet or raise with no amount: the usual size was used. */
  | 'size'
  /** A size below the minimum raise, raised to it. */
  | 'minRaise'
  /** A street was mentioned with fewer cards than it needs: the hand stops there. */
  | 'boardMissing'
  /** Hero's position was not said: the table's button stays where it was. */
  | 'noPosition'
  /** Hero's cards were not said. */
  | 'noCards'
  /** Something said couldn't happen at that point of the hand and was left out. */
  | 'skipped'
  /** A stack grew so a bet that was said would fit. */
  | 'stackGrew';

export interface VoiceNote {
  code: VoiceNoteCode;
  street?: Street;
  /** Position label of the seat concerned, when there is one. */
  pos?: string;
}

export interface VoiceResult {
  hand: Hand;
  /** Hero's position was said (the entry screen skips its position step). */
  posKnown: boolean;
  /** What the app had to guess or leave out, in order, without repeats. */
  notes: VoiceNote[];
  /** Cards whose suit was guessed: shown with a dot so they're easy to fix. */
  guessed: CardCode[];
  /** Nothing poker-like was understood at all. */
  empty: boolean;
}

// ─── words ────────────────────────────────────────────────

type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

const RANK_WORDS: Record<string, Rank> = {};
const PAIR_WORDS: Record<string, Rank> = {};
function ranks(r: Rank, single: string[], plural: string[]) {
  single.forEach((w) => (RANK_WORDS[w] = r));
  plural.forEach((w) => (PAIR_WORDS[w] = r));
}
ranks('A', ['as', 'ace', 'az'], ['ases', 'aces', 'azes']);
ranks('K', ['rei', 'rey', 'king', 'k', 'ka', 'capa'], ['reis', 'reyes', 'kings']);
ranks('Q', ['dama', 'rainha', 'reina', 'queen', 'q'], ['damas', 'rainhas', 'reinas', 'queens']);
ranks('J', ['valete', 'jota', 'jack', 'j', 'valet', 'jaque'], ['valetes', 'jotas', 'jacks', 'valets']);
ranks('T', ['dez', 'diez', 'ten', '10'], ['dezes', 'dieces', 'tens']);
ranks('9', ['nove', 'nueve', 'nine', '9'], ['noves', 'nueves', 'nines']);
ranks('8', ['oito', 'ocho', 'eight', '8'], ['oitos', 'ochos', 'eights']);
ranks('7', ['sete', 'siete', 'seven', '7'], ['setes', 'sietes', 'sevens']);
ranks('6', ['seis', 'six', '6'], ['seises', 'sixes']);
ranks('5', ['cinco', 'five', '5'], ['cincos', 'fives']);
ranks('4', ['quatro', 'cuatro', 'four', '4'], ['quatros', 'cuatros', 'fours']);
ranks('3', ['tres', 'three', 'trey', '3'], ['treses', 'threes', 'treys']);
ranks('2', ['dois', 'duas', 'dos', 'two', 'deuce', 'duque', '2'], ['duques', 'twos', 'deuces', 'doses']);

const ARTICLES = new Set(['o', 'a', 'the', 'el', 'la', 'um', 'uma', 'un', 'una', 'an', 'os', 'as', 'los', 'las']);

/** Words that are also ordinary words: a card only next to another card word. */
const WEAK_RANKS = new Set(['as', 'a', 'dos', 'k', 'q', 'j', 'ka', 'az', 'two', 'ten', 'capa']);

const SUIT_WORDS: Record<string, Suit> = {
  espadas: 's', espada: 's', picas: 's', pica: 's', spades: 's', spade: 's',
  copas: 'h', copa: 'h', corazones: 'h', corazon: 'h', hearts: 'h', heart: 'h', coracoes: 'h', coracao: 'h',
  ouros: 'd', ouro: 'd', oros: 'd', diamantes: 'd', diamante: 'd', diamonds: 'd', diamond: 'd',
  paus: 'c', pau: 'c', treboles: 'c', trebol: 'c', bastos: 'c', clubs: 'c', club: 'c', trevos: 'c', trevo: 'c',
};

const SUITED = new Set(['suited', 'suitado', 'suitados', 'suitada', 'suitadas', 'naipado', 'naipados', 'naipada', 'naipadas', 'conectado']);
const OFFSUIT = new Set(['offsuit', 'off', 'unsuited', 'desnaipado', 'desnaipados', 'diferentes', 'distintos', 'different']);
const RAINBOW = new Set(['rainbow', 'arcoiris']);
const MONOTONE = new Set(['monotone', 'monotono', 'monocolor', 'monocromatico', 'flushado']);

/** Words between cards that mean nothing ("ás e rei", "un rey y una dama"). */
const CARD_FILLER = new Set([
  'e', 'and', 'y', 'de', 'of', 'do', 'da', 'del', 'um', 'uma', 'un', 'una', 'an', 'o', 'the', 'el', 'la', 'par', 'pair', 'pocket', 'pockets',
  'bolso', 'mesmo', 'naipe', 'naipes', 'mismo', 'palo', 'palos', 'same', 'suit', 'suits', 'vem', 'veio', 'sai', 'saiu', 'cai', 'caiu',
  'came', 'comes', 'is', 'was', 'sale', 'salio', 'viene', 'vino', 'cae', 'cayo', 'llega', 'e', 'foi', 'era', 'com', 'with', 'con', 'carta', 'card',
  'x', 'mais', 'otro', 'outro', 'another', 'arco', 'iris', 'num', 'numa', 'com', 'tipo', 'like', 'pra', 'para',
]);

/** Positions. Spoken forms are folded to these in normalise(). */
const POS_WORDS: Record<string, string> = {
  utg: 'UTG', utg1: 'UTG+1', utg2: 'UTG+2', mp: 'MP', lj: 'LJ', hj: 'HJ', co: 'CO', btn: 'BTN', sb: 'SB', bb: 'BB',
};

const HERO_REF = new Set(['eu', 'hero', 'i', 'yo', 'me', 'mim', 'im']);
/** "Estou no botão", "tenho ás rei": hero, and what follows is hero's. */
const HERO_MARK = new Set(['estou', 'tou', 'sou', 'estava', 'estoy', 'estaba', 'soy', 'am']);
const HAVE_1 = new Set(['tenho', 'tinha', 'tengo', 'tenia', 'have', 'had', 'got', 'recebo', 'recebi', 'levo', 'peguei']);
const VILLAIN_REF = new Set(['ele', 'ela', 'vilao', 'villain', 'he', 'she', 'him', 'adversario', 'oponente', 'opponent', 'rival', 'gajo', 'tipo', 'cara', 'guy', 'reg', 'fish', 'peixe', 'pescado']);
const SHOW = new Set(['mostra', 'mostrou', 'shows', 'showed', 'muestra', 'mostro', 'ensena', 'enseno', 'vira', 'virou', 'tem', 'has', 'tiene']);
const WIN_1 = new Set(['ganho', 'ganhei', 'gano', 'gane', 'win', 'won', 'levo', 'levei', 'arrasto']);
const WIN_3 = new Set(['ganha', 'ganhou', 'gana', 'gano', 'wins', 'leva', 'levou', 'arrasta', 'arrastou', 'llevo', 'lleva']);
const SPLIT = new Set(['split', 'chop', 'dividimos', 'dividem', 'dividido', 'empate', 'empatamos', 'repartimos']);

type Person = 0 | 1 | 3;
interface VerbDef {
  /** passto: the action folds/checks round to a seat; foldall: everyone left folds. */
  kind: ActionKind | 'allin' | 'passto' | 'foldall';
  person: Person;
  /** 3-bet, 4-bet: a raise even without "raise". */
  open?: boolean;
  /** "Pagam os dois": the same action by every seat named with it. */
  plural?: boolean;
  /** A c-bet: with nobody named, the preflop raiser's. */
  cbet?: boolean;
}
const VERBS: Record<string, VerbDef> = {};
function verbs(kind: VerbDef['kind'], p0: string[], p1: string[], p3: string[], extra: Partial<VerbDef> = {}) {
  p0.forEach((w) => (VERBS[w] = { kind, person: 0, ...extra }));
  p1.forEach((w) => (VERBS[w] = { kind, person: 1, ...extra }));
  p3.forEach((w) => (VERBS[w] = { kind, person: 3, ...extra }));
}
verbs('fold', ['fold', 'folded', 'foldeo', 'tiro', 'retiro'], ['foldo', 'foldei', 'folde', 'desisto', 'desisti', 'largo', 'larguei', 'corri', 'corro', 'fujo', 'fugi'], ['folds', 'folda', 'foge', 'fugiu', 'foldou', 'desiste', 'desistiu', 'larga', 'largou', 'correu', 'corre', 'foldea', 'tira', 'retira']);
verbs('check', ['check', 'checked', 'checko', 'chequeo', 'mesa'], ['passo', 'passei', 'checkei', 'paso', 'pase', 'chequee'], ['checks', 'passa', 'passou', 'checka', 'checkou', 'chequea', 'pasa', 'mesou']);
verbs('call', ['call', 'called', 'limp', 'limped', 'flat', 'flatted', 'calleo'], ['pago', 'paguei', 'pague', 'igualo', 'igualei', 'iguale', 'callo', 'limpo', 'limpei', 'completo', 'completei', 'complete', 'flato'], ['calls', 'paga', 'pagou', 'iguala', 'igualou', 'calla', 'limps', 'limpa', 'limpou', 'completa', 'completou', 'completes', 'completed', 'flats', 'callea', 'limpea']);
verbs('bet', ['bet', 'betted', 'cbet', 'donk', 'lead', 'barrel', 'beteo', 'probe'], ['aposto', 'apostei', 'apuesto', 'aposte', 'beto', 'betei', 'cbeto', 'disparo', 'disparei'], ['bets', 'aposta', 'apostou', 'apuesta', 'beta', 'betou', 'cbets', 'leads', 'barrels', 'donks', 'betea', 'dispara', 'disparou']);
verbs('raise', ['raise', 'raised', 'reraise', 'reraised', 'open', 'opened', 'iso', 'squeeze', 'squeezed', 'raiseo', 'checkraise'], ['aumento', 'aumentei', 'subo', 'subi', 'abro', 'abri', 'resubo', 'isolo', 'isolei', 'reraiseo', 'relanco', 'relancei'], ['raises', 'reraises', 'opens', 'squeezes', 'isos', 'aumenta', 'aumentou', 'sobe', 'subiu', 'sube', 'subio', 'resube', 'resubio', 'isola', 'isolou', 'abre', 'abriu', 'abrio', 'relanca', 'relancou', 'checkraises']);
verbs('bet', ['cbet'], ['cbeto'], ['cbets'], { cbet: true });
verbs('raise', ['3bet', '4bet', '5bet', 'treebet', 'tribet'], ['3beto', '4beto', '3betei', '4betei'], ['3bets', '4bets', '5bets', '3beta', '4beta', '3betou', '4betou'], { open: true });
verbs('fold', [], [], ['foldam', 'foldaram', 'desistem', 'desistiram', 'largam', 'largaram', 'correm', 'correram', 'foldean', 'foldearon'], { plural: true });
verbs('check', [], [], ['passam', 'passaram', 'checkam', 'checkaram', 'pasan', 'pasaron', 'chequean'], { plural: true });
verbs('call', [], [], ['pagam', 'pagaram', 'limpam', 'limparam', 'igualam', 'igualaram', 'pagan', 'pagaron', 'igualan', 'limpean', 'completam', 'entram', 'entraram'], { plural: true });
verbs('passto', ['passto'], [], []);
verbs('foldall', ['foldall'], [], []);
verbs('allin', ['allin', 'shove', 'shoved', 'jam', 'jammed', 'push', 'pushed'], ['shovo', 'shovei', 'empurro', 'empurrei'], ['shoves', 'jams', 'pushes', 'shova', 'shovou', 'empurra', 'empurrou']);

/** Accented Spanish past forms, told apart before accents go: "pagó" is him, "pago" is me. */
const ES_PAST_3: Record<string, VerbDef> = {
  'pagó': { kind: 'call', person: 3 }, 'pasó': { kind: 'check', person: 3 }, 'apostó': { kind: 'bet', person: 3 }, 'subió': { kind: 'raise', person: 3 },
  'igualó': { kind: 'call', person: 3 }, 'foldeó': { kind: 'fold', person: 3 }, 'chequeó': { kind: 'check', person: 3 }, 'abrió': { kind: 'raise', person: 3 },
  'retiró': { kind: 'fold', person: 3 }, 'tiró': { kind: 'fold', person: 3 }, 'resubió': { kind: 'raise', person: 3 }, 'ganó': { kind: 'call', person: 3 },
};

/** "Faço fold", "dei check", "vai all-in": the helper says who, the noun says what. */
const AUX_1 = new Set(['faco', 'fiz', 'dou', 'dei', 'vou', 'fui', 'meto', 'meti', 'hago', 'hice', 'doy', 'di', 'voy', 'fiz', 'tento', 'mando', 'mandei']);
const AUX_3 = new Set(['faz', 'fez', 'da', 'deu', 'vai', 'foi', 'mete', 'meteu', 'hace', 'hizo', 'dio', 'pone', 'puso', 'va', 'fue', 'manda', 'mandou']);
const NOUNS: Record<string, VerbDef['kind']> = {
  fold: 'fold', check: 'check', mesa: 'check', call: 'call', limp: 'call', bet: 'bet', cbet: 'bet', aposta: 'bet', apuesta: 'bet', donk: 'bet', raise: 'raise',
  reraise: 'raise', '3bet': 'raise', '4bet': 'raise', '5bet': 'raise', squeeze: 'raise', iso: 'raise', allin: 'allin', tudo: 'allin', shove: 'allin', checkraise: 'raise', tribet: 'raise',
};

const STREETS: Record<string, Street> = { flop: 'flop', flope: 'flop', turn: 'turn', river: 'river', rio: 'river' };
const BY_WORDS = new Set(['mais', 'more', 'by', 'mas']);
const BB_UNIT = new Set(['bb', 'bbs', 'blinds', 'blind', 'bigs', 'grandes', 'ciegas', 'big']);
const X_UNIT = new Set(['x', 'vezes', 'veces', 'times']);
const POT_WORDS = new Set(['pote', 'pot', 'bote']);
const EFFECTIVE = new Set(['efetivo', 'efetivos', 'efetiva', 'efetivas', 'efectivo', 'efectivos', 'efectiva', 'efectivas', 'effective', 'effectives']);
const STACK_WORDS = new Set(['stack', 'stacks', 'fichas', 'chips', 'deep', ...EFFECTIVE]);
const BLIND_WORDS = new Set(['blinds', 'blind', 'nivel', 'level', 'ciegas', 'estrutura']);
const SIZE_WORDS = new Set(['max', 'handed', 'jogadores', 'jugadores', 'players', 'pessoas', 'lugares', 'seats']);

// ─── numbers ──────────────────────────────────────────────

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, un: 1, uno: 1, una: 1, one: 1, dois: 2, duas: 2, dos: 2, two: 2, tres: 3, three: 3, quatro: 4, cuatro: 4, four: 4,
  cinco: 5, five: 5, seis: 6, six: 6, sete: 7, siete: 7, seven: 7, oito: 8, ocho: 8, eight: 8, nove: 9, nueve: 9, nine: 9, dez: 10, diez: 10, ten: 10,
  onze: 11, once: 11, eleven: 11, doze: 12, doce: 12, twelve: 12, treze: 13, trece: 13, thirteen: 13, catorze: 14, quatorze: 14, catorce: 14, fourteen: 14,
  quinze: 15, quince: 15, fifteen: 15, dezasseis: 16, dezesseis: 16, dieciseis: 16, sixteen: 16, dezassete: 17, dezessete: 17, diecisiete: 17, seventeen: 17,
  dezoito: 18, dieciocho: 18, eighteen: 18, dezanove: 19, dezenove: 19, diecinueve: 19, nineteen: 19, vinte: 20, veinte: 20, twenty: 20, trinta: 30, treinta: 30,
  thirty: 30, quarenta: 40, cuarenta: 40, forty: 40, cinquenta: 50, cincuenta: 50, fifty: 50, sessenta: 60, sesenta: 60, sixty: 60, setenta: 70, seventy: 70,
  oitenta: 80, ochenta: 80, eighty: 80, noventa: 90, ninety: 90, cem: 100, cento: 100, cien: 100, ciento: 100, hundred: 100, duzentos: 200, doscientos: 200,
  trezentos: 300, trescientos: 300, quatrocentos: 400, cuatrocientos: 400, quinhentos: 500, quinientos: 500, seiscentos: 600, seiscientos: 600,
  setecentos: 700, setecientos: 700, oitocentos: 800, ochocientos: 800, novecentos: 900, novecientos: 900,
};
const THOUSAND = new Set(['mil', 'thousand', 'k']);
const HALF = new Set(['meio', 'meia', 'medio', 'media', 'half']);
const NUM_JOIN = new Set(['e', 'y', 'and']);

function numToken(w: string): number | null {
  if (/^\d+(\.\d+)?$/.test(w)) return parseFloat(w);
  return w in UNITS ? UNITS[w] : null;
}

/** "dois mil e quinhentos", "2 mil 500", "2.5", "vinte e cinco" → a number; null if none starts at i. */
function readNumber(w: string[], i: number): { value: number; next: number } | null {
  let total = 0;
  let current = 0;
  let any = false;
  let j = i;
  while (j < w.length) {
    const n = numToken(w[j]);
    if (n !== null) {
      // "twelve hundred", "two thousand five hundred": hundred multiplies what came just before.
      if (w[j] === 'hundred' && current && current < 100) {
        current *= 100;
        j++;
        continue;
      }
      // "dois cinco" is two numbers, not one: only bigger-then-smaller words add up.
      if (any && current && !(n < current && (current % 10 === 0 || current >= 100)) && !(w[j - 1] && NUM_JOIN.has(w[j - 1]))) break;
      if (n === 100 && current && current < 10) current *= 100;
      else current += n;
      any = true;
      j++;
      continue;
    }
    if (any && THOUSAND.has(w[j])) {
      total += (current || 1) * 1000;
      current = 0;
      j++;
      continue;
    }
    if (any && NUM_JOIN.has(w[j]) && j + 1 < w.length) {
      if (numToken(w[j + 1]) !== null) {
        j++;
        continue;
      }
      // "dois e meio": half of the unit just said.
      if (HALF.has(w[j + 1])) {
        if (current) current += 0.5;
        else total += 500;
        j += 2;
        break;
      }
    }
    if (!any && THOUSAND.has(w[j]) && w[j] === 'mil') {
      // "mil e quinhentos"
      total = 1000;
      any = true;
      j++;
      continue;
    }
    break;
  }
  if (!any) return null;
  return { value: total + current, next: j };
}

// ─── normalising ──────────────────────────────────────────

export function normalise(text: string): { words: string[]; raw: string[] } {
  let s = ' ' + text.toLowerCase() + ' ';
  // Spanish past forms keep their accent long enough to be told apart.
  for (const k of Object.keys(ES_PAST_3)) s = s.replace(new RegExp(`(^|[^\\p{L}])${k}(?=[^\\p{L}])`, 'gu'), `$1 §${Object.keys(ES_PAST_3).indexOf(k)} `);
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[’']/g, '');
  // Card symbols typed or pasted: ♠ ♥ ♦ ♣ (with or without the emoji selector).
  s = s.replace(/♠\uFE0F?/g, ' espadas ').replace(/[♥♡]\uFE0F?/g, ' copas ').replace(/[♦♢]\uFE0F?/g, ' ouros ').replace(/[♣♧]\uFE0F?/g, ' paus ');
  // "$2,500", "€2500": the symbol before the number (dictation writes it there) goes after it.
  s = s.replace(/(?<!r)([$€£])\s?(\d[\d.,]*)/g, ' $2 $1 ').replace(/\br\$\s?(?=\d)/g, ' ');
  // "Dá-me 3-bet", "faz-me raise": the "-me" only says it was against hero.
  s = s.replace(/(\p{L})-(?:me|te|nos)(?![\p{L}\d])/gu, '$1');
  // 2.500 / 1.000.000 → 2500; 2,5 → 2.5
  while (/\d\.\d{3}(?!\d)/.test(s)) s = s.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2');
  // "2,500" (English) is a thousand-mark; "2,5" a decimal.
  s = s.replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/(\d),(\d)/g, '$1.$2');
  // "12 500" (pt-PT groups thousands with a space), but not blinds said as "200 400".
  s = s.replace(/(?<![\d.])(\d{1,3}) (\d{3})(?![\d.])/g, (m, a: string, b: string) => (Number(b) === Number(a) * 2 ? m : a + b));
  s = s.replace(/(\d+(?:\.\d+)?)\s*k\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000)));
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 %');
  s = s.replace(/(\d)\s*x\b/g, '$1 x');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(bbs?)\b/g, '$1 bb');
  s = s.replace(/(\d)\s*\/\s*(\d)/g, '$1 / $2');
  // "Abre para 900, não, para 1100", "subo a 1000, perdón, a 1100": the amount said last stands.
  s = s.replace(/(?<![\d.])\d+(?:\.\d+)?(?: (?:mil|bb|x|%))?[\s,.]+(?:(?:nao|no|perdon|perdao|desculpa|desculpe|digo|quer dizer|ou melhor|o sea|mejor dicho|sorry|i mean|correction|correcao)[\s,.]+)+(?:(?:para|pra|a|to|por|de) )?(?=\d)/g, '');
  const sub: [RegExp, string | ((m: string) => string)][] = [
    // "O resto foge": the rest fold, it isn't "o resto" as in all-in.
    [/\b(?:o resto|os outros|el resto|los demas|the rest|resto) (?:fold|folds|foldam|foldaram|foldaron|foldean|desiste|desistem|desistiu|desistiram|larga|largam|corre|correm|correram|foge|fogem|fugiu|fugiram|sai|saem|saiu|sairam|se van|se fueron|se retira|se retiran|se tiran)\b/g, ' foldall '],
    [/\ball[\s-]*ins?\b|\bol[\s-]*in\b|\ba tudo\b|\bo resto\b/g, ' allin '],
    [/\bcheck[\s-]*raise[sd]?\b|\bcheque raise\b/g, ' checkraise '],
    [/(?<!\+ ?)\b([2-5])[\s-]*bet(s|o|ei|ou|a)?\b/g, ' $1bet$2 '],
    [/\b(tres|three|tri|tree)[\s-]*bet(s|o|ei|ou|a)?\b/g, ' 3bet$2 '],
    [/\b(quatro|cuatro|four)[\s-]*bet(s|o|ei|ou|a)?\b/g, ' 4bet$2 '],
    [/\bmin[\s-]*raise[sd]?\b|\bmini[\s-]*raise\b|\bmin[\s-]*click\b/g, ' minraise '],
    [/\bre[\s-]*raise/g, ' reraise'],
    [/\bc[\s-]*bet/g, ' cbet'],
    [/\bunder the gun\b/g, ' utg '],
    [/\bbig slick\b/g, ' ace king '],
    [/\butg\s*(?:\+|mais|plus|mas)\s*(1|um|one|uno|2|dois|two|dos)\b/g, (m: string) => (/(1|um|one|uno)$/.test(m) ? ' utg1 ' : ' utg2 ')],
    [/\b(?:middle|mid)\s*position\b|\bposicao (?:do )?meio\b|\bposicion media\b/g, ' mp '],
    [/\b(?:lo|low)[\s-]*jack\b|\blojack\b/g, ' lj '],
    [/\b(?:hi|high)[\s-]*jack\b|\bhijack\b/g, ' hj '],
    [/\bcut[\s-]*off\b|\bcutoff\b/g, ' co '],
    [/\bbig[\s-]*blind\b|\bbigblind\b|\bbig blinde\b|\bciega grande\b/g, ' bb '],
    // "La ciega pasa": a blind on its own is the big blind.
    [/\bciega\b(?! (?:pequena|chica|grande))/g, ' bb '],
    [/\bsmall[\s-]*blind\b|\bsmallblind\b|\bciega (?:pequena|chica)\b/g, ' sb '],
    [/\bbotao\b|\bboton\b|\bbutton\b|\bdealer\b|\bbtn\b/g, ' btn '],
    [/\barco[\s-]*iris\b/g, ' arcoiris '],
    [/\bheads[\s-]*up\b|\bheadsup\b|\bmano a mano\b/g, ' hu '],
    [/\bpre[\s-]*flop\b/g, ' preflop '],
    [/\b(?:do|del|of the)? ?mesmo naipe\b|\bdel mismo palo\b|\bmismo palo\b|\bsame suit(?:ed)?\b/g, ' suited '],
    [/\bnaipes? diferentes?\b|\bpalos? (?:distintos|diferentes)\b|\bdifferent suits\b|\boff[\s-]*suit(?:ed)?\b/g, ' offsuit '],
    [/\bmeio pote\b|\bmetade do pote\b|\bhalf(?: the)? pot\b|\bmedio bote\b|\bmitad del bote\b|\bmeio pot\b/g, ' %50 pote '],
    [/\b(?:um|one|a|un) (?:terco|third|tercio)(?: do| of the| del)?(?: pote| pot| bote)?\b/g, ' %33 pote '],
    [/\b(?:dois|two|dos) (?:tercos|thirds|tercios)(?: do| of the| del)?(?: pote| pot| bote)?\b/g, ' %67 pote '],
    [/\b(?:tres|three) (?:quartos|quarters|cuartos)(?: do| of the| del)?(?: pote| pot| bote)?\b/g, ' %75 pote '],
    [/\b(?:um|one|a|un) (?:quarto|quarter|cuarto)(?: do| of the| del)?(?: pote| pot| bote)?\b/g, ' %25 pote '],
    [/\b(\d+(?:\.\d+)?) (?:%|por cento|percent|por ciento)(?: do| of the| del)?(?: pote| pot| bote)?/g, ' %$1 pote '],
    [/\bse retiran\b|\bse tiran\b/g, ' foldam '],
    // "Lo veo", "yo veo." is a call; "veo que apuesta" is only seeing.
    [/\b(?:lo|la|te|yo lo|yo la) veo\b|\bveo(?=\s*(?:[.,;!?]|$))/g, ' pago '],
    [/\bme retiro\b|\bse retira\b|\bme tiro\b|\bse tira\b/g, (m: string) => (m.startsWith('me') ? ' foldo ' : ' folds ')],
    [/\b(\d+)[\s-]*max\b/g, ' $1 max '],
    // "Toda a gente desiste" is pt-PT for everyone; "ninguém paga", "nobody calls": the rest fold.
    [/\btoda a gente\b/g, ' todos '],
    [/\b(?:ninguem|nadie|nobody|no one|noone) (?:paga|pagou|iguala|call|calls|called|quis|quiere|quiso|wants)\b/g, ' foldall '],
    // "Pasamos los dos", "passamos": everyone checks.
    [/\b(?:pasamos|passamos|checamos|checkeamos|we (?:both )?check(?:ed)?)(?: (?:los|las|os|as) (?:dos|dois|duas|tres))?\b/g, ' todos check '],
    [/\b(?:nao (?:paga|pagou) ninguem|no (?:paga|pago) nadie)\b/g, ' foldall '],
    // "Ninguém aposta", "nadie apuesta": it checks through.
    [/\b(?:ninguem|nadie|nobody|no one|noone) (?:aposta|apostou|apuesta|aposto|bets|bet)\b/g, ' todos check '],
    // "fold até mim", "checked to the button": the action passes to that seat.
    [/\b(?:todos |todo mundo |all |everyone |everybody |it )?(?:fold|folds|folded|folda|foldou|foldam|foldaram|foldaron|foldean|foldea|check|checks|checked|checkam|checkaram|passa|passou|passam|passaram|pasa|pasan|corre|correm|correu|foge|fogem|desiste|desistem|larga|largam|sai|saem|is folded|gets folded|comes|vem|vai)(?: around)? (?:ate|to|hasta|pra|para) (?:o |a |ao |a la |al |the |el |la |me )?(eu|mim|me|mi|hero|ti|utg1|utg2|utg|mp|lj|hj|co|btn|sb|bb)\b/g, ' passto $1 '],
    [/\b(?:todos|all|everyone|everybody|o resto|the rest|el resto|resto) (?:fold|folds|foldam|foldaram|foldaron|foldean|desistem|largam|correm|correram)\b|\b(?:fold|foldam|foldaram) (?:todos|all|around)\b|\beveryone folds\b/g, ' foldall '],
  ];
  // Spaces collapse after each step: the position words come out padded and later patterns expect one space.
  for (const [re, to] of sub) s = (typeof to === 'string' ? s.replace(re, to) : s.replace(re, to)).replace(/ {2,}/g, ' ');
  s = s.replace(/\.(?!\d)|(?<!\d)\./g, ' , ').replace(/[;:!?()"“”«»…]/g, ' , ').replace(/,/g, ' , ').replace(/\s-\s/g, ' , ').replace(/[-–—]/g, ' ');
  const raw = s.split(/\s+/).filter(Boolean);
  return { words: raw, raw };
}

// ─── atoms ────────────────────────────────────────────────

/** How the board's suits were described: rainbow (1 of each), two of a suit, monotone. */
type Texture = { n: 1 | 2 | 3; suit?: Suit };

interface CardSpec {
  r: Rank;
  s?: Suit;
}
type Actor = { k: 'hero' } | { k: 'pos'; label: string } | { k: 'villain' };
type Amount = { v: number; unit: 'chips' | 'bb' | 'x' | 'pot'; by?: boolean };

type Atom =
  | { t: 'actor'; a: Actor; at: number }
  | { t: 'heroMark'; at: number }
  | { t: 'have'; at: number }
  | { t: 'verb'; v: VerbDef; at: number }
  | { t: 'amount'; amt: Amount; at: number }
  | { t: 'cards'; cards: CardSpec[]; suited?: boolean; texture?: Texture; at: number }
  | { t: 'street'; s: Street; at: number }
  | { t: 'show'; at: number }
  | { t: 'win'; who: 'hero' | 'other' | 'split'; at: number }
  | { t: 'stack'; at: number; effective?: boolean }
  | { t: 'blinds'; sb: number; bb: number; at: number }
  | { t: 'ante'; at: number }
  | { t: 'size'; n: number; at: number }
  | { t: 'only'; at: number }
  | { t: 'everyone'; at: number }
  | { t: 'straddle'; from: 'utg' | 'btn'; at: number }
  | { t: 'break'; at: number };

function isCardWord(w: string | undefined): boolean {
  if (!w) return false;
  return w in RANK_WORDS || w in PAIR_WORDS || w in SUIT_WORDS || /^[akqjt2-9]{2}[so]?$/.test(w) || SUITED.has(w) || OFFSUIT.has(w);
}

const UNIT_AFTER = new Set([...THOUSAND, ...BB_UNIT, ...X_UNIT, 'fichas', 'chips', 'euros', 'dolares', 'dollars', 'eur', '€', '$', 'pote', 'pot', 'bote', '%', 'de']);

/**
 * Cards from i on: up to `max`, in any of the ways players say them. Stops at
 * the first word that isn't a card or a filler.
 */
function readCards(w: string[], i: number, max: number, eager: boolean): { cards: CardSpec[]; suited?: boolean; texture?: Texture; next: number } {
  const cards: CardSpec[] = [];
  let suited: boolean | undefined;
  let texture: Texture | undefined;
  let j = i;
  let lastCountWord = -1;
  let end = i;
  while (j < w.length && cards.length < max) {
    const x = w[j];
    const nx = w[j + 1];
    const count = ({ dois: 2, duas: 2, two: 2, dos: 2, '2': 2, tres: 3, three: 3, '3': 3 } as Record<string, 2 | 3>)[x];
    if (count && nx && nx in SUIT_WORDS && eager && cards.length >= 2) {
      // "com duas espadas", "two hearts": the board's suits, not a card.
      texture = { n: count, suit: SUIT_WORDS[nx] };
      j += 2;
      end = j;
      continue;
    }
    if ((x === 'par' || x === 'pair' || x === 'pocket' || x === 'pareja') && (w[j + 1] === 'de' || w[j + 1] === 'of') && (w[j + 2] in RANK_WORDS || w[j + 2] in PAIR_WORDS)) {
      const r = RANK_WORDS[w[j + 2]] ?? PAIR_WORDS[w[j + 2]];
      cards.push({ r }, { r });
      j += 3;
      end = j;
      continue;
    }
    if (x in PAIR_WORDS) {
      // "dois reis", "two kings": the count isn't a card.
      if (lastCountWord === cards.length - 1 && cards.length) cards.pop();
      const r = PAIR_WORDS[x];
      cards.push({ r }, { r });
      j++;
      end = j;
      continue;
    }
    if (x in RANK_WORDS || x === 'a') {
      const r = x === 'a' ? 'A' : RANK_WORDS[x];
      const weak = x === 'a' || WEAK_RANKS.has(x);
      const digit = /^\d+$/.test(x);
      // A number with a unit after it is an amount ("10 mil", "3 bb").
      if (digit && nx && UNIT_AFTER.has(nx) && !(nx === 'de' && w[j + 2] && w[j + 2] in SUIT_WORDS)) break;
      if (digit && !eager && !cards.length) break;
      if (weak && !eager && !(isCardWord(nx) || isCardWord(w[j - 1]) || (nx === 'de' && w[j + 2] in SUIT_WORDS) || nx === 'of' || cards.length)) break;
      // After a street, "a dama" is the queen: "a" is an ace only on its own.
      if (x === 'a' && eager && ['dama', 'rainha', 'reina', 'queen'].includes(nx ?? '')) {
        j++;
        continue;
      }
      const card: CardSpec = { r };
      j++;
      if (w[j] in SUIT_WORDS) card.s = SUIT_WORDS[w[j++]];
      else if ((w[j] === 'de' || w[j] === 'of' || w[j] === 'do' || w[j] === 'da') && w[j + 1] in SUIT_WORDS) {
        card.s = SUIT_WORDS[w[j + 1]];
        j += 2;
      }
      if (['dois', 'duas', 'two', 'dos', '2'].includes(x)) lastCountWord = cards.length;
      cards.push(card);
      end = j;
      continue;
    }
    const combo = /^([akqjt2-9])([akqjt2-9])([so])?$/.exec(x);
    if (combo && !/^\d+$/.test(x)) {
      const toR = (c: string) => c.toUpperCase() as Rank;
      cards.push({ r: toR(combo[1]) }, { r: toR(combo[2]) });
      if (combo[3]) suited = combo[3] === 's';
      j++;
      end = j;
      continue;
    }
    if (/^(\d)\1$/.test(x)) {
      cards.push({ r: x[0] as Rank }, { r: x[0] as Rank });
      j++;
      end = j;
      continue;
    }
    if (x in SUIT_WORDS && cards.length) {
      // "rei sete dois de copas": the suit goes with the card just said.
      const last = cards[cards.length - 1];
      if (!last.s) last.s = SUIT_WORDS[x];
      j++;
      end = j;
      continue;
    }
    if (SUITED.has(x)) {
      suited = true;
      j++;
      end = j;
      continue;
    }
    if (OFFSUIT.has(x)) {
      suited = false;
      j++;
      end = j;
      continue;
    }
    if (RAINBOW.has(x)) {
      texture = { n: 1 };
      j++;
      end = j;
      continue;
    }
    if (MONOTONE.has(x)) {
      texture = { n: 3 };
      j++;
      end = j;
      continue;
    }
    if (CARD_FILLER.has(x) || (x === ',' && eager && isCardWord(nx))) {
      j++;
      continue;
    }
    break;
  }
  // "9 8 suited": the word after the last card still counts.
  for (; j < w.length && j <= end + 1; j++) {
    if (SUITED.has(w[j])) suited = true;
    else if (OFFSUIT.has(w[j])) suited = false;
    else if (RAINBOW.has(w[j])) texture = { n: 1 };
    else if (MONOTONE.has(w[j])) texture = { n: 3 };
    else continue;
    end = j + 1;
  }
  return { cards, suited, texture, next: Math.max(end, i + (cards.length ? 1 : 0)) };
}

function readAmountUnit(w: string[], j: number): { unit: Amount['unit']; next: number } {
  if (BB_UNIT.has(w[j])) {
    // "big blinds"
    if (w[j] === 'big' && (w[j + 1] === 'blinds' || w[j + 1] === 'blind')) return { unit: 'bb', next: j + 2 };
    if (w[j] === 'big') return { unit: 'chips', next: j };
    return { unit: 'bb', next: j + 1 };
  }
  if (X_UNIT.has(w[j])) return { unit: 'x', next: j + 1 };
  return { unit: 'chips', next: j };
}

export function atomise(text: string): Atom[] {
  const { words: w } = normalise(text);
  const out: Atom[] = [];
  let cardMode: 'hole' | 'board' | 'show' | null = null;
  let i = 0;
  while (i < w.length) {
    const x = w[i];
    if (x === ',') {
      out.push({ t: 'break', at: i });
      i++;
      continue;
    }
    if (x.startsWith('§')) {
      const k = Object.keys(ES_PAST_3)[Number(x.slice(1))];
      const v = ES_PAST_3[k];
      if (k === 'ganó') out.push({ t: 'win', who: 'other', at: i });
      else out.push({ t: 'verb', v, at: i });
      i++;
      continue;
    }
    if (x in STREETS && !(x === 'rio' && !(w[i - 1] === 'o' || w[i - 1] === 'el' || w[i - 1] === 'no' || w[i - 1] === 'en'))) {
      out.push({ t: 'street', s: STREETS[x], at: i });
      const c = readCards(w, i + 1, 5, true);
      if (c.cards.length) out.push({ t: 'cards', cards: c.cards, texture: c.texture, at: i + 1 });
      i = Math.max(i + 1, c.next);
      cardMode = null;
      continue;
    }
    // "Os dois pagam", "todo mundo corre", "both call": every seat still to act does it.
    const every = ['todos', 'todas', 'ambos', 'ambas', 'both', 'everyone', 'everybody'].includes(x) ? 1 : (x === 'todo' && w[i + 1] === 'mundo') || ((x === 'os' || x === 'los' || x === 'las') && (w[i + 1] === 'dois' || w[i + 1] === 'dos' || w[i + 1] === 'duas' || w[i + 1] === 'blinds' || w[i + 1] === 'ciegas')) ? 2 : 0;
    if (every) {
      let j = i + every;
      if (w[j] === 'blinds' || w[j] === 'ciegas') j++;
      if (w[j] in VERBS || AUX_3.has(w[j] ?? '') || w[j] === 'allin') {
        out.push({ t: 'everyone', at: i });
        i = j;
        continue;
      }
    }
    // "O botão paga e o big também", "and the big blind too": that seat does the same.
    if (['tambem', 'tambien', 'too', 'also'].includes(x) && out[out.length - 1]?.t === 'actor' && !(w[i + 1] in VERBS)) {
      const prev = [...out].reverse().find((a): a is Extract<Atom, { t: 'verb' }> => a.t === 'verb');
      if (prev && (prev.v.kind === 'call' || prev.v.kind === 'check' || prev.v.kind === 'fold')) out.push({ t: 'verb', v: prev.v, at: i });
      i++;
      continue;
    }
    if (['so', 'only', 'solo', 'apenas', 'somente'].includes(x)) {
      out.push({ t: 'only', at: i });
      i++;
      continue;
    }
    if (x === 'preflop') {
      i++;
      continue;
    }
    if (x in POS_WORDS) {
      out.push({ t: 'actor', a: { k: 'pos', label: POS_WORDS[x] }, at: i });
      i++;
      continue;
    }
    // "o big", "small abre", "estou de big", "la pequeña": the blinds, but not "big pot" or "15 big blinds".
    const blindWord = x === 'big' || x === 'small' || ((x === 'pequena' || x === 'chica' || x === 'grande') && w[i - 1] === 'la');
    if (blindWord && !['pot', 'pote', 'bote', 'bet', 'stack', 'hand', 'mao', 'mano', 'blinds', 'ciegas'].includes(w[i + 1] ?? '') && numToken(w[i - 1] ?? '') === null) {
      out.push({ t: 'actor', a: { k: 'pos', label: x === 'big' || x === 'grande' ? 'BB' : 'SB' }, at: i });
      i++;
      continue;
    }
    if (x === 'straddle' || x === 'straddles') {
      // "o straddle paga": the seat that straddled; "com straddle (de 800)": the game has one.
      if (['o', 'the', 'el', 'do', 'del'].includes(w[i - 1] ?? '') && (w[i + 1] in VERBS || AUX_3.has(w[i + 1] ?? '') || w[i + 1]?.startsWith('§'))) {
        out.push({ t: 'actor', a: { k: 'pos', label: 'STRADDLE' }, at: i });
        i++;
        continue;
      }
      let j = i + 1;
      const btn = w.slice(Math.max(0, i - 3), i + 4).includes('btn');
      out.push({ t: 'straddle', from: btn ? 'btn' : 'utg', at: i });
      // Its size is always double the big blind here: the amount said is skipped.
      if (w[j] === 'de' || w[j] === 'of') j++;
      const num = readNumber(w, j);
      i = num ? num.next : i + 1;
      continue;
    }
    if (x === 'hu') {
      out.push({ t: 'size', n: 2, at: i });
      i++;
      continue;
    }
    // "O big me dá 3-bet", "la ciega grande me sube": "me" says whom it was against, the seat acts.
    // "Apuesto 1000, me paga": a third-person verb after "me" is the villain's too.
    const villainAct = (out.length > 0 && out[out.length - 1].t === 'actor' && (out[out.length - 1] as { a: { k: string } }).a.k !== 'hero') || VERBS[w[i + 1] ?? '']?.person === 3 || AUX_3.has(w[i + 1] ?? '');
    const clitic = x === 'me' && villainAct && !!w[i + 1] && (w[i + 1] in VERBS || AUX_3.has(w[i + 1]));
    if (clitic) {
      i++;
      continue;
    }
    if (HERO_REF.has(x) && !(x === 'me' && out.length && out[out.length - 1].t === 'verb')) {
      out.push({ t: 'actor', a: { k: 'hero' }, at: i });
      i++;
      continue;
    }
    if (x === 'el' && w[i + 1] && (w[i + 1] in VERBS || AUX_3.has(w[i + 1]) || w[i + 1].startsWith('§') || SHOW.has(w[i + 1]) || w[i + 1] === 'tenia')) {
      out.push({ t: 'actor', a: { k: 'villain' }, at: i });
      i++;
      continue;
    }
    if (VILLAIN_REF.has(x) && !(x === 'tipo' && w[i - 1] !== 'o' && w[i - 1] !== 'um') && !(x === 'cara' && w[i - 1] !== 'o')) {
      out.push({ t: 'actor', a: { k: 'villain' }, at: i });
      i++;
      continue;
    }
    if (HERO_MARK.has(x) || (x === 'to' && ['no', 'na', 'de', 'com', 'em'].includes(w[i + 1] ?? ''))) {
      out.push({ t: 'heroMark', at: i });
      i++;
      continue;
    }
    const lastAtom = out.filter((a) => a.t !== 'break').pop();
    const afterAction = out.some((a) => a.t === 'verb') && lastAtom?.t !== 'actor' && lastAtom?.t !== 'heroMark';
    // "Ele tinha QQ"; "…e pago, tenía cinco cuatro": with no subject after the action, the opponent's.
    if (['tinha', 'tenia', 'had'].includes(x) && ((lastAtom?.t === 'actor' && lastAtom.a.k !== 'hero') || (afterAction && out[out.length - 1]?.t === 'break'))) {
      out.push({ t: 'show', at: i });
      cardMode = 'show';
      i++;
      continue;
    }
    if (HAVE_1.has(x)) {
      // "tenho 30 mil" is a stack, "tenho ás rei" are cards.
      const num = readNumber(w, i + 1);
      if (num && !(isCardWord(w[i + 1]) && !UNIT_AFTER.has(w[num.next] ?? ''))) {
        out.push({ t: 'heroMark', at: i }, { t: 'stack', at: i });
        i++;
        continue;
      }
      out.push({ t: 'have', at: i });
      cardMode = 'hole';
      i++;
      continue;
    }
    if (SPLIT.has(x)) {
      out.push({ t: 'win', who: 'split', at: i });
      i++;
      continue;
    }
    if (WIN_1.has(x) && !(x === 'levo' && isCardWord(w[i + 1]))) {
      out.push({ t: 'win', who: 'hero', at: i });
      i++;
      continue;
    }
    if (WIN_3.has(x)) {
      out.push({ t: 'win', who: 'other', at: i });
      i++;
      continue;
    }
    // "abre" opens the action, unless cards follow ("abre ás rei" at showdown).
    const pairNext = ['par', 'pair', 'pareja', 'pocket'].includes(w[i + 1] ?? '') || ['par', 'pair', 'pareja'].includes(w[i + 2] ?? '');
    if (SHOW.has(x) && (isCardWord(w[i + 1]) || isCardWord(w[i + 2]) || pairNext) && !(x in VERBS && !isCardWord(w[i + 1]) && !isCardWord(w[i + 2]))) {
      out.push({ t: 'show', at: i });
      cardMode = 'show';
      i++;
      continue;
    }
    if (x === 'minraise') {
      // "faz minraise", "min-raises": a raise to twice the bet.
      const aux = out[out.length - 1];
      if (aux?.t === 'verb' && aux.at === i - 1) out.pop();
      const person: Person = AUX_1.has(w[i - 1] ?? '') ? 1 : AUX_3.has(w[i - 1] ?? '') ? 3 : 0;
      out.push({ t: 'verb', v: { kind: 'raise', person }, at: i }, { t: 'amount', amt: { v: 2, unit: 'x' }, at: i });
      i++;
      continue;
    }
    if (AUX_1.has(x) || AUX_3.has(x)) {
      // "faço fold", "dou um raise para 5000", "vai all-in"
      let j = i + 1;
      while (j < w.length && j <= i + 3 && !(w[j] in NOUNS) && ['um', 'uma', 'un', 'una', 'a', 'o', 'the', 'an', 'de', 'pequeno', 'pequena', 'grande', 'small', 'big', 'mini', 'min'].includes(w[j])) j++;
      if (w[j] in NOUNS) {
        const kind = NOUNS[w[j]];
        out.push({ t: 'verb', v: { kind, person: AUX_1.has(x) ? 1 : 3, open: /^\dbet$/.test(w[j]), ...(w[j] === 'cbet' ? { cbet: true } : {}) }, at: i });
        i = j + 1;
        continue;
      }
    }
    if (x === 'allin') {
      // "dá 4bet all-in", "aposta 5000 all-in": the verb just said, for everything.
      const back = out[out.length - 1]?.t === 'amount' ? out[out.length - 2] : out[out.length - 1];
      if (back?.t === 'verb') {
        if (back.v.kind === 'bet' || back.v.kind === 'raise') back.v = { ...back.v, kind: 'allin' };
        i++;
        continue;
      }
    }
    if (x in VERBS) {
      // "aposta" is also "a bet" ("faz uma aposta"), handled above; "mesa" as check only after a verb-ish word.
      if (x === 'mesa' && !['dei', 'deu', 'dou', 'da', 'eu', 'ele', 'e'].includes(w[i - 1] ?? '')) {
        // "mesa de 6": table size
        const n = w[i + 1] === 'de' ? readNumber(w, i + 2) : null;
        if (n && n.value >= 2 && n.value <= 10) {
          out.push({ t: 'size', n: n.value, at: i });
          i = n.next;
          continue;
        }
        // "Turn ás, mesa, ele aposta": on its own between commas (or after a seat), a check by whoever is to act.
        const prev = w[i - 1] ?? ',';
        const alone = (prev === ',' || prev in POS_WORDS || prev === 'big' || prev === 'small') && (w[i + 1] === undefined || w[i + 1] === ',' || w[i + 1] === 'e' || w[i + 1] === 'mesa');
        if (alone || (prev === 'mesa' && out[out.length - 1]?.t === 'verb')) {
          out.push({ t: 'verb', v: VERBS.mesa, at: i });
          i++;
          continue;
        }
        i++;
        continue;
      }
      if ((x === 'tira' || x === 'tiro') && isCardWord(w[i + 1])) {
        i++;
        continue;
      }
      out.push({ t: 'verb', v: VERBS[x], at: i });
      i++;
      if (VERBS[x].kind === 'call' || VERBS[x].kind === 'check' || VERBS[x].kind === 'fold') cardMode = null;
      continue;
    }
    if (x === 'mesa') {
      const n = w[i + 1] === 'de' ? readNumber(w, i + 2) : null;
      if (n && n.value >= 2 && n.value <= 10) {
        out.push({ t: 'size', n: n.value, at: i });
        i = n.next;
        continue;
      }
    }
    if (STACK_WORDS.has(x)) {
      out.push({ t: 'stack', at: i, effective: EFFECTIVE.has(x) });
      i++;
      continue;
    }
    if (x === 'ante') {
      out.push({ t: 'ante', at: i });
      i++;
      continue;
    }
    if (x.startsWith('%') && x.length > 1) {
      out.push({ t: 'amount', amt: { v: parseFloat(x.slice(1)) / 100, unit: 'pot' }, at: i });
      i += w[i + 1] === 'pote' ? 2 : 1;
      continue;
    }
    if (POT_WORDS.has(x) && (w[i - 1] === 'o' || w[i - 1] === 'the' || w[i - 1] === 'el' || w[i - 1] === 'ao' || w[i - 1] === 'al' || w[i - 1] === 'um' || w[i - 1] === 'a' || out[out.length - 1]?.t === 'verb')) {
      out.push({ t: 'amount', amt: { v: 1, unit: 'pot' }, at: i });
      i++;
      continue;
    }
    if (x === 'overbet') {
      out.push({ t: 'verb', v: { kind: 'bet', person: 0 }, at: i }, { t: 'amount', amt: { v: 1.5, unit: 'pot' }, at: i });
      i++;
      continue;
    }
    // Cards: right after a cue ("com", "tenho", "mostra", a street), or rank words that can't be anything else.
    const CUES = ['com', 'with', 'con', 'cartas', 'cards', 'mao', 'mano', 'hand', 'segurando', 'holding'];
    // "com o ás de copas", "con el siete": an article between the cue and the card.
    const cue = cardMode !== null || CUES.includes(w[i - 1] ?? '') || (ARTICLES.has(w[i - 1] ?? '') && CUES.includes(w[i - 2] ?? ''));
    // "Botão, ás rei": a weak rank word right before another rank is a card too.
    // "With a $6 straddle": an amount, not the ace of anything.
    const moneyAfter = (y?: string) => !!y && y !== 'de' && (UNIT_AFTER.has(y) || ['straddle', 'ante', 'dollar', 'euro', 'real', 'reais'].includes(y));
    const nextRank = (k: number) => !/^\d+$/.test(w[k] ?? '') && (w[k] in RANK_WORDS || w[k] in PAIR_WORDS);
    const weakPair = WEAK_RANKS.has(x) && x !== 'a' && (nextRank(i + 1) || (w[i + 1] in SUIT_WORDS && nextRank(i + 2)));
    const strongRank = (x in RANK_WORDS && !WEAK_RANKS.has(x) && !/^\d+$/.test(x) && numToken(x) === null) || x in PAIR_WORDS || (/^[akqjt2-9]{2}[so]?$/.test(x) && !/^\d+$/.test(x)) || /^(\d)\1$/.test(x);
    const pairCue = (x === 'par' || x === 'pair' || x === 'pocket' || x === 'pockets' || x === 'pareja') && (isCardWord(w[i + 1]) || ((w[i + 1] === 'de' || w[i + 1] === 'of') && isCardWord(w[i + 2])));
    if ((cue && isCardWord(x) && !(/^\d+$/.test(x) && moneyAfter(w[i + 1]))) || strongRank || pairCue || weakPair || (cue && x === 'a' && isCardWord(w[i + 1]) && !moneyAfter(w[i + 2]))) {
      const c = readCards(w, i, 2, cue || pairCue);
      if (c.cards.length) {
        out.push({ t: 'cards', cards: c.cards, suited: c.suited, at: i });
        i = c.next;
        cardMode = null;
        continue;
      }
    }
    if (x === 'x' && w[i - 1] === ',') {
      i++;
      continue;
    }
    // Amounts: "para 2500", "4 mil", "2.5 bb", "3x".
    const num = readNumber(w, i);
    if (num) {
      let j = num.next;
      // "1000 / 2000": the blinds
      if (w[j] === '/' && readNumber(w, j + 1)) {
        const bbN = readNumber(w, j + 1)!;
        // "400/200" said the wrong way round is still 200/400.
        out.push({ t: 'blinds', sb: Math.min(num.value, bbN.value), bb: Math.max(num.value, bbN.value), at: i });
        i = bbN.next;
        continue;
      }
      // "6 max", "9 jogadores"
      const tableCue = ['max', 'handed'].includes(w[j]) || ['mesa', 'de', 'com', 'table', 'of', 'with', 'somos', 'eramos', 'estamos', 'a'].includes(w[i - 1] ?? '');
      if (SIZE_WORDS.has(w[j]) && tableCue && num.value >= 2 && num.value <= 10 && Number.isInteger(num.value)) {
        out.push({ t: 'size', n: num.value, at: i });
        i = j + 1;
        continue;
      }
      if (SIZE_WORDS.has(w[j])) {
        // "dois jogadores pagam": a count of players, not a size.
        i = j + 1;
        continue;
      }
      const u = readAmountUnit(w, j);
      j = u.next;
      const by = BY_WORDS.has(w[i - 1] ?? '');
      out.push({ t: 'amount', amt: { v: num.value, unit: u.unit, ...(by ? { by } : {}) }, at: i });
      i = j;
      continue;
    }
    if (BLIND_WORDS.has(x)) {
      // "blinds 500 1000"
      const a = readNumber(w, i + 1);
      const b = a && readNumber(w, a.next + (w[a.next] === 'e' || w[a.next] === '/' ? 1 : 0));
      if (a && b && b.value >= a.value) {
        out.push({ t: 'blinds', sb: a.value, bb: b.value, at: i });
        i = b.next;
        continue;
      }
    }
    i++;
  }
  return out;
}

// ─── playing it out ───────────────────────────────────────

/** A position this table doesn't have, mapped to the nearest one it does. */
const POS_ALIAS: Record<string, string[]> = {
  MP: ['MP', 'LJ', 'UTG+2', 'HJ', 'UTG+1', 'UTG'],
  LJ: ['LJ', 'MP', 'HJ', 'UTG+2', 'UTG+1', 'UTG'],
  HJ: ['HJ', 'LJ', 'MP', 'CO'],
  'UTG+1': ['UTG+1', 'LJ', 'HJ', 'MP', 'UTG'],
  'UTG+2': ['UTG+2', 'MP', 'LJ', 'HJ', 'UTG+1'],
  UTG: ['UTG', 'HJ', 'CO', 'BTN'],
  CO: ['CO', 'HJ', 'BTN'],
  BTN: ['BTN'],
  SB: ['SB', 'BTN'],
  BB: ['BB'],
};

function seatOf(label: string, n: number, button: number): number | null {
  const pos = positions(n, button);
  for (const l of POS_ALIAS[label] ?? [label]) {
    const i = pos.indexOf(l);
    if (i >= 0) return i;
  }
  return null;
}

interface Ev {
  kind: 'act';
  actor: Actor | null;
  person: Person;
  verb: VerbDef['kind'];
  open?: boolean;
  amt?: Amount;
  /** "Só o big paga": everyone else still to act folds. */
  only?: boolean;
  /** "Os dois pagam": every seat still to act on this street does it. */
  every?: boolean;
  cbet?: boolean;
}
type Event =
  | Ev
  | { kind: 'street'; s: Street; cards: CardSpec[]; texture?: Texture }
  | { kind: 'show'; actor: Actor | null; cards: CardSpec[]; suited?: boolean }
  | { kind: 'win'; who: 'hero' | 'other' | 'split'; actor: Actor | null };

interface Setup {
  heroPos?: string;
  heroCards?: CardSpec[];
  heroSuited?: boolean;
  size?: number;
  blinds?: { sb: number; bb: number; ante?: number };
  straddle?: 'utg' | 'btn';
  /** implicit: an amount said before any action, with no «stack» word: kept only if it's stack-sized. */
  stacks: { actor: Actor | 'all'; amt: Amount; implicit?: boolean }[];
}

/** Atoms into events: who did what, in the order it was said. */
function toEvents(atoms: Atom[]): { setup: Setup; events: Event[] } {
  const setup: Setup = { stacks: [] };
  const events: Event[] = [];
  const used = new Set<number>();
  let boardSeen = false;
  const isActor = (a: Atom): a is Extract<Atom, { t: 'actor' }> => a.t === 'actor';
  for (let k = 0; k < atoms.length; k++) {
    const a = atoms[k];
    if (a.t === 'size') setup.size = a.n;
    else if (a.t === 'straddle') setup.straddle = a.from;
    else if (a.t === 'blinds') setup.blinds = { sb: a.sb, bb: a.bb, ...setup.blinds?.ante !== undefined ? { ante: setup.blinds.ante } : {} };
    else if (a.t === 'ante') {
      const nx = atoms[k + 1];
      if (nx?.t === 'amount' && nx.amt.unit === 'chips') {
        used.add(k + 1);
        setup.blinds = { ...(setup.blinds ?? { sb: 0, bb: 0 }), ante: nx.amt.v };
      }
    } else if (a.t === 'heroMark' || (a.t === 'actor' && a.a.k === 'hero')) {
      // "estou no botão", "eu no BTN", "hero BB"
      const nx = atoms[k + 1];
      if (nx?.t === 'actor' && nx.a.k === 'pos' && !setup.heroPos) {
        setup.heroPos = nx.a.label;
        used.add(k + 1);
        if (a.t === 'actor') used.add(k);
      }
    } else if (a.t === 'street') {
      boardSeen = true;
      const nx = atoms[k + 1];
      const cards = nx?.t === 'cards' ? nx.cards : [];
      if (nx?.t === 'cards') used.add(k + 1);
      events.push({ kind: 'street', s: a.s, cards, texture: nx?.t === 'cards' ? nx.texture : undefined });
    } else if (a.t === 'cards' && !used.has(k)) {
      // Whose cards: after "mostra"/"tinha" an opponent's (or the named seat's);
      // otherwise hero's, the first time, before the board.
      const prev = atoms.slice(Math.max(0, k - 3), k).reverse();
      const show = prev.find((p) => p.t === 'show');
      const owner = prev.find((p) => p.t === 'actor' && !used.has(atoms.indexOf(p))) as Extract<Atom, { t: 'actor' }> | undefined;
      const have = prev.find((p) => p.t === 'have' || p.t === 'heroMark');
      // "ele paga com QQ", "eu pago com ás rei": the cards of whoever just acted.
      const justActed = prev.find((p) => p.t !== 'amount' && p.t !== 'break');
      const lastAct = [...events].reverse().find((e) => e.kind === 'act') as Ev | undefined;
      if (justActed?.t === 'verb' && lastAct && !show) {
        const heroActs = lastAct.actor?.k === 'hero' || (!lastAct.actor && lastAct.person === 1);
        if (heroActs) {
          if (!setup.heroCards) {
            setup.heroCards = a.cards.slice(0, 2);
            setup.heroSuited = a.suited;
          }
        } else events.push({ kind: 'show', actor: lastAct.actor ?? { k: 'villain' }, cards: a.cards, suited: a.suited });
        continue;
      }
      if (show || (boardSeen && owner && owner.a.k !== 'hero')) {
        events.push({ kind: 'show', actor: owner && owner.a.k !== 'hero' ? owner.a : owner ? { k: 'hero' } : null, cards: a.cards, suited: a.suited });
        if (owner) used.add(atoms.indexOf(owner));
      } else if (!setup.heroCards && (have || !owner || owner.a.k === 'hero' || (owner.a.k === 'pos' && !events.some((e) => e.kind === 'act')))) {
        setup.heroCards = a.cards.slice(0, 2);
        setup.heroSuited = a.suited;
        // "Botão, ás rei": a position right before hero's cards, before any action, is hero's.
        if (owner && owner.a.k === 'pos' && !setup.heroPos && !have) {
          setup.heroPos = owner.a.label;
          used.add(atoms.indexOf(owner));
        }
        // "Ás rei no botão, o UTG abre": right after them, when that seat isn't the one acting.
        const nx = atoms[k + 1];
        if (!setup.heroPos && nx && isActor(nx) && nx.a.k === 'pos' && !used.has(k + 1) && atoms[k + 2]?.t !== 'verb' && !events.some((e) => e.kind === 'act')) {
          setup.heroPos = nx.a.label;
          used.add(k + 1);
        }
      } else if (owner && owner.a.k !== 'hero') {
        events.push({ kind: 'show', actor: owner.a, cards: a.cards, suited: a.suited });
        used.add(atoms.indexOf(owner));
      }
    } else if (a.t === 'stack') {
      // "tenho 30 mil", "UTG com 15k de stack", "40 bb efetivos"
      let amtAt = -1;
      for (let j = k + 1; j < Math.min(atoms.length, k + 3); j++) if (atoms[j].t === 'amount' && !used.has(j)) { amtAt = j; break; }
      if (amtAt < 0) for (let j = k - 1; j >= Math.max(0, k - 2); j--) if (atoms[j].t === 'amount' && !used.has(j)) { amtAt = j; break; }
      if (amtAt < 0) continue;
      used.add(amtAt);
      let who: Actor | 'all' | null = a.effective ? 'all' : null;
      if (!who) {
        for (let j = Math.min(amtAt, k) - 1; j >= Math.max(0, Math.min(amtAt, k) - 3); j--) {
          const p = atoms[j];
          if (p.t === 'heroMark' || p.t === 'have') { who = { k: 'hero' }; break; }
          if (isActor(p)) { who = p.a; break; }
          if (p.t === 'verb' || p.t === 'street') break;
        }
      }
      setup.stacks.push({ actor: who ?? { k: 'hero' }, amt: (atoms[amtAt] as Extract<Atom, { t: 'amount' }>).amt });
    } else if (a.t === 'verb' && atoms[k - 1]?.t === 'everyone') {
      events.push({ kind: 'act', actor: null, person: 0, verb: a.v.kind, every: true });
    } else if (a.t === 'verb' && a.v.plural) {
      // Every seat named right before (or right after) the verb does the same.
      const seats: Actor[] = [];
      for (let j = k - 1; j >= 0; j--) {
        const p = atoms[j];
        if (isActor(p) && !used.has(j)) {
          seats.unshift(p.a);
          used.add(j);
        } else if (p.t !== 'break') break;
      }
      if (!seats.length)
        for (let j = k + 1; j < atoms.length; j++) {
          const p = atoms[j];
          // "limpam o UTG e o cutoff, eu completo": "eu" is the next verb's.
          if (isActor(p) && !used.has(j) && atoms[j + 1]?.t !== 'verb') {
            seats.push(p.a);
            used.add(j);
          } else if (p.t !== 'break') break;
        }
      const order = boardSeen ? ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN'] : ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
      const rank = (x: Actor) => order.indexOf(x.k === 'pos' ? x.label : x.k === 'hero' ? (setup.heroPos ?? 'BTN') : 'BTN');
      seats.sort((x, y) => rank(x) - rank(y));
      if (!seats.length) events.push({ kind: 'act', actor: null, person: 0, verb: a.v.kind });
      for (const x of seats) events.push({ kind: 'act', actor: x, person: 3, verb: a.v.kind });
    } else if (a.t === 'verb') {
      // Who: the latest unused actor since the last verb; else, for "paga o BB", the seat right after.
      let actor: Actor | null = null;
      for (let j = k - 1; j >= 0; j--) {
        const p = atoms[j];
        if (p.t === 'verb' || p.t === 'street' || p.t === 'win' || p.t === 'show') break;
        if (isActor(p) && !used.has(j)) {
          actor = p.a;
          used.add(j);
          break;
        }
        // "I'm on the button with AQ and open", "hero is in the CO and opens": hero still speaking.
        if (p.t === 'heroMark' || p.t === 'have' || (isActor(p) && p.a.k === 'hero')) {
          actor = { k: 'hero' };
          break;
        }
      }
      let amt: Amount | undefined;
      let j = k + 1;
      for (; j < atoms.length && j <= k + 3; j++) {
        const p = atoms[j];
        if (p.t === 'amount' && !used.has(j)) {
          amt = p.amt;
          used.add(j);
          break;
        }
        if (p.t !== 'break' && p.t !== 'actor') break;
      }
      if (a.v.kind === 'passto') {
        const nx = atoms[k + 1];
        actor = nx && isActor(nx) ? nx.a : { k: 'hero' };
        if (nx && isActor(nx)) used.add(k + 1);
      } else if (!actor && a.v.person !== 1) {
        const nx = atoms[k + 1];
        if (nx && isActor(nx) && nx.a.k !== 'hero' && !used.has(k + 1) && !(atoms[k + 2]?.t === 'verb')) {
          actor = nx.a;
          used.add(k + 1);
        }
      } else if (a.v.person === 1 || actor?.k === 'hero') {
        // "abro do botão": hero's own position after the verb.
        const nx = atoms[k + 1];
        if (nx && isActor(nx) && nx.a.k === 'pos' && !setup.heroPos && !(atoms[k + 2]?.t === 'verb')) {
          setup.heroPos = nx.a.label;
          used.add(k + 1);
        }
      }
      const only = atoms.slice(Math.max(0, k - 3), k).some((p) => p.t === 'only') && a.v.kind === 'call';
      const every = atoms[k - 1]?.t === 'everyone';
      events.push({ kind: 'act', actor: every ? null : actor, person: every ? 0 : a.v.person, verb: a.v.kind, open: a.v.open, amt, ...(only ? { only } : {}), ...(every ? { every } : {}), ...(a.v.cbet ? { cbet: true } : {}) });
    } else if (a.t === 'win') {
      let actor: Actor | null = null;
      const p = atoms[k - 1];
      if (p && isActor(p) && !used.has(k - 1)) {
        actor = p.a;
        used.add(k - 1);
      } else if (atoms[k + 1] && isActor(atoms[k + 1]) && !used.has(k + 1)) {
        actor = (atoms[k + 1] as Extract<Atom, { t: 'actor' }>).a;
        used.add(k + 1);
      }
      const who = actor?.k === 'hero' ? 'hero' : actor ? 'other' : a.who;
      events.push({ kind: 'win', who, actor });
    }
  }
  // "Com A K, 15 bb", "tô no botão com 40k": an amount before the first action is a stack.
  const firstVerb = atoms.findIndex((a) => a.t === 'verb');
  for (let k = 0; k < (firstVerb < 0 ? atoms.length : firstVerb); k++) {
    const a = atoms[k];
    if (a.t !== 'amount' || used.has(k) || a.amt.unit === 'pot' || a.amt.unit === 'x' || a.amt.by) continue;
    let who: Actor = { k: 'hero' };
    for (let j = k - 1; j >= Math.max(0, k - 3); j--) {
      const p = atoms[j];
      if (p.t === 'break' || p.t === 'cards') continue;
      if (isActor(p) && p.a.k === 'pos' && !used.has(j) && p.a.label !== setup.heroPos) who = p.a;
      break;
    }
    setup.stacks.push({ actor: who, amt: a.amt, implicit: true });
  }
  return { setup, events };
}

/** The suit for each card nobody named: hole cards as said (suited or not), boards rainbow unless told otherwise, no flush the player didn't mention. */
class Deck {
  used = new Set<CardCode>();
  guessed: CardCode[] = [];
  take(c: CardCode) {
    this.used.add(c);
  }
  free(r: Rank, prefer: Suit[]): CardCode | null {
    const order = [...prefer, ...(['s', 'h', 'd', 'c'] as Suit[]).filter((s) => !prefer.includes(s))];
    for (const s of order) if (!this.used.has(r + s)) return r + s;
    return null;
  }
  /** Named cards first (so a guess never takes a card that was said), then the rest. */
  resolve(specs: CardSpec[], prefer: (k: number, chosen: CardCode[]) => Suit[]): CardCode[] {
    const out: (CardCode | null)[] = specs.map((c) => {
      if (!c.s) return null;
      const code = c.r + c.s;
      if (this.used.has(code)) return null;
      this.take(code);
      return code;
    });
    specs.forEach((c, k) => {
      if (out[k]) return;
      const code = this.free(c.r, prefer(k, out.filter((x): x is CardCode => !!x)));
      if (code) {
        this.take(code);
        this.guessed.push(code);
      }
      out[k] = code;
    });
    return out.filter((x): x is CardCode => !!x);
  }
}

const ALL_SUITS: Suit[] = ['s', 'h', 'd', 'c'];

/** Suits the board has least of, avoiding hero's: a guessed card never makes a flush draw. */
function quietSuits(board: CardCode[], hero: CardCode[]): Suit[] {
  const count = (s: Suit) => board.filter((c) => c[1] === s).length * 2 + hero.filter((c) => c[1] === s).length;
  return [...ALL_SUITS].sort((a, b) => count(a) - count(b));
}

export function handFromSpeech(text: string, base: Hand): VoiceResult {
  const atoms = atomise(text);
  const { setup, events } = toEvents(atoms);
  // Cards already picked on the entry screen stay, unless the player says others.
  const picked = base.players[base.hero].cards;
  const saidCards = !!setup.heroCards?.length;
  if (!setup.heroCards?.length && picked?.length === 2) setup.heroCards = picked.map((c) => ({ r: c[0] as Rank, s: c[1] as Suit }));
  const notes: VoiceNote[] = [];
  const note = (n: VoiceNote) => {
    if (!notes.some((x) => x.code === n.code && x.street === n.street && x.pos === n.pos)) notes.push(n);
  };
  const deck = new Deck();

  let hand: Hand = { ...base, actions: [], board: [], winners: undefined, board2: undefined, winners2: undefined, players: base.players.map((p) => ({ ...p, cards: undefined })) };
  if (setup.size && setup.size !== hand.players.length) hand = resizeTable(hand, setup.size);
  if (setup.blinds && setup.blinds.bb > 0 && setup.blinds.sb > 0) {
    const g = { ...hand.game, sb: setup.blinds.sb, bb: setup.blinds.bb };
    if (setup.blinds.ante !== undefined) {
      g.ante = setup.blinds.ante;
      if (g.anteType === 'none') g.anteType = 'bb';
    } else if (hand.game.ante && hand.game.bb) g.ante = Math.round((hand.game.ante * g.bb) / hand.game.bb);
    hand = rescaleStacks(hand, g);
  } else if (setup.blinds?.ante !== undefined) {
    hand = { ...hand, game: { ...hand.game, ante: setup.blinds.ante, anteType: hand.game.anteType === 'none' ? 'bb' : hand.game.anteType } };
  }
  if (setup.straddle && !hand.game.straddles) hand = { ...hand, game: { ...hand.game, straddles: 1, straddleFrom: setup.straddle } };
  const n = hand.players.length;
  const posKnown = !!setup.heroPos;
  if (setup.heroPos) {
    // An alias the table doesn't have (MP at 6-max) still lands on the nearest seat.
    for (const l of POS_ALIAS[setup.heroPos] ?? [setup.heroPos]) {
      const b = buttonForHeroPosition(n, hand.hero, l);
      if (positions(n, b)[hand.hero] === l) {
        hand = { ...hand, button: b };
        break;
      }
    }
  }
  const bb = hand.game.bb;

  // Stacks as said; a seat whose stack was said is never stretched to fit a bet.
  const stated = new Set<number>();
  const resolveActorStatic = (a: Actor): number | null => {
    if (a.k === 'hero') return hand.hero;
    if (a.k !== 'pos') return null;
    if (a.label === 'STRADDLE') return straddleSeats(hand)[0]?.[0] ?? seatOf(hand.game.straddleFrom === 'btn' ? 'BTN' : 'UTG', n, hand.button);
    return seatOf(a.label, n, hand.button);
  };
  // "Abre para 3" in a 200/400 game is 3 big blinds; "abre para 200" stays 200 chips.
  const chipsOf = (amt: Amount) => (amt.unit === 'bb' || (amt.unit === 'chips' && amt.v < bb && amt.v <= 25 && bb > 1) ? amt.v * bb : amt.v);
  for (const st of setup.stacks) {
    if (st.amt.unit === 'pot' || st.amt.unit === 'x') continue;
    const v = Math.round(chipsOf(st.amt));
    if (v <= 0) continue;
    // "Torneio de 50", "nível 12": too small to be a stack.
    if (st.implicit && v < 5 * bb) continue;
    if (st.actor === 'all') {
      hand = { ...hand, players: hand.players.map((p) => ({ ...p, stack: v })) };
      hand.players.forEach((_, i) => stated.add(i));
      continue;
    }
    const i = st.actor.k === 'villain' ? null : resolveActorStatic(st.actor);
    if (i === null) continue;
    hand = { ...hand, players: hand.players.map((p, k) => (k === i ? { ...p, stack: v } : p)) };
    stated.add(i);
  }

  // Any card named anywhere is taken before any guess; each takes its own back when its turn comes.
  const reserved = new Set<CardCode>();
  for (const e of events) {
    const specs = e.kind === 'street' || e.kind === 'show' ? e.cards : [];
    for (const c of specs) if (c.s) reserved.add(c.r + c.s);
  }
  for (const c of setup.heroCards ?? []) if (c.s) reserved.add(c.r + c.s);
  reserved.forEach((c) => deck.used.add(c));
  const resolveNamed = (specs: CardSpec[], prefer: (k: number, chosen: CardCode[]) => Suit[]) => {
    for (const c of specs) if (c.s && reserved.has(c.r + c.s)) {
      deck.used.delete(c.r + c.s);
      reserved.delete(c.r + c.s);
    }
    return deck.resolve(specs, prefer);
  };
  // Hero's cards: named suits, or suited/offsuit as said.
  let heroCards: CardCode[] = [];
  if (setup.heroCards?.length) {
    let specs = setup.heroCards;
    // "Ás rei de copas": one suit at the end of two cards is both cards' suit.
    if (specs.length === 2 && !specs[0].s && specs[1].s && setup.heroSuited === undefined && specs[0].r !== specs[1].r) {
      specs = [{ ...specs[0], s: specs[1].s }, specs[1]];
    }
    const suited = setup.heroSuited === true && specs.length === 2 && specs[0].r !== specs[1].r;
    heroCards = resolveNamed(specs, (k, chosen) => {
      if (suited) return chosen.length ? [chosen[0][1] as Suit] : ['h'];
      return ALL_SUITS.filter((s) => !chosen.some((c) => c[1] === s));
    });
    if (suited && heroCards.length === 2 && heroCards[0][1] !== heroCards[1][1]) {
      // One suit was said, the other "suited": follow the one said.
      const s = (specs[0].s ?? specs[1].s) as Suit | undefined;
      if (s) {
        deck.used.delete(heroCards[0]);
        deck.used.delete(heroCards[1]);
        const a = specs[0].r + s;
        const b = specs[1].r + s;
        if (!deck.used.has(a) && !deck.used.has(b)) heroCards = [a, b];
        deck.take(heroCards[0]);
        deck.take(heroCards[1]);
      }
    }
    // One card understood is as good as none: the player picks both (and the one heard goes back).
    if (heroCards.length === 1) {
      deck.used.delete(heroCards[0]);
      deck.guessed = deck.guessed.filter((c) => c !== heroCards[0]);
      heroCards = [];
    }
    if (heroCards.length) hand = { ...hand, players: hand.players.map((p, i) => (i === hand.hero ? { ...p, cards: heroCards } : p)) };
  }

  // Seats mentioned later on the same street (and hero, if hero acts later): they stay in when a street closes by itself.
  const futureSeats = (from: number): Set<number> => {
    const out = new Set<number>();
    for (let k = from; k < events.length; k++) {
      const e = events[k];
      if (e.kind === 'act' || e.kind === 'show' || e.kind === 'win') {
        const a = e.actor;
        if (a) {
          const i = resolveActorStatic(a);
          if (i !== null) out.add(i);
          else if (a.k === 'villain' && lastVillain !== null) out.add(lastVillain);
        } else if (e.kind === 'act' && e.person === 1) out.add(hand.hero);
        else if (e.kind === 'act' && e.person === 3 && lastVillain !== null) out.add(lastVillain);
      }
    }
    return out;
  };

  let s: TableState = replay(hand).final;
  let lastVillain: number | null = null;
  let stopped = false;
  let any = saidCards || !!setup.heroPos;
  let preflopRaiser: number | null = null;
  const push = (a: HandAction): boolean => {
    const next = apply(s, a, hand);
    if (!next) return false;
    if (s.street === 'preflop' && (a.kind === 'raise' || a.kind === 'bet')) preflopRaiser = a.p;
    hand = { ...hand, actions: [...hand.actions, a] };
    s = replay(hand).final;
    return true;
  };
  const involved = (i: number) => hand.actions.some((a) => a.p === i && a.kind !== 'fold' && a.kind !== 'check');

  /** Everyone between the player to act and `target` checks or folds, as the action passes them. */
  const passTo = (target: number, future: Set<number>): boolean => {
    for (let guard = 0; guard < 24 && s.toAct !== null && s.toAct !== target; guard++) {
      const p = s.toAct;
      const l = legal(s)!;
      const street = s.street;
      // Hero acts later in the story: hero stays in, passively.
      const keep = p === hand.hero && future.has(hand.hero) && !s.folded[hand.hero];
      const a: HandAction = l.canCheck ? { p, kind: 'check' } : keep ? { p, kind: 'call' } : { p, kind: 'fold' };
      if (!push(a)) return false;
      if (s.street !== street || s.needsBoard) return s.toAct === target;
    }
    return s.toAct === target;
  };

  /** A street mentioned while its betting is still open: whoever comes back later calls, the rest fold (or check). */
  const closeStreet = (future: Set<number>) => {
    const street = s.street;
    for (let guard = 0; guard < 24 && s.toAct !== null && s.street === street && !s.needsBoard; guard++) {
      const p = s.toAct;
      const l = legal(s)!;
      let kind: ActionKind;
      if (l.canCheck) kind = 'check';
      else {
        // Calls: whoever comes back later in the story, the last one left with hero, or the one who
        // put money in when nobody else who did is still there.
        const others = hand.players.map((_, i) => i).filter((i) => i !== p && !s.folded[i]);
        const keepers = others.filter((i) => i !== hand.hero && (future.has(i) || involved(i)));
        kind = future.has(p) || others.length < 2 || (involved(p) && !keepers.length) ? 'call' : 'fold';
      }
      if (!push({ p, kind })) break;
    }
  };

  /** Hero, still in and yet to act on this street, comes before `target`. */
  const wouldPassHero = (target: number): boolean => {
    if (s.toAct === null || s.folded[hand.hero] || s.allIn[hand.hero]) return false;
    for (let d = 0, i = s.toAct; d < n; d++, i = (i + 1) % n) {
      if (i === target) return false;
      if (i === hand.hero) return !s.acted[hand.hero] || s.bets[hand.hero] < s.currentBet;
    }
    return false;
  };

  const bySize = (e: Ev, l: NonNullable<ReturnType<typeof legal>>, p: number): number | null => {
    const amt = e.amt;
    const pot = totalPot(s);
    if (!amt) {
      if (e.verb === 'allin') return l.maxTo;
      // The usual size: open 2.5x (3x in cash), 3-bet 3x, a bet half the pot.
      note({ code: 'size', street: s.street, pos: positions(n, hand.button)[p] });
      if (s.currentBet === 0) return s.street === 'preflop' ? bb * (hand.game.kind === 'cash' ? 3 : 2.5) : Math.round(pot / 2);
      if (s.street === 'preflop' && s.currentBet <= bb) {
        const limpers = s.bets.filter((b, i) => b === bb && !s.folded[i]).length - 1;
        return bb * (hand.game.kind === 'cash' ? 3 : 2.5) + Math.max(0, limpers) * bb;
      }
      return Math.round(s.currentBet * 3);
    }
    let to: number;
    if (amt.unit === 'pot') {
      // A bet of x pot; a raise of x pot after calling.
      const toCall = s.currentBet - s.bets[p];
      to = s.currentBet === 0 ? amt.v * pot : s.currentBet + amt.v * (pot + toCall);
    } else if (amt.unit === 'x') to = amt.v * (s.currentBet || bb);
    else to = chipsOf(amt);
    if (amt.by) to += s.currentBet;
    // "Sobe 1500" over a 2000 bet: 1500 more.
    if (s.currentBet > 0 && to <= s.currentBet && e.verb !== 'call') to += s.currentBet;
    return Math.round(to * 100) / 100;
  };

  for (let k = 0; k < events.length && !stopped; k++) {
    const e = events[k];
    if (e.kind === 'street') {
      any = true;
      const order: Street[] = ['preflop', 'flop', 'turn', 'river'];
      const want = order.indexOf(e.s);
      if (want <= order.indexOf(s.street) && !s.needsBoard) continue;
      // Not enough cards said for this street: the hand stops before it, as it was.
      const short = (e.s === 'flop' ? 3 : e.s === 'turn' ? 4 : 5) - hand.board.length;
      if (short > 0 && e.cards.length < short) {
        note({ code: 'boardMissing', street: e.s });
        stopped = true;
        break;
      }
      const future = futureSeats(k + 1);
      // The streets before this one close as they would have.
      for (let guard = 0; guard < 4 && !s.needsBoard && s.toAct !== null; guard++) {
        closeStreet(future);
        if (s.needsBoard || s.toAct === null) break;
      }
      if (!s.needsBoard && !s.bettingDone) {
        stopped = s.foldWin;
        continue;
      }
      // Cards for this street (and any streets skipped on the way, if enough were said).
      const need = (e.s === 'flop' ? 3 : e.s === 'turn' ? 4 : 5) - hand.board.length;
      if (need <= 0) continue;
      if (e.cards.length < need) {
        note({ code: 'boardMissing', street: e.s });
        stopped = true;
        break;
      }
      const prevBoard = hand.board;
      const cards = resolveNamed(e.cards.slice(0, need), (kk, chosen) => {
        const board = [...prevBoard, ...chosen];
        const tex = e.texture;
        if (tex && tex.n > 1) {
          // Two (or three) of one suit: the named suit, or the one already showing, or hero's.
          const seen = board.map((c) => c[1] as Suit);
          const suit = tex.suit ?? ALL_SUITS.find((x) => seen.filter((y) => y === x).length >= 1) ?? (heroCards[0]?.[1] as Suit | undefined) ?? 's';
          if (seen.filter((x) => x === suit).length < tex.n) return [suit, ...quietSuits(board, heroCards).filter((x) => x !== suit)];
          return quietSuits(board, heroCards).filter((x) => x !== suit).concat(suit);
        }
        return quietSuits(board, heroCards);
      });
      if (cards.length < need) {
        note({ code: 'boardMissing', street: e.s });
        stopped = true;
        break;
      }
      if (cards.some((c) => deck.guessed.includes(c))) note({ code: 'suits', street: e.s });
      hand = { ...hand, board: [...hand.board, ...cards] };
      s = replay(hand).final;
      continue;
    }
    if (e.kind === 'show') {
      const i: number | null = e.actor ? (e.actor.k === 'villain' ? lastVillain : resolveActorStatic(e.actor)) : lastVillain;
      const seat: number = i ?? hand.players.findIndex((_, x) => x !== hand.hero && !s.folded[x]);
      if (seat < 0 || seat === hand.hero) continue;
      const suited = e.suited === true && e.cards.length === 2 && e.cards[0].r !== e.cards[1].r;
      const cards = resolveNamed(e.cards.slice(0, 2), (kk, chosen) =>
        suited && chosen.length ? [chosen[0][1] as Suit] : quietSuits(hand.board, [...heroCards, ...chosen]),
      );
      if (cards.some((c) => deck.guessed.includes(c))) note({ code: 'suits', pos: positions(n, hand.button)[seat] });
      hand = { ...hand, players: hand.players.map((p, x) => (x === seat ? { ...p, cards } : p)) };
      lastVillain = seat;
      any = true;
      continue;
    }
    if (e.kind === 'win') {
      any = true;
      const live = hand.players.map((_, i) => i).filter((i) => !s.folded[i]);
      if (e.who === 'split') hand = { ...hand, winners: live };
      else if (e.who === 'hero') hand = { ...hand, winners: [hand.hero] };
      else {
        const i = e.actor ? (e.actor.k === 'villain' ? lastVillain : resolveActorStatic(e.actor)) : lastVillain;
        const seat = i ?? live.find((x) => x !== hand.hero) ?? null;
        if (seat !== null) hand = { ...hand, winners: [seat] };
      }
      continue;
    }
    // An action.
    any = true;
    if (s.needsBoard) {
      // The street closed before this action: left out when the street's cards come later, else the hand waits for them.
      if (events.slice(k + 1).some((x) => x.kind === 'street' && x.s === s.street)) {
        // "Paso, él pasa" told hero first: the street already checked through, nothing was lost.
        const last = hand.actions[hand.actions.length - 1];
        if (!(e.verb === 'check' && last?.kind === 'check')) note({ code: 'skipped', street: s.street });
        continue;
      }
      note({ code: 'boardMissing', street: s.street });
      stopped = true;
      break;
    }
    if (s.toAct === null) {
      note({ code: 'skipped', street: s.street });
      continue;
    }
    if (e.every && (e.verb === 'call' || e.verb === 'fold' || e.verb === 'check')) {
      const street = s.street;
      for (let guard = 0; guard < 24 && s.toAct !== null && s.street === street && !s.needsBoard; guard++) {
        const p = s.toAct;
        if (p === hand.hero && futureSeats(k + 1).has(p)) break;
        const l = legal(s)!;
        const kind: ActionKind = l.canCheck ? 'check' : e.verb === 'call' ? 'call' : 'fold';
        if (!push({ p, kind })) break;
      }
      continue;
    }
    if (e.verb === 'foldall') {
      // "Todos fold": everyone left on this street folds (or checks, if they can).
      const street = s.street;
      for (let guard = 0; guard < 24 && s.toAct !== null && s.street === street && !s.needsBoard; guard++) {
        const p = s.toAct;
        if (p === hand.hero && futureSeats(k + 1).has(p)) break;
        if (!push({ p, kind: legal(s)!.canCheck ? 'check' : 'fold' })) break;
      }
      continue;
    }
    if (e.verb === 'passto') {
      const t: number | null = e.actor ? (e.actor.k === 'villain' ? lastVillain : resolveActorStatic(e.actor)) : hand.hero;
      if (t !== null && s.toAct !== t) {
        const future = futureSeats(k + 1);
        future.add(t);
        passTo(t, future);
      }
      // "Fold até ao cutoff, ele abre": "ele" is that seat.
      if (t !== null && t !== hand.hero) lastVillain = t;
      continue;
    }
    let target: number | null = null;
    if (e.actor) {
      if (e.actor.k === 'villain') target = lastVillain;
      else target = resolveActorStatic(e.actor);
    } else if (e.person === 1) target = hand.hero;
    else if (e.person === 3) target = lastVillain;
    if (target === null || s.folded[target] || s.allIn[target]) {
      // Nobody named: the next player to act; "ele" with no one yet, the next opponent.
      if (e.person === 1) target = hand.hero;
      else if (s.toAct !== hand.hero || e.person === 0) target = s.toAct;
      else {
        const nextOpp = [...Array(n).keys()].map((d) => (s.toAct! + 1 + d) % n).find((x) => x !== hand.hero && !s.folded[x] && !s.allIn[x]);
        target = nextOpp ?? s.toAct;
      }
    }
    // "C-bet de 2000" with nobody named: the preflop raiser's.
    if (e.cbet && !e.actor && e.person === 0 && preflopRaiser !== null && !s.folded[preflopRaiser]) target = preflopRaiser;
    // "Passo, passo": check, check, the second one by whoever is to act.
    if (!e.actor && e.person === 1 && e.verb === 'check' && target === hand.hero && s.toAct !== null && s.toAct !== hand.hero && s.acted[hand.hero] && s.bets[hand.hero] === s.currentBet) target = s.toAct;
    if (target === null) continue;
    // "Passa, passa": no subject, and "him" already acted with nothing to answer. It's whoever is to act.
    if (!e.actor && e.person === 3 && s.toAct !== null && s.toAct !== target && s.acted[target] && s.bets[target] === s.currentBet) target = s.toAct;
    if (s.toAct !== target && target !== hand.hero && wouldPassHero(target)) {
      // "O small aposta, o botão paga, eu subo": told out of turn. Hero's own action on this street goes first.
      const j = events.findIndex((x, jj) => jj > k && (x.kind === 'street' || (x.kind === 'act' && (x.actor?.k === 'hero' || (!x.actor && x.person === 1)))));
      if (j > k && events[j].kind === 'act') {
        const [heroEv] = events.splice(j, 1);
        events.splice(k, 0, heroEv);
        k--;
        continue;
      }
    }
    if (s.toAct !== target) {
      const future = futureSeats(k);
      future.add(target);
      // The target already acted and nobody bet since: nothing for it to do here.
      if (!passTo(target, future)) {
        // "Paso, él pasa": told hero first, and passing to hero already checked for him.
        const mine = hand.actions.filter((x) => x.p === target);
        if (e.verb === 'check' && mine[mine.length - 1]?.kind === 'check' && !s.needsBoard) continue;
        if (s.needsBoard) {
          note({ code: 'boardMissing', street: s.street });
          stopped = true;
          break;
        }
        note({ code: 'skipped', street: s.street, pos: positions(n, hand.button)[target] });
        continue;
      }
    }
    if (target !== hand.hero) lastVillain = target;
    const l = legal(s)!;
    const p = target;
    let ok = true;
    if (e.verb === 'fold') ok = push({ p, kind: l.canCheck && false ? 'check' : 'fold' });
    else if (e.verb === 'check') ok = push({ p, kind: l.canCheck ? 'check' : 'fold' });
    else if (e.verb === 'call') {
      if (e.amt && l.canCall && !stated.has(p)) {
        // "Paga all-in 8000": a call for less, or the stack it had.
        const to = bySize(e, l, p);
        if (to !== null && to < s.currentBet && to > s.bets[p]) {
          const stack = hand.players[p].stack - s.stacks[p] + (to - s.bets[p]);
          hand = { ...hand, players: hand.players.map((x, i) => (i === p ? { ...x, stack } : x)) };
          s = replay(hand).final;
        }
      }
      ok = push({ p, kind: l.canCheck ? 'check' : 'call' });
      if (ok && e.only) {
        // "Só o botão paga, eu pago": the others fold, hero still comes.
        const street = s.street;
        const later = futureSeats(k + 1);
        for (let guard = 0; guard < 24 && s.toAct !== null && s.street === street && !s.needsBoard; guard++) {
          if (s.toAct === hand.hero && later.has(hand.hero)) break;
          if (!push({ p: s.toAct, kind: legal(s)!.canCheck ? 'check' : 'fold' })) break;
        }
      }
    } else {
      let to = bySize(e, l, p);
      if (to === null) continue;
      if (e.verb === 'allin' && !e.amt) to = l.maxTo;
      if (e.verb === 'allin' && e.amt && to > l.maxTo && stated.has(p)) to = l.maxTo;
      // A size bigger than the stack the app assumed: the stack was bigger (or it's all-in, if the stack was said).
      if (to > l.maxTo) {
        if (stated.has(p)) to = l.maxTo;
        else {
          const extra = to - l.maxTo;
          hand = { ...hand, players: hand.players.map((x, i) => (i === p ? { ...x, stack: x.stack + extra } : x)) };
          s = replay(hand).final;
          note({ code: 'stackGrew', pos: positions(n, hand.button)[p] });
        }
      }
      // "vai all-in 18 mil": that was the whole stack.
      if (e.verb === 'allin' && e.amt && !stated.has(p) && to < legal(s)!.maxTo) {
        const lnow = legal(s)!;
        const stack = hand.players[p].stack - (lnow.maxTo - to);
        if (stack > 0) {
          hand = { ...hand, players: hand.players.map((x, i) => (i === p ? { ...x, stack } : x)) };
          s = replay(hand).final;
        }
      }
      const lnow = legal(s)!;
      if (to <= s.currentBet) {
        ok = push({ p, kind: lnow.canCheck ? 'check' : 'call' });
      } else {
        if (to < lnow.minTo) {
          to = lnow.minTo;
          note({ code: 'minRaise', street: s.street, pos: positions(n, hand.button)[p] });
        }
        to = Math.min(to, lnow.maxTo);
        const kind: ActionKind = s.currentBet === 0 ? 'bet' : 'raise';
        ok = push({ p, kind, to });
      }
    }
    if (!ok) note({ code: 'skipped', street: s.street, pos: positions(n, hand.button)[p] });
  }

  // Winners only matter when the cards can't decide: drop them when every hand at showdown is known.
  if (hand.winners) {
    const r = replay(hand);
    const live = hand.players.map((_, i) => i).filter((i) => !r.final.folded[i]);
    const known = live.every((i) => (hand.players[i].cards?.length ?? 0) === 2) && hand.board.length === 5;
    if (known || r.final.foldWin || !r.result) hand = { ...hand, winners: undefined };
  }

  if (!posKnown && any) note({ code: 'noPosition' });
  if (!heroCards.length && any) note({ code: 'noCards' });
  if (deck.guessed.some((c) => heroCards.includes(c))) notes.unshift({ code: 'suits', street: 'preflop' });

  return { hand, posKnown, notes: dedupe(notes), guessed: deck.guessed, empty: !any && !events.length };
}

function dedupe(notes: VoiceNote[]): VoiceNote[] {
  const out: VoiceNote[] = [];
  for (const x of notes) if (!out.some((y) => y.code === x.code && y.street === x.street && y.pos === x.pos)) out.push(x);
  return out;
}
