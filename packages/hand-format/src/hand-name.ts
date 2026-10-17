// The made hand as players say it at the table: "Par de Ases", "Dois pares, Reis e 7",
// "Full: Damas e 4". Shared by the app, the /h page and the export, in the four app languages.

export type HandNameLocale = "pt" | "pt-BR" | "es" | "en";

/** Ranks of a score: category * 15^5 plus up to five ranks in base 15, both evaluators pack it this way. */
export function scoreRanks(score: number): {
  category: number;
  ranks: number[];
} {
  const ranks: number[] = [];
  let s = score;
  for (let i = 0; i < 5; i++) {
    ranks.unshift(s % 15);
    s = Math.floor(s / 15);
  }
  return { category: s, ranks };
}

// Face cards in words, the rest as the number on the card: short enough for a seat badge.
type Face = { one: string; many: string; fem?: boolean };
const FACES: Record<"pt" | "es" | "en", Record<number, Face>> = {
  pt: {
    14: { one: "Ás", many: "Ases" },
    13: { one: "Rei", many: "Reis" },
    12: { one: "Dama", many: "Damas", fem: true },
    11: { one: "Valete", many: "Valetes" },
  },
  es: {
    14: { one: "As", many: "Ases" },
    13: { one: "Rey", many: "Reyes" },
    12: { one: "Reina", many: "Reinas", fem: true },
    11: { one: "Jota", many: "Jotas", fem: true },
  },
  en: {
    14: { one: "Ace", many: "Aces" },
    13: { one: "King", many: "Kings" },
    12: { one: "Queen", many: "Queens" },
    11: { one: "Jack", many: "Jacks" },
  },
};

type Namer = (ranks: number[]) => string;

function words(l: HandNameLocale) {
  const faces = FACES[l === "pt-BR" ? "pt" : l];
  const one = (r: number) => faces[r]?.one ?? String(r);
  const many = (r: number) =>
    faces[r]?.many ?? (l === "en" ? `${r}s` : String(r));
  const fem = (r: number) => !!faces[r]?.fem;
  return { one, many, fem };
}

function namers(l: HandNameLocale): Namer[] {
  const { one, many, fem } = words(l);
  if (l === "en")
    return [
      ([r]) => `${one(r)} high`,
      ([r]) => `Pair of ${many(r)}`,
      ([a, b]) => `Two pair, ${many(a)} and ${many(b)}`,
      ([r]) => `Three of a kind, ${many(r)}`,
      ([r]) => `Straight, ${one(r)} high`,
      () => "Flush",
      ([a, b]) => `Full house, ${many(a)} full of ${many(b)}`,
      ([r]) => `Four of a kind, ${many(r)}`,
      ([r]) => (r === 14 ? "Royal flush" : `Straight flush, ${one(r)} high`),
    ];
  if (l === "es") {
    const to = (r: number) => `${fem(r) ? "a la" : "al"} ${one(r)}`;
    return [
      ([r]) => `Carta alta: ${one(r)}`,
      ([r]) => `Pareja de ${many(r)}`,
      ([a, b]) => `Doble pareja, ${many(a)} y ${many(b)}`,
      ([r]) => `Trío de ${many(r)}`,
      ([r]) => `Escalera ${to(r)}`,
      () => "Color",
      ([a, b]) => `Full de ${many(a)} y ${many(b)}`,
      ([r]) => `Póker de ${many(r)}`,
      ([r]) => (r === 14 ? "Escalera real" : `Escalera de color ${to(r)}`),
    ];
  }
  if (l === "pt-BR") {
    const to = (r: number) => `até ${fem(r) ? "a" : "o"} ${one(r)}`;
    return [
      ([r]) => `Carta alta: ${one(r)}`,
      ([r]) => `Par de ${many(r)}`,
      ([a, b]) => `Dois pares, ${many(a)} e ${many(b)}`,
      ([r]) => `Trinca de ${many(r)}`,
      ([r]) => `Sequência ${to(r)}`,
      () => "Flush",
      ([a, b]) => `Full house: ${many(a)} e ${many(b)}`,
      ([r]) => `Quadra de ${many(r)}`,
      ([r]) => (r === 14 ? "Royal flush" : `Straight flush ${to(r)}`),
    ];
  }
  const to = (r: number) => `${fem(r) ? "à" : "ao"} ${one(r)}`;
  return [
    ([r]) => `Carta alta: ${one(r)}`,
    ([r]) => `Par de ${many(r)}`,
    ([a, b]) => `Dois pares, ${many(a)} e ${many(b)}`,
    ([r]) => `Trio de ${many(r)}`,
    ([r]) => `Sequência ${to(r)}`,
    () => "Cor",
    ([a, b]) => `Full: ${many(a)} e ${many(b)}`,
    ([r]) => `Poker de ${many(r)}`,
    ([r]) => (r === 14 ? "Royal flush" : `Sequência de cor ${to(r)}`),
  ];
}

const cache = new Map<HandNameLocale, Namer[]>();

/** "Par de Ases" from an evaluator score (see scoreRanks). Empty for a score below a made five-card hand. */
export function handName(score: number, locale: HandNameLocale = "pt"): string {
  if (score < 0) return "";
  const { category, ranks } = scoreRanks(score);
  let list = cache.get(locale);
  if (!list) cache.set(locale, (list = namers(locale)));
  return list[category]?.(ranks) ?? "";
}
