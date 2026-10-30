/// <reference types="node" />
// «Exportar tudo» and the two CSVs, with years of play (2 000 sessions, 20 000 hands): what goes
// out comes back. The full copy is read back whole; the sessions CSV, in both layouts, imports
// back as the same sessions (the night the clocks go back too); the hands CSV (for spreadsheets: there is no hands import) has every
// hand in a row that parses.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { bigSessionsAndHands } from '../../../scripts/big-history';
import { handsCsv } from '../../export/report';
import { parseCsv } from '../../import/csv';
import { prepare, toSessions } from '../../import/convert';
import { bigButNotBackup, MAX_CSV_BYTES, MAX_FILE_BYTES } from '../../lib/file-limits';
import { buildBackup, parseBackup, sessionsCsv } from '../backup';
import { playedMs, profit } from '../session-math';
import { DEFAULT_SETTINGS } from '../types';

const { sessions, hands } = bigSessionsAndHands();
const players = Array.from({ length: 10 }, (_, i) => ({ id: 'p' + i, name: 'Jogador-' + i, look: '', notes: 'Abre largo do BTN', tags: [], createdAt: i, updatedAt: i }));

test('«Exportar tudo» of years of play is read back whole, and the import takes a file that big', () => {
  const text = JSON.stringify(buildBackup({ hands, sessions, players: players as never, settings: DEFAULT_SETTINGS }, 1));
  const bytes = Buffer.byteLength(text);
  // The reason for the limit: this copy is over the 20 MB the import used to take.
  assert.ok(bytes > MAX_CSV_BYTES, `${bytes}`);
  assert.ok(bytes * 2 < MAX_FILE_BYTES, `room to grow: ${bytes}`);
  const back = parseBackup(text);
  // Fields left undefined in memory are simply absent from the file.
  const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  assert.deepEqual(back.hands, plain(hands));
  assert.deepEqual(back.sessions, plain(sessions));
  assert.deepEqual(back.players, plain(players));
});

