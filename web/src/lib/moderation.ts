// Basic profanity filter for public comments (App Store guideline 1.2). Deliberately
// short: blocks the common slurs and insults in PT-PT, pt-BR, es and EN; reports catch the rest.
const BLOCKED = [
  // pt
  'caralho', 'foda-se', 'fodase', 'puta', 'putas', 'cabrão', 'cabrao', 'paneleiro', 'filho da puta', 'fdp', 'cona',
  'merdoso', 'otário', 'otario', 'atrasado mental', 'preto de merda', 'macaco',
  // pt-BR
  'viado', 'viadinho', 'arrombado', 'arrombada', 'cuzão', 'cuzao', 'buceta', 'vagabunda', 'vadia', 'retardado',
  'vai tomar no cu', 'vtnc', 'tnc', 'macaca',
  // es
  'hijo de puta', 'hijoputa', 'maricón', 'maricon', 'joto', 'pendejo', 'gilipollas', 'cabrón', 'culero',
  'chinga tu madre', 'concha de tu madre', 'retrasado mental', 'mongólico', 'sudaca', 'negro de mierda',
  // en
  'fuck', 'fucking', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'motherfucker',
];

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0@]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/\$/g, 's');

const PATTERNS = BLOCKED.map((w) => new RegExp(`(^|[^a-z])${strip(w).replace(/[-\s]/g, '[-\\s]*')}($|[^a-z])`));

export function isOffensive(text: string): boolean {
  const t = strip(text);
  return PATTERNS.some((re) => re.test(t));
}
