// Lists, per language, the app strings with no translation: npm run i18n:missing
// The i18n tests run the same check, so CI fails when a new string is added in
// pt-PT without its English, Spanish and (when it reads differently in Brazil)
// Brazilian text.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

/** Every string passed to t() as a literal, with the first file that uses it. */
export function usedKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const file of sources(SRC)) {
    const code = readFileSync(file, 'utf8');
    for (const m of code.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
      const key = m[1].replace(/\\'/g, "'");
      if (!keys.has(key)) keys.set(key, file.slice(SRC.length + 1));
    }
  }
  return keys;
}

// Words and verb forms that only European Portuguese uses. A pt-PT string with
// any of them reads wrong in Brazil, so pt-BR.ts must have its own text for it.
const PT_PT_ONLY =
  /(?<!\p{L})(tu|teu|tua|teus|tuas|ti|contigo|ecrã|ecrãs|telemóve(l|is)|regist(ar|a|as|o|os|ad[ao]s?|ei|aste)|partilh\w*|ficheiros?|definições|utilizador\w*|palavra-passe|equipa|guard(ar|a|as|ei|aste)|descarreg\w*|câmara|secção|póquer|percentage(m|ns)|prémios?|facto|contactos?|estás|podes|queres|tens|vês|fazes|sabes|consegues|precisas|escolhe|toca|tenta|carrega|vais|jogaste|ganhaste|perdeste|percebes|ganhas|perdes|jogas|pára)(?!\p{L})/iu;
const PT_PT_PROGRESSIVE = /\ba \w+[aei]r…/i; // "A guardar…" is "Salvando…" in Brazil

export function needsBrazilianText(key: string): boolean {
  return PT_PT_ONLY.test(key) || PT_PT_PROGRESSIVE.test(key);
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

// Store policy (research/politicas-lojas-jogo.md): the app never bets, sells or
// invests, in any language. Poker's own "Bet" action is the one allowed use.
const BANNED: Record<string, RegExp> = {
  en: /\b(gambl\w*|wager\w*|invest(ing|ment)?)\b/i,
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
