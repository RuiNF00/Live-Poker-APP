// Lists, per language, the app strings with no translation: npm run i18n:missing
// The i18n tests run the same check, so CI fails when a new string is added in
// pt-PT without its English, Spanish and (when it reads differently in Brazil)
// Brazilian text.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

import en from '../src/i18n/en';
import es from '../src/i18n/es';
import ptBR from '../src/i18n/pt-BR';

const SRC = join(__dirname, '..', 'src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' || name === 'i18n' ? [] : sources(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

/**
 * Reads like Portuguese text to translate (an accented letter or a common word), not code, a path
 * or an English proper name: event names like "High Roller" stay as they are in every language.
 */
const PT_WORD = /(?<!\p{L})(de|da|do|das|dos|em|no|na|para|com|sem|um|uma|os|as|não|mais|por|que|ao|à|meu|meus|minhas?|teu|tua)(?!\p{L})/iu;
const looksLikeText = (s: string) =>
  /\p{L}/u.test(s) && (/[À-ÖØ-öø-ÿ]/.test(s) || (s.includes(' ') && PT_WORD.test(s))) && !/^(https?:|\/|\.|@|rl\.)/.test(s) && !/[{}=<>;]|=>/.test(s.replace(/\{\w+\}/g, ''));
/** Data modules whose Portuguese text is all t() keys, wherever it sits (pushed to a list, in a ternary). */
const KEY_FILES = new Set(['billing/onboarding.ts', 'billing/cancel.ts', 'billing/plans.ts', 'data/glossary.ts', 'data/whats-new.ts', 'lib/notify-policy.ts']);
/** Festival and event data: venue, city and event names are proper names, shown as the organiser writes them. */
const PROPER_NAMES = /^poker\/festivals/;

/**
 * Every string passed to t() as a literal, with the first file that uses it. Also the strings
 * that reach t() later from data: `t(x.label)`, `t(GLOSSARY[k].line)` and the like make every
 * literal held under that property name (`label: '…'`) a key too, so a list of choices can't
 * slip past without its translations.
 */
export function usedKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const add = (key: string, file: string) => !keys.has(key) && keys.set(key, file.slice(SRC.length + 1));
  const files = sources(SRC).map((file) => ({ file, src: ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true) }));
  const isT = (n: ts.CallExpression) => ts.isIdentifier(n.expression) && n.expression.text === 't' && n.arguments.length > 0;
  const literal = (n: ts.Node): string | null => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null);
  // Pass 1: literal keys, and the property names t() reads from data.
  const props = new Set<string>();
  for (const { file, src } of files) {
    const walk = (n: ts.Node) => {
      if (ts.isCallExpression(n) && isT(n)) {
        const a = n.arguments[0];
        const lit = literal(a);
        if (lit !== null) add(lit, file);
        else if (ts.isPropertyAccessExpression(a)) props.add(a.name.text);
      }
      ts.forEachChild(n, walk);
    };
    walk(src);
  }
  // Pass 2: text held under those property names, and all the text of the key modules.
  for (const { file, src } of files) {
    const rel = file.slice(SRC.length + 1);
    if (PROPER_NAMES.test(rel)) continue;
    const all = KEY_FILES.has(rel);
    const walk = (n: ts.Node) => {
      if (all && !ts.isImportDeclaration(n.parent ?? n)) {
        const lit = literal(n);
        if (lit !== null && looksLikeText(lit)) add(lit, file);
      }
      if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && props.has(n.name.text)) {
        const lit = literal(n.initializer);
        if (lit !== null && looksLikeText(lit)) add(lit, file);
      }
      ts.forEachChild(n, walk);
    };
    walk(src);
  }
  return keys;
}

