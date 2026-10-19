import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FESTIVALS } from '../../poker/festivals';
import { agreement, newOffer, sameTerms } from '../action-offer';
import { parseOffer } from '../../../web/src/lib/offer';

test('every festival (Bankroll, #337 sameTerms): what the server keeps reads back as the same terms', () => {
  let n = 0, refused = 0;
  const bad: string[] = [];
  const names = ['Ana', '  João Silva ', 'X'.repeat(45), 'Zoë 🃏', 'a\tb', 'Ünïcödé Ñame long enough to be cut at forty chars'];
  for (const f of FESTIVALS) {
    const o = newOffer(f, f.events.map((e) => e.id), 'o1');
    for (const markup of [1, 1.1, 1.137, 1.2549999, 1.999]) for (const pct of [0.5, 7.333, 10, 33.335, 49.999]) for (const b of names) {
      o.markup = markup;
      const line = { id: 'l1', backerId: 'b', pct } as never;
      const mine = agreement(f, o, line, 'Rui', b, f.name);
      if (!mine.events.length) continue;
      const kept = parseOffer(JSON.parse(JSON.stringify(mine)));
      if (!kept || kept === 'offensive') { refused++; continue; }
      n++;
      const back = JSON.parse(JSON.stringify(kept));
      if (!sameTerms(back, agreement(f, o, line, 'Rui', b, f.name))) bad.push(`${f.id} m=${markup} p=${pct} b=${JSON.stringify(b)}`);
    }
  }
  assert.equal(refused, 0, 'every shipped event id reaches the link (Las Vegas «85-1F Turbo»)');
  assert.deepEqual(bad, []);
  assert.ok(n > 0);
});
