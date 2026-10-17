/// <reference types="node" />
// Structure sheets as the phone reads them, fed to the same parser as a paste.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseStructure } from '../../poker/tourney';
import { structureText } from '../structure-ocr';

const levels = (raw: string[]) => parseStructure(structureText(raw), 30).map((l) => [l.sb, l.bb, l.ante, l.minutes]);

test('whole rows (iOS reading a row as one line), level numbers and a break', () => {
  const raw = ['DEEPSTACK STRUCTURE', 'LEVEL BLINDS ANTE TIME', '1 100/200 200 40', '2 200/300 300 40', 'BREAK 15 MIN', '3 200/400 400 40'];
  assert.match(structureText(raw), /Break 15/);
  assert.deepEqual(levels(raw), [[100, 200, 200, 40], [200, 300, 300, 40], [200, 400, 400, 40]]);
});

test('one cell at a time, in reading order', () => {
  const raw = ['Level', 'Blinds', 'Ante', 'Min', '1', '100/200', '200', '30', '2', '200/400', '400', '30', 'Break 10', '3', '300/600', '600', '30'];
  assert.deepEqual(levels(raw), [[100, 200, 200, 30], [200, 400, 400, 30], [300, 600, 600, 30]]);
  assert.match(structureText(raw), /^Break 10$/m);
});

test('a column per block (Android ML Kit), thousands with commas and k', () => {
  const raw = ['LEVEL\n1\n2\n3\n4', 'BLINDS\n1,000/2,000\n1,500/3,000\n2,000/4,000\n3k/6k', 'ANTE\n2,000\n3,000\n4,000\n6,000', 'TIME\n60\n60\n60\n60'];
  assert.deepEqual(levels(raw), [[1000, 2000, 2000, 60], [1500, 3000, 3000, 60], [2000, 4000, 4000, 60], [3000, 6000, 6000, 60]]);
});

test('no ante column and no times: the session\'s level length is used', () => {
  const raw = ['100-200', '200-400', '300-600'];
  assert.deepEqual(levels(raw), [[100, 200, 0, 30], [200, 400, 0, 30], [300, 600, 0, 30]]);
});

test('nothing like a structure gives nothing', () => {
  assert.equal(structureText(['WELCOME', 'Good luck at the tables']), '');
  assert.equal(structureText([]), '');
});