test('the file pickers take the bigger copy; spreadsheets keep their own limit', () => {
  for (const f of ['../../lib/files.ts', '../../lib/files.native.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(src, /MAX_FILE_BYTES/, f);
    assert.doesNotMatch(src, /20 \* 1024 \* 1024/, f);
  }
  const imp = readFileSync(new URL('../../app/import.tsx', import.meta.url), 'utf8');
  assert.ok(imp.indexOf('parseBackup(text)') < imp.indexOf("throw new Error('csv_too_big')"), 'a copy is never held to the spreadsheet limit');
});

test('a file over the spreadsheet limit that is not a backup is turned away from its first bytes', () => {
  const big = MAX_CSV_BYTES + 1;
  const b = (s: string) => new TextEncoder().encode(s);
  assert.equal(bigButNotBackup(big, b('{"app":"sweatbook"')), false);
  assert.equal(bigButNotBackup(big, b('\uFEFF \r\n {"app"')), false, 'a byte-order mark and spaces first');
  assert.equal(bigButNotBackup(big, b('date,start_time,type')), true);
  assert.equal(bigButNotBackup(big, new Uint8Array([0x50, 0x4b, 3, 4])), true, 'a zip or .xlsx');
  assert.equal(bigButNotBackup(big, new Uint8Array()), true);
  assert.equal(bigButNotBackup(MAX_CSV_BYTES, b('date,start_time')), false, 'at or under the limit the CSV path decides');
  // Both pickers look before they read the whole file.
  for (const f of ['../../lib/files.ts', '../../lib/files.native.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    const pick = src.slice(src.indexOf('export async function pickTextFileWithName'));
    const peek = pick.indexOf('bigButNotBackup(');
    assert.ok(peek > 0 && peek < pick.search(/\.(bytes|arrayBuffer)\(\)\.catch|a\.file\.arrayBuffer\(\) :/), f);
  }
});

for (const sep of [',', ';'] as const) {
  test(`the sessions CSV (${sep === ',' ? 'commas' : 'semicolons and decimal commas'}) imports back as the same sessions`, () => {
    const text = sessionsCsv(sessions, [], [], [], sep);
    const p = prepare(text);
    assert.equal(p.source, 'sweatbook');
    const r = toSessions(p.table, p.mapping, { currency: '€', tableSize: 9, source: p.source });
    assert.equal(r.failed.length, 0, JSON.stringify(r.failed.slice(0, 3)));
    assert.equal(r.sessions.length, sessions.length);
    const c = (n: number) => Math.round(n * 100);
    const got = [...r.sessions].sort((a, b) => a.startedAt - b.startedAt);
    const want = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
    want.forEach((s, i) => {
      const g = got[i];
      const at = `${s.id} (${sep})`;
      // CSV times are to the minute.
      assert.equal(Math.floor(g.startedAt / 60000), Math.floor(s.startedAt / 60000), at);
      assert.ok(Math.abs(playedMs(g) - playedMs(s)) <= 60000, at);
      assert.equal(g.kind, s.kind, at);
      assert.equal(c(profit(g)), c(profit(s)), at);
      assert.equal(g.buyIn * g.entries, s.buyIn * s.entries, at);
      assert.equal(g.cashOut, s.cashOut, at);
      assert.equal(g.currency, s.currency, at);
      assert.equal(g.venue, s.venue, at);
      assert.equal(g.notes, s.notes, at);
      if (s.kind === 'mtt') {
        assert.equal(g.name, s.name, at);
        assert.equal(g.field, s.field, at);
        assert.equal(g.finish, s.finish, at);
      }
    });
  });
}

for (const sep of [',', ';'] as const) {
  test(`the hands CSV (${sep}) has every hand, in a row that parses`, () => {
    const text = handsCsv(hands, sessions, {}, undefined, sep);
    const rows = parseCsv(text, sep);
    const head = rows[0];
    assert.equal(rows.length, hands.length + 1);
    assert.ok(rows.every((r) => r.length === head.length));
    const col = (n: string) => head.indexOf(n);
    const sorted = [...hands].sort((a, b) => a.createdAt - b.createdAt);
    sorted.forEach((h, i) => {
      const r = rows[i + 1];
      assert.equal(r[col('hero_cards')], h.players[h.hero].cards!.join(' '), h.id);
      assert.equal(r[col('notes')], h.notes, h.id);
      assert.equal(r[col('tags')], h.tags.join(' | '), h.id);
      assert.notEqual(r[col('result_chips')], '', h.id);
    });
  });
}

test('a session over the night the clocks go back comes back with its hours (ending or starting in the hour that happens twice)', () => {
  // Every hour that happens twice here from 2021 to 2026 (none in UTC).
  const twice: number[] = [];
  for (let t = Date.UTC(2021, 0, 1); t < Date.UTC(2027, 0, 1); t += 3600000) if (new Date(t + 3600000).getHours() === new Date(t).getHours()) twice.push(t);
  const list: typeof sessions = [];
  twice.forEach((t, i) => {
    const s0 = sessions[i * 2];
    // Ends 20 min into the second time round; starts 20 min into the first time round, no breaks.
    list.push({ ...s0, id: 'end' + i, startedAt: t - 6 * 3600000, endedAt: t + 3600000 + 20 * 60000 });
    list.push({ ...s0, id: 'start' + i, startedAt: t + 3600000 + 20 * 60000, endedAt: t + 6 * 3600000 });
  });
  const p = prepare(sessionsCsv(list));
  const r = toSessions(p.table, p.mapping, { currency: '€', tableSize: 9, source: p.source });
  assert.equal(r.sessions.length, list.length);
  for (const s of list) {
    const g = r.sessions.find((x) => Math.abs(x.endedAt! - s.endedAt!) < 60000 && Math.abs(x.startedAt - s.startedAt) < 60000);
    assert.ok(g, `${s.id} ${new Date(s.startedAt).toString()} → ${new Date(s.endedAt!).toString()}`);
    assert.ok(Math.abs(playedMs(g) - playedMs(s)) <= 60000, s.id);
  }
});
