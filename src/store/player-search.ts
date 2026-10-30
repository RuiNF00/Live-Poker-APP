// Finding a player note fast, at the table: accents, case, spaces and word order don't matter,
// and a name that starts with what you typed comes first. Pure, so it can be tested.

import type { PlayerNote } from './types';

/** "João", " joao " and "JOÃO" are the same name. */
export function nameKey(s: string | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * The notes that match every word of `q`, in the name, the look, the notes or the tags
 * (stored in pt-PT, shown translated: `label` gives the shown one). Name matches first,
 * then the order they came in.
 */
export function findPlayers<P extends Pick<PlayerNote, 'name' | 'look' | 'notes' | 'tags'>>(list: readonly P[], q: string, label: (tag: string) => string = (x) => x): P[] {
  const words = nameKey(q).split(' ').filter(Boolean);
  if (!words.length) return [...list];
  const rank = (p: P) => {
    const name = nameKey(p.name);
    const hay = nameKey([p.name, p.look, p.notes, ...p.tags, ...p.tags.map(label)].join(' '));
    if (!words.every((w) => hay.includes(w))) return -1;
    if (name.startsWith(words.join(' '))) return 0;
    if (words.every((w) => name.split(' ').some((n) => n.startsWith(w)))) return 1;
    return 2;
  };
  return list
    .map((p, i) => ({ p, i, r: rank(p) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.p);
}

/** Another note with the same name, so a new one doesn't make a second «Boné azul». */
export function sameName<P extends Pick<PlayerNote, 'id' | 'name'>>(list: readonly P[], p: Pick<PlayerNote, 'id' | 'name'>): P | undefined {
  const k = nameKey(p.name);
  return k ? list.find((x) => x.id !== p.id && nameKey(x.name) === k) : undefined;
}
