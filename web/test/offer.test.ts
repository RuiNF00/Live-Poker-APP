import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agreementCost, eventCost, parseOffer, termsChanged, type Agreement } from '../src/lib/offer';
import { offerCopy } from '../src/components/offer/copy';

// The store is server-only; outside Next that import would throw.
vi.mock('server-only', () => ({}));
const { LocalOffers } = await import('../src/lib/offers-store');

const base = {
  v: 1,
  player: 'Rui',
  backer: 'Ana',
  title: 'Festival de dezembro',
  cur: '€',
  markup: 1.15,
  at: 1_790_000_000_000,
  events: [
    { id: 'e3', n: 'High Roller', d: 1_790_300_000_000, b: 10400, p: 5 },
    { id: 'e1', n: 'Opener', d: 1_790_100_000_000, b: 2750, p: 10 },
    { id: 'e2', n: 'Main Event', d: 1_790_200_000_000, b: 5300, p: 2.5 },
  ],
};

const agreement = (over: Record<string, unknown> = {}): Agreement => {
  const a = parseOffer({ ...base, ...over });
  if (!a || a === 'offensive') throw new Error('should parse');
  return a;
};

describe('parseOffer (agreement)', () => {
  it('keeps a valid agreement and sorts the events by date', () => {
    const a = agreement();
    expect(a.events.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(a).toMatchObject({ player: 'Rui', backer: 'Ana', title: 'Festival de dezembro', markup: 1.15, cur: '€' });
  });
  it('drops unknown fields (no cap, no availability), strips control characters and cuts strings', () => {
    const a = agreement({ cap: 10, closed: true, s: 30, backer: 'A\u0000na' + 'x'.repeat(100), title: 't'.repeat(200) });
    expect(JSON.stringify(a)).not.toMatch(/cap|closed|"s"/);
    expect(a.backer.startsWith('A na')).toBe(true);
    expect(a.backer.length).toBe(40);
    expect(a.title.length).toBe(60);
  });
  it('rounds to 2 decimals', () => {
    const a = agreement({ markup: 1.1234, events: [{ ...base.events[0], p: 2.345 }] });
    expect(a.markup).toBe(1.12);
    expect(a.events[0].p).toBe(2.35);
  });
  it('refuses bad numbers, ids and sizes', () => {
    expect(parseOffer({ ...base, v: 2 })).toBe(null);
    expect(parseOffer({ ...base, markup: 2.5 })).toBe(null);
    expect(parseOffer({ ...base, markup: 0.9 })).toBe(null);
    expect(parseOffer({ ...base, events: [] })).toBe(null);
    expect(parseOffer({ ...base, events: [{ ...base.events[0], p: 0 }] })).toBe(null);
    expect(parseOffer({ ...base, events: [{ ...base.events[0], p: 101 }] })).toBe(null);
    expect(parseOffer({ ...base, events: [{ ...base.events[0], b: 0 }] })).toBe(null);
    expect(parseOffer({ ...base, events: [{ ...base.events[0], b: Infinity }] })).toBe(null);
    expect(parseOffer({ ...base, events: [{ ...base.events[0], id: 'bad id!' }] })).toBe(null);
    expect(parseOffer({ ...base, events: [base.events[0], base.events[0]] })).toBe(null);
    const many = Array.from({ length: 41 }, (_, i) => ({ ...base.events[0], id: `e${i}` }));
    expect(parseOffer({ ...base, events: many })).toBe(null);
    expect(parseOffer({ ...base, events: many.slice(0, 40) })).not.toBe(null);
  });
  it('moderates the player, the backer and the title', () => {
    expect(parseOffer({ ...base, player: 'fuck' })).toBe('offensive');
    expect(parseOffer({ ...base, backer: 'puta' })).toBe('offensive');
    expect(parseOffer({ ...base, title: 'festival caralho' })).toBe('offensive');
  });
});

describe('cost', () => {
  it('is Σ p/100 × buy-in × markup', () => {
    const a = agreement();
    // 10% of 2750 + 2.5% of 5300 + 5% of 10400 = 275 + 132.5 + 520 = 927.5, × 1.15
    expect(agreementCost(a)).toBe(1066.63);
    expect(eventCost(a, a.events[0])).toBe(316.25);
  });
  it('new terms are markup, events, currency or backer; the title is not', () => {
    const a = agreement();
    expect(termsChanged(a, agreement({ title: 'Outro' }))).toBe(false);
    expect(termsChanged(a, agreement({ cur: '$' }))).toBe(true);
    expect(termsChanged(a, agreement({ backer: 'Bia' }))).toBe(true);
    expect(termsChanged(a, agreement({ markup: 1.2 }))).toBe(true);
    expect(termsChanged(a, agreement({ events: [{ ...base.events[0], p: 6 }, base.events[1], base.events[2]] }))).toBe(true);
  });
});

describe('event dates', () => {
  it('refuses events dated more than two years ahead (they would dodge the purge)', () => {
    expect(parseOffer({ ...base, events: [{ ...base.events[0], d: 7_258_118_400_000 }] })).toBe(null);
    expect(agreement({ events: [{ ...base.events[0], d: Date.now() + 365 * 864e5 }] }).events).toHaveLength(1);
  });
});

describe('page copy (store policy)', () => {
  it('never uses selling words', () => {
    const banned = /comprar|investir|invertir|dispon[ií]vel|disponible|reserva|retorno|\broi\b|\bbuy\b(?!-in)|reserve|invest|available|\breturn|apost|apuest/i;
    for (const locale of ['pt', 'pt-BR', 'en', 'es'] as const) {
      const c = offerCopy(locale);
      const text = Object.values(c)
        .map((v) => (typeof v === 'function' ? (v as (...x: string[]) => string)('X', 'Y') : v))
        .join(' ');
      expect(text).not.toMatch(banned);
    }
    const view = readFileSync(path.join(__dirname, '../src/components/offer/OfferView.tsx'), 'utf8');
    expect(view).not.toMatch(/comprar|investir|dispon[ií]vel|retorno/i);
  });
  it('has no reservation routes', () => {
    expect(readdirSync(path.join(__dirname, '../src/app/api/offers/[id]')).sort()).toEqual(['confirm', 'route.ts']);
  });
});

describe('LocalOffers', () => {
  let dir: string;
  let store: InstanceType<typeof LocalOffers>;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'offers-'));
    store = new LocalOffers(path.join(dir, 'offers.json'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('starts unconfirmed; confirming is idempotent', async () => {
    const { id } = await store.create(agreement());
    expect((await store.get(id))?.confirmedAt).toBe(null);
    const first = await store.confirm(id);
    expect(first).toBeTruthy();
    expect(await store.confirm(id)).toBe(first);
    expect((await store.get(id))?.confirmedAt).toBe(first);
    expect(await store.confirm('nope000000')).toBe(null);
  });

  it('new markup or events clear the confirmation; other edits keep it', async () => {
    const { id, editToken } = await store.create(agreement());
    const first = await store.confirm(id);
    expect(await store.update(id, editToken, agreement({ title: 'Outro' }))).toBe(true);
    expect((await store.get(id))?.confirmedAt).toBe(first);
    expect(await store.update(id, editToken, agreement({ markup: 1.2 }))).toBe(true);
    expect((await store.get(id))?.confirmedAt).toBe(null);
    await store.confirm(id);
    expect(await store.update(id, editToken, agreement({ markup: 1.2, events: [{ ...base.events[0], p: 6 }] }))).toBe(true);
    expect((await store.get(id))?.confirmedAt).toBe(null);
  });

  it('needs the token to change or delete', async () => {
    const { id, editToken } = await store.create(agreement());
    expect(await store.update(id, 'wrong', agreement({ markup: 2 }))).toBe(false);
    expect((await store.get(id))?.offer.markup).toBe(1.15);
    expect(await store.remove(id, 'wrong')).toBe(false);
    expect(await store.remove(id, editToken)).toBe(true);
    expect(await store.get(id)).toBe(null);
  });

  it('reads never carry the token hash', async () => {
    const { id, editToken } = await store.create(agreement());
    const rec = await store.get(id);
    expect(JSON.stringify(rec)).not.toMatch(/editToken|token/i);
    expect(JSON.stringify(rec)).not.toContain(editToken);
  });

  it('purges 60 days after the last event', async () => {
    const old = await store.create(agreement({ events: [{ ...base.events[0], d: Date.now() - 61 * 86400000 }] }));
    const fresh = await store.create(agreement({ events: [{ ...base.events[0], d: Date.now() - 59 * 86400000 }] }));
    await store.purge();
    expect(await store.get(old.id)).toBe(null);
    expect(await store.get(fresh.id)).not.toBe(null);
  });
});