// Words and verb forms that only European Portuguese uses. A pt-PT string with
// any of them reads wrong in Brazil, so pt-BR.ts must have its own text for it.
const PT_PT_ONLY =
  /(?<!\p{L})(tu|teu|tua|teus|tuas|ti|contigo|ecrã|ecrãs|telemóve(l|is)|regist(ar|a|as|o|os|ad[ao]s?|ei|aste)|partilh\w*|ficheiros?|definições|utilizador\w*|palavra-passe|equipa|guard(ar|a|as|ei|aste)|descarreg\w*|câmara|secção|póquer|percentage(m|ns)|prémios?|facto|contactos?|estás|podes|queres|tens|vês|fazes|sabes|consegues|precisas|escolhe|toca|tenta|carrega|vais|jogaste|ganhaste|perdeste|percebes|ganhas|perdes|jogas|pára|\w+aste|deves|registou|decorrer|cobr\w*|até ao|subscriç\w*|seleciona|(?:na|da|pela) app|saberes|abrires|voltares|pagares|quiseres|puderes|tiveres|fizeres|estiveres)(?!\p{L})/iu;
const PT_PT_PROGRESSIVE = /\ba \w+[aei]r…/i; // "A guardar…" is "Salvando…" in Brazil
// "deve-te", "paga-te": the pronoun after the verb is European; Brazil says "te deve".
const PT_PT_ENCLITIC = /(?<!\p{L})\p{L}+-(te|o|a|os|as|lhe|lhes)(?!\p{L})/iu;
const PT_PT_VERBS = /(?<!\p{L})(pagas|recebeste|desliga|liga|ligar|deixar de fora|rever|revista|guardad[ao]s?|fazias|os meus|as minhas|o meu|a minha)(?!\p{L})/iu;

export function needsBrazilianText(key: string): boolean {
  return PT_PT_ONLY.test(key) || PT_PT_PROGRESSIVE.test(key) || PT_PT_ENCLITIC.test(key) || PT_PT_VERBS.test(key);
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

// Store policy (research/politicas-lojas-jogo.md): the app never bets, sells or
// invests, in any language. Poker's own "Bet" action is the one allowed use.
const BANNED: Record<string, RegExp> = {
  en: /\b(gambl\w*|wager\w*|invest(ing|ment|ed|s)?)\b/i,
  'pt-BR': /\b(apost\w*|investi\w*|vender ação|venda de ação)\b/i,
  es: /\b(apuest\w*|apostar|invert\w*|inversión|vender acci[oó]n)\b/i,
};

export type Report = Record<'en' | 'es' | 'pt-BR', { missing: string[]; placeholders: string[]; banned: string[] }>;

export function check(): Report {
  const used = usedKeys();
  // en.ts also covers strings that reach t() through a variable.
  const all = new Set([...used.keys(), ...Object.keys(en)]);
  const tables = { en, es, 'pt-BR': ptBR } as const;
  const report = {} as Report;
  for (const [name, table] of Object.entries(tables) as [keyof Report, Record<string, string>][]) {
    // pt-BR falls back to the pt-PT text, so a key with a store-banned word needs its own pt-BR text too.
    const missing = [...all].filter((k) => !(k in table) && (name !== 'pt-BR' || needsBrazilianText(k) || BANNED['pt-BR'].test(k)));
    const bad = Object.entries(table).filter(([k, v]) => placeholders(k) !== placeholders(v)).map(([k]) => k);
    const banned = Object.entries(table).filter(([, v]) => BANNED[name].test(v)).map(([k, v]) => `${k} → ${v}`);
    report[name] = { missing: missing.map((k) => (used.has(k) ? `${used.get(k)}: ${k}` : k)), placeholders: bad, banned };
  }
  return report;
}

if (require.main === module) {
  let total = 0;
  for (const [name, r] of Object.entries(check())) {
    const n = r.missing.length + r.placeholders.length + r.banned.length;
    total += n;
    console.log(`\n${name}: ${r.missing.length} missing, ${r.placeholders.length} with wrong {placeholders}, ${r.banned.length} with banned words`);
    for (const k of r.missing) console.log(`  missing      ${k}`);
    for (const k of r.placeholders) console.log(`  placeholder  ${k}`);
    for (const k of r.banned) console.log(`  banned       ${k}`);
  }
  process.exitCode = total ? 1 : 0;
}
