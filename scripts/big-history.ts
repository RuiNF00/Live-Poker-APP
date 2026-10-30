// A big history for performance work: 2 000 sessions and 20 000 hands over five years, shaped like
// a regular's (cash and tournaments, rebuys, stack logs, notes, named villains, tags).
// Pure: the bench and the web seed both use it.

import { sampleHand } from '../src/poker/sample';
import type { CardCode, Hand } from '../src/poker/types';
import type { PlayerNote, Session } from '../src/store/types';

const VENUES = ['Casino Lisboa', 'Casino Estoril', 'Casino Espinho', 'Aspers Stratford', 'Bellagio', 'Aria', 'Casino Barcelona', 'Kings Rozvadov'];
const NAMES = ['Boné azul', 'Reg alemão', 'Miguel', 'Ana', 'Tó', 'Senhor do relógio', 'Kid de óculos', 'Pedro', 'Rita', 'O do casaco'];
const NOTES = ['', 'Ele 3-beta muito leve no BB, já vi com A5s e K9o.', 'Fold no river com top pair? Revê isto: o tamanho do bet dele é sempre polarizado.', 'Mão chave do dia 2. Bolha, stack médio, ele cobre-me.', 'Overbet no turn, call, shove no river. Fold?'];
const TAGS = ['Bluff', 'Hero call', 'Value', 'Cooler', 'Dúvida', 'Erro'];
const RANKS = 'AKQJT98765432';
const SUITS = 'shdc';

// Deterministic, so two runs measure the same thing.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function bigSessionsAndHands(nSessions = 2000, handsPerSession = 10, start = Date.UTC(2021, 9, 1)) {
  const r = rng(42);
  const base = sampleHand('x');
  const sessions: Session[] = [];
  const hands: Hand[] = [];
  const span = Date.UTC(2026, 9, 29) - start;
  for (let i = 0; i < nSessions; i++) {
    const mtt = r() < 0.3;
    const startedAt = start + Math.floor((i / nSessions) * span) + Math.floor(r() * 3_600_000);
    const hours = 2 + r() * 8;
    const endedAt = startedAt + Math.floor(hours * 3_600_000);
    const buyIn = mtt ? [110, 220, 550, 1100][Math.floor(r() * 4)] : [200, 300, 500][Math.floor(r() * 3)];
    const entries = 1 + (r() < 0.25 ? 1 : 0);
    const cashOut = mtt ? (r() < 0.15 ? Math.round(buyIn * (2 + r() * 30)) : 0) : Math.max(0, Math.round(buyIn * entries * (0.2 + r() * 1.8)));
    const stackLog = Array.from({ length: 12 }, (_, k) => ({ t: startedAt + k * ((endedAt - startedAt) / 12), stack: Math.round(buyIn * (0.5 + r())) }));
    const id = 's_' + i.toString(36).padStart(5, '0');
    sessions.push({
      id, kind: mtt ? 'mtt' : 'cash', name: mtt ? `Main Event #${i % 97}` : '', venue: VENUES[i % VENUES.length], currency: i % 11 === 0 ? '$' : '€',
      startedAt, endedAt, breaks: [], buyIn, entries, addOn: 0, cashOut, ...(mtt ? { finish: cashOut ? 1 + Math.floor(r() * 30) : undefined, field: 100 + Math.floor(r() * 900) } : {}),
      sb: mtt ? 100 : 1, bb: mtt ? 200 : 2, ante: mtt ? 200 : 0, anteType: 'bb', tableSize: 9, stack: stackLog[11].stack, stackLog, roster: [], notes: i % 4 ? '' : NOTES[i % NOTES.length], tags: i % 6 ? [] : ['Focado'],
    } as Session);
    for (let k = 0; k < handsPerSession; k++) {
      const at = startedAt + Math.floor(((k + 0.5) / handsPerSession) * (endedAt - startedAt));
      const deck = [...RANKS].flatMap((x) => [...SUITS].map((y) => (x + y) as CardCode));
      const pick = () => deck.splice(Math.floor(r() * deck.length), 1)[0];
      const hero: CardCode[] = [pick(), pick()];
      const j = hands.length;
      hands.push({
        ...base,
        id: 'h_' + j.toString(36).padStart(6, '0'),
        createdAt: at,
        updatedAt: at,
        sessionId: id,
        game: { ...base.game, kind: mtt ? 'mtt' : 'cash', name: mtt ? `Main Event #${i % 97}` : '', venue: VENUES[i % VENUES.length], level: 1 + (j % 30) },
        players: base.players.map((p, s) => (s === base.hero ? { ...p, cards: hero } : { ...p, name: s && j % 3 === 0 ? NAMES[(j + s) % NAMES.length] : p.name })),
        notes: NOTES[j % NOTES.length],
        tags: j % 5 === 0 ? [TAGS[j % TAGS.length]] : [],
      });
    }
  }
  const players: PlayerNote[] = NAMES.map((name, k) => ({ id: 'p_' + k, name, look: '', tags: [], notes: NOTES[k % NOTES.length], createdAt: start, updatedAt: start }));
  // Newest first, as the store keeps them.
  return { sessions: sessions.reverse(), hands: hands.reverse(), players };
}
