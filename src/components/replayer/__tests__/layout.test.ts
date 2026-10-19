import assert from 'node:assert/strict';
import { test } from 'node:test';

import { betBox, boardBox, EDGE, overlaps, potBox, scaleFor, seatBox, STAGE_RATIO, tableMap } from '../layout';

const WIDTHS = [300, 343, 366, 390, 430];

test('every table size from 2 to 10 seats fits a phone without anything covering anything', () => {
  for (const w of WIDTHS) {
    const h = w * STAGE_RATIO;
    for (let n = 2; n <= 10; n++) {
      const { seats, bets } = tableMap(n);
      assert.equal(seats.length, n);
      assert.equal(bets.length, n);
      const seatBoxes = seats.map((p, i) => seatBox(p, w, i === 0));
      const betBoxes = bets.map((p) => betBox(p, w));
      const middle = [boardBox(w, n), potBox(w)];
      const edge = EDGE * scaleFor(w) - 0.01;
      const where = `w=${w} n=${n}`;
      seatBoxes.forEach((s, i) => {
        assert.ok(s.top >= -2 && s.bottom <= h + 2 && s.left >= edge && s.right <= w - edge, `${where}: seat ${i} touches the screen edge`);
        seatBoxes.forEach((o, j) => j > i && assert.ok(!overlaps(s, o), `${where}: seats ${i} and ${j} touch`));
        middle.forEach((m) => assert.ok(!overlaps(s, m), `${where}: seat ${i} covers the board or pot`));
      });
      betBoxes.forEach((b, i) => {
        seatBoxes.forEach((s, j) => assert.ok(!overlaps(b, s), `${where}: bet of seat ${i} covers seat ${j}`));
        betBoxes.forEach((o, j) => j > i && assert.ok(!overlaps(b, o), `${where}: bets of seats ${i} and ${j} touch`));
        middle.forEach((m) => assert.ok(!overlaps(b, m), `${where}: bet of seat ${i} covers the board or pot`));
      });
    }
  }
});
