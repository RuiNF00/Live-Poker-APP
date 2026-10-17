import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { offerPrice, parseOffer, parseReservation, remaining, soldOut, type Offer } from '../src/lib/offer';

// The store is server-only; outside Next that import would throw.
vi.mock('server-only', () => ({}));
const { LocalOffers } = await import('../src/lib/offers-store');

const base = {
  v: 1,
  player: 'Rui',
  title: 'Festival de dezembro',
  cur: '€',
  markup: 1.15,
  cap: 10,
  min: 1,
  whole: false,
  closed: false,
  at: 1_790_000_000_000,
  events: [
    { id: 'e3', n: 'High Roller', d: 1_790_300_000_000, b: 10400, s: 30 },
    { id: 'e1', n: 'Opener', d: 1_790_100_000_000, b: 2750, s: 30 },
    { id: 'e2', n: 'Main Event', d: 1_790_200_000_000, b: 5300, s: 30 },
  ],
};

const offer = () => {
  const o = parseOffer(base);
  if (!o || o === 'offensive') throw new Error('base offer should parse');
  return o;
};

describe('parseOffer', () => {
  it('keeps a valid offer and sorts the events by date', () => {
    const o = offer();
    expect(o.events.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(o).toMatchObject({ player: 'Rui', title: 'Festival de dezembro', markup: 1.15, cap: 10, min: 1, whole: false, closed: false });
  });
  it('drops unknown fields, strips control characters and cuts strings', () => {
    const o = parseOffer({ ...base, secret: 'x', player: 'Ru\u0000i' + 'x'.repeat(100), title: 't'.repeat(200), events: [{ ...base.events[0], n: 'n'.repeat(300), extra: 1 }] });
    if (!o || o === 'offensive') throw new Error('should parse');
    expect(JSON.stringify(o)).not.toMatch(/secret|extra/);
    expect(o.player.startsWith('Ru i')).toBe(true);
    expect(o.player.length).toBe(40);
    expect(o.title.length).toBe(60);
    expect(o.events[0].n.length).toBe(80);
  });
  it('rounds to 2 decimals', () => {
    const o = parseOffer({ ...base, markup: 1.1234, events: [{ ...base.events[0], b: 100.005, s: 12.345 }] });
    if (!o || o === 'offensive') throw new Error('should parse');
    expect(o.markup).toBe(1.12);
    expect(o.events[0].s).toBe(12.35);
  });
  it('refuses bad numbers, ids and sizes', () => {
    expect(parseOffer({ ...base, v: 2 })).toBe(null);
    expect(parseOffer({ ...base, markup: 2.5 })).toBe(null);
    expect(parseOffer({ ...base, markup: 0.9 })).toBe(null);
    expect(parseOffer({ ...base, cap: 0 })).toBe(null);
    expect(parseOffer({ ...base, min: 20 })).toBe(null);
    expect(parseOffer({ ...base, min: 0.25 })).toBe(null);
    expect(parseOffer({ ...base, events: [] })).toBe(null);
    expect(parseOffer({ ...base, events: [{ ...base.events[0], s: 101 }] })).toBe(null);
    expect(parseOffer({ ...base, events: [{ ...base.events[0], b: 0 }] })).toBe(null);
    expect(parseOffer({ ...base, events: [{ ...base.events[0], b: Infinity }] })).toBe(null);
    expect(parseOffer({ ...base, events: [{ ...base.events[0], id: 'bad id!' }] })).toBe(null);
    expect(parseOffer({ ...base, events: [base.events[0], base.events[0]] })).toBe(null);
    const many = Array.from({ length: 41 }, (_, i) => ({ ...base.events[0], id: `e${i}` }));
    expect(parseOffer({ ...base, events: many })).toBe(null);
    expect(parseOffer({ ...base, events: many.slice(0, 40) })).not.toBe(null);
  });
  it('defaults min to 1 and the currency to €', () => {
    const { min: _m, cur: _c, ...rest } = base;
    const o = parseOffer(rest);
    if (!o || o === 'offensive') throw new Error('should parse');
    expect(o.min).toBe(1);
    expect(o.cur).toBe('€');
  });
  it('moderates the player and the title', () => {
    expect(parseOffer({ ...base, player: 'fuck' })).toBe('offensive');
    expect(parseOffer({ ...base, title: 'festival caralho' })).toBe('offensive');
  });
});

describe('parseReservation', () => {
  it('keeps name, contact and pieces, dropping zeros', () => {
    const r = parseReservation({ name: ' Ana ', contact: '@ana', extra: 1, shares: [{ e: 'e1', p: 2.5 }, { e: 'e2', p: 0 }] }, offer());
    expect(r).toEqual({ name: 'Ana', contact: '@ana', shares: [{ e: 'e1', p: 2.5 }] });
  });
  it('needs a name and at least one piece of min or more on a known event', () => {
    const o = offer();
    expect(parseReservation({ name: '', shares: [{ e: 'e1', p: 2 }] }, o)).toBe(null);
    expect(parseReservation({ name: 'Ana', shares: [{ e: 'e1', p: 0 }] }, o)).toBe(null);
    expect(parseReservation({ name: 'Ana', shares: [{ e: 'e1', p: 0.5 }] }, o)).toBe(null);
    expect(parseReservation({ name: 'Ana', shares: [{ e: 'zz', p: 2 }] }, o)).toBe(null);
    expect(parseReservation({ name: 'Ana', shares: [{ e: 'e1', p: 2 }, { e: 'e1', p: 2 }] }, o)).toBe(null);
    expect(parseReservation({ name: 'Ana', shares: [{ e: 'e1', p: '2' }] }, o)).toBe(null);
  });
  it('a whole package needs the same % of every event', () => {
    const o = { ...offer(), whole: true };
    expect(parseReservation({ name: 'Ana', shares: [{ e: 'e1', p: 2 }, { e: 'e2', p: 2 }] }, o)).toBe(null);
    expect(parseReservation({ name: 'Ana', shares: [{ e: 'e1', p: 2 }, { e: 'e2', p: 3 }, { e: 'e3', p: 2 }] }, o)).toBe(null);
    expect(parseReservation({ name: 'Ana', shares: [{ e: 'e1', p: 2 }, { e: 'e2', p: 2 }, { e: 'e3', p: 2 }] }, o)).not.toBe(null);
  });
  it('moderates the name', () => {
    expect(parseReservation({ name: 'puta', shares: [{ e: 'e1', p: 2 }] }, offer())).toBe('offensive');
  });
});

describe('price and remaining', () => {
  it('prices Σ p/100 × buy-in × markup', () => {
    // 2% of 2750 + 1% of 10400, × 1.15
    expect(offerPrice(offer(), [{ e: 'e1', p: 2 }, { e: 'e3', p: 1 }])).toBe(182.85);
    expect(offerPrice(offer(), [])).toBe(0);
  });
  it('remaining is s minus what is taken, never below 0', () => {
    expect(remaining(offer(), { e1: 12.5, e2: 40 })).toEqual({ e1: 17.5, e2: 0, e3: 30 });
  });
  it('sold out when nothing is left for the smallest piece', () => {
    const o = offer();
    expect(soldOut(o, { e1: 30, e2: 30 })).toBe(false);
    expect(soldOut(o, { e1: 30, e2: 30, e3: 29.5 })).toBe(true);
    expect(soldOut({ ...o, whole: true }, { e1: 30 })).toBe(true);
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

  const res = (name: string, shares: { e: string; p: number }[]) => ({ name, contact: '', shares });

  it('holds reservations and refuses what is not left (sold out)', async () => {
    const { id } = await store.create({ ...offer(), events: [{ id: 'a', n: 'A', d: 1, b: 1000, s: 12 }] });
    expect(await store.reserve(id, res('A', [{ e: 'a', p: 10 }]))).toHaveProperty('rid');
    expect(await store.reserve(id, res('B', [{ e: 'a', p: 3 }]))).toEqual({ error: 'sold_out' });
    expect(await store.reserve(id, res('B', [{ e: 'a', p: 2 }]))).toHaveProperty('rid');
    expect((await store.get(id))?.taken).toEqual({ a: 12 });
  });

  it('is atomic when backers press at once', async () => {
    const { id } = await store.create({ ...offer(), events: [{ id: 'a', n: 'A', d: 1, b: 1000, s: 10 }] });
    const out = await Promise.all(Array.from({ length: 12 }, (_, i) => store.reserve(id, res(`B${i}`, [{ e: 'a', p: 3 }]))));
    expect(out.filter((r) => 'rid' in r)).toHaveLength(3);
    expect((await store.get(id))?.taken).toEqual({ a: 9 });
  });

  it('refuses more than the cap per backer', async () => {
    const { id } = await store.create(offer());
    expect(await store.reserve(id, res('A', [{ e: 'e1', p: 10.5 }]))).toEqual({ error: 'over_cap' });
  });

  it('refuses an uneven whole package', async () => {
    const { id } = await store.create({ ...offer(), whole: true });
    expect(await store.reserve(id, res('A', [{ e: 'e1', p: 2 }, { e: 'e2', p: 3 }, { e: 'e3', p: 2 }]))).toEqual({ error: 'invalid' });
    expect(await store.reserve(id, res('A', [{ e: 'e1', p: 2 }]))).toEqual({ error: 'invalid' });
    expect(await store.reserve(id, res('A', [{ e: 'e1', p: 2 }, { e: 'e2', p: 2 }, { e: 'e3', p: 2 }]))).toHaveProperty('rid');
  });

  it('refuses reservations once closed', async () => {
    const { id, editToken } = await store.create(offer());
    expect(await store.update(id, editToken, { ...offer(), closed: true })).toBe('ok');
    expect(await store.reserve(id, res('A', [{ e: 'e1', p: 1 }]))).toEqual({ error: 'closed' });
  });

  it('refuses to lower s below what is taken, and frees a declined reservation', async () => {
    const { id, editToken } = await store.create(offer());
    const r = await store.reserve(id, res('A', [{ e: 'e1', p: 10 }]));
    if (!('rid' in r)) throw new Error('should reserve');
    const lower = (s: number): Offer => ({ ...offer(), events: offer().events.map((e) => (e.id === 'e1' ? { ...e, s } : e)) });
    expect(await store.update(id, editToken, lower(9))).toBe('conflict');
    expect(await store.update(id, editToken, { ...offer(), events: offer().events.filter((e) => e.id !== 'e1') })).toBe('conflict');
    expect(await store.update(id, 'wrong', lower(20))).toBe('not_found');
    expect(await store.update(id, editToken, lower(10))).toBe('ok');
    expect(await store.setStatus(id, editToken, r.rid, 'declined')).toBe('ok');
    expect((await store.get(id))?.taken).toEqual({});
    expect(await store.update(id, editToken, lower(5))).toBe('ok');
    // Re-confirming no longer fits in the 5% now on sale.
    expect(await store.setStatus(id, editToken, r.rid, 'confirmed')).toBe('sold_out');
    expect(await store.setStatus(id, 'wrong', r.rid, 'confirmed')).toBe('not_found');
  });

  it('public get never carries names or contacts; the owner list does', async () => {
    const { id, editToken } = await store.create(offer());
    await store.reserve(id, { name: 'Zé Secreto', contact: '+351 912 345 678', shares: [{ e: 'e1', p: 2 }] });
    const pub = await store.get(id);
    expect(pub?.count).toBe(1);
    expect(JSON.stringify(pub)).not.toMatch(/Secreto|912|editToken/i);
    expect(await store.reservations(id, 'wrong')).toBe(null);
    const own = await store.reservations(id, editToken);
    expect(own?.[0]).toMatchObject({ name: 'Zé Secreto', contact: '+351 912 345 678', status: 'pending' });
  });

  it('caps reservations per offer at 200', async () => {
    const { id } = await store.create({ ...offer(), cap: 100, min: 0.5, events: [{ id: 'a', n: 'A', d: 1, b: 1000, s: 100 }] });
    for (let i = 0; i < 200; i++) await store.reserve(id, res(`B${i}`, [{ e: 'a', p: 0.5 }]));
    expect(await store.reserve(id, res('late', [{ e: 'a', p: 0.5 }]))).toEqual({ error: 'full' });
  });
});
