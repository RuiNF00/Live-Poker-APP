// Test helpers: an in-memory AsyncStorage that behaves like Android's (a value
// over 2 MB can't be read back, the database stops at 6 MB), and a generator
// of realistic hand histories.

import { sampleHand } from '@/poker/sample';
import type { Hand } from '@/poker/types';

import type { KV } from '../persist';

export const ANDROID_ROW_LIMIT = 2 * 1024 * 1024;

export class FakeStorage implements KV {
  data = new Map<string, string>();
  writes = 0;
  bytesWritten = 0;
  failWrites = false;
  constructor(private opts: { rowLimit?: number; dbLimit?: number } = {}) {}

  private size() {
    let n = 0;
    for (const [k, v] of this.data) n += k.length + v.length;
    return n;
  }
  async getItem(k: string) {
    const v = this.data.get(k) ?? null;
    if (v && this.opts.rowLimit && v.length > this.opts.rowLimit) throw new Error('Row too big to fit into CursorWindow');
    return v;
  }
  async setItem(k: string, v: string) {
    await this.multiSet([[k, v]]);
  }
  async multiGet(keys: readonly string[]) {
    return Promise.all(keys.map(async (k) => [k, await this.getItem(k)] as const));
  }
  async multiSet(pairs: [string, string][]) {
    if (this.failWrites) throw new Error('database or disk is full');
    const next = new Map(this.data);
    for (const [k, v] of pairs) next.set(k, v);
    if (this.opts.dbLimit) {
      let n = 0;
      for (const [k, v] of next) n += k.length + v.length;
      if (n > this.opts.dbLimit) throw new Error('database or disk is full');
    }
    this.data = next;
    this.writes++;
    for (const [, v] of pairs) this.bytesWritten += v.length;
  }
  async multiRemove(keys: readonly string[]) {
    for (const k of keys) this.data.delete(k);
  }
  async getAllKeys() {
    return [...this.data.keys()];
  }
  get totalBytes() {
    return this.size();
  }
}

const NAMES = ['Boné azul', 'Reg alemão', 'Miguel', 'Ana', 'Tó', 'Senhor do relógio', 'Kid de óculos', 'Pedro'];
const NOTES = [
  '',
  'Ele 3-beta muito leve no BB, já vi com A5s e K9o.',
  'Fold no river com top pair? Revê isto: o tamanho do bet dele é sempre polarizado.',
  'Mão chave do dia 2. Bolha, stack médio, ele cobre-me.',
];

/** n hands shaped like real ones: 9-handed MTT, notes, names, tags, newest first. */
export function bigHistory(n: number, start = Date.UTC(2026, 0, 1)): Hand[] {
  const base = sampleHand('x');
  const out: Hand[] = [];
  for (let i = 0; i < n; i++) {
    const at = start + i * 7 * 60000;
    out.push({
      ...base,
      id: 'h_' + i.toString(36).padStart(6, '0'),
      createdAt: at,
      updatedAt: at,
      sessionId: 's_' + Math.floor(i / 40),
      game: { ...base.game, level: 1 + (i % 30) },
      players: base.players.map((p, j) => ({ ...p, name: j && i % 3 === 0 ? NAMES[(i + j) % NAMES.length] : p.name })),
      notes: NOTES[i % NOTES.length],
      tags: i % 5 === 0 ? ['Bluff'] : [],
    });
  }
  return out.reverse();
}
