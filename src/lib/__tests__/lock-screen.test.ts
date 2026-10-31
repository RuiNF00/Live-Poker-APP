/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
// Its own line, so it merges cleanly with the integration's changes to the import below.
/* eslint-disable import/no-duplicates */
import { lockAction, lockActionPatch, parseTarget } from '../lock-screen/live-state';
import { askForLockScreen, sessionNoticePreview } from '../lock-screen/live-state';

import type { Session } from '../../store/types';
import { breakEndMessage, breakLabel, breakOf, caughtUp, levelAfter, levelsDue, nameForStakes, levelUpMessage, liveProps, nextLevelAt, sessionPLO, withLevelClock } from '../lock-screen/live-state';

const MIN = 60_000;

function mk(over: Partial<Session> = {}): Session {
  return {
    id: 's', kind: 'mtt', name: 'Main Event', venue: 'Estoril', currency: '€', startedAt: 0, breaks: [],
    buyIn: 100, entries: 1, addOn: 0, cashOut: 0, sb: 400, bb: 800, ante: 800, anteType: 'bb', level: 6, tableSize: 9, stack: 42000,
    stackLog: [], roster: [], notes: '',
    ...over,
  };
}

test('next level: start + length, pushed back by breaks inside the level', () => {
  const s = mk({ levelMinutes: 30, levelStartedAt: 60 * MIN });
  assert.equal(nextLevelAt(s, 70 * MIN), 90 * MIN);
  // A 10-minute break in the level moves it 10 minutes; one before the level doesn't.
  const b = mk({ levelMinutes: 30, levelStartedAt: 60 * MIN, breaks: [{ start: 30 * MIN, end: 40 * MIN }, { start: 65 * MIN, end: 75 * MIN }] });
  assert.equal(nextLevelAt(b, 80 * MIN), 100 * MIN);
  // A break still running counts up to now.
  const open = mk({ levelMinutes: 30, levelStartedAt: 60 * MIN, breaks: [{ start: 70 * MIN }] });
  assert.equal(nextLevelAt(open, 75 * MIN), 95 * MIN);
});

test('no level length, no start or an ended session: no next level', () => {
  assert.equal(nextLevelAt(mk()), undefined);
  assert.equal(nextLevelAt(mk({ levelMinutes: 20 })), undefined);
  assert.equal(nextLevelAt(mk({ levelMinutes: 20, levelStartedAt: 1, endedAt: 2 })), undefined);
});

test('level clock restarts on a level change or when first set, not on other edits', () => {
  const prev = mk({ levelMinutes: 20, levelStartedAt: 5 * MIN });
  assert.equal(withLevelClock(prev, { ...prev, stack: 50000 }, 9 * MIN).levelStartedAt, 5 * MIN);
  assert.equal(withLevelClock(prev, { ...prev, ...levelAfter(prev, 1) }, 9 * MIN).levelStartedAt, 9 * MIN);
  assert.equal(withLevelClock(mk(), mk({ levelMinutes: 20 }), 7 * MIN).levelStartedAt, 7 * MIN);
  // Changing the length clears the start on the screen, which restarts the clock here.
  assert.equal(withLevelClock(prev, { ...prev, levelMinutes: 30, levelStartedAt: undefined }, 8 * MIN).levelStartedAt, 8 * MIN);
  // Without a length nothing is stamped.
  assert.equal(withLevelClock(undefined, mk(), 1).levelStartedAt, undefined);
});

test('levelAfter walks the blinds ladder and keeps the ante type', () => {
  assert.deepEqual(levelAfter(mk(), 1), { sb: 500, bb: 1000, ante: 1000, level: 7 });
  assert.deepEqual(levelAfter(mk(), -1), { sb: 300, bb: 600, ante: 600, level: 5 });
  assert.deepEqual(levelAfter(mk({ sb: 100, bb: 200, level: 1 }), -1), { sb: 100, bb: 200, ante: 200, level: 1 });
  assert.deepEqual(levelAfter(mk({ kind: 'cash', sb: 1, bb: 2, anteType: 'none', level: undefined }), 1), { sb: 1, bb: 3, ante: 0, level: undefined });
});

test('a cash game named after its stakes follows them; other names stay as typed', () => {
  const cash = (name: string, sb: number, bb: number) => mk({ kind: 'cash', name, sb, bb, ante: 0, anteType: 'none', level: undefined });
  // 2/5 → 5/5 on the ladder, and back down.
  assert.deepEqual(levelAfter(cash('NLH 2/5', 2, 5), 1), { sb: 5, bb: 5, ante: 0, level: undefined, name: 'NLH 5/5' });
  assert.deepEqual(levelAfter(cash('2/5 Casino Lisboa', 2, 5), -1), { sb: 2, bb: 3, ante: 0, level: undefined, name: '2/3 Casino Lisboa' });
  assert.deepEqual(levelAfter(cash('NLH 0,5/1', 0.5, 1), 1), { sb: 1, bb: 2, ante: 0, level: undefined, name: 'NLH 1/2' });
  // No stakes in the name, other numbers, or a tournament: nothing changes.
  assert.equal('name' in levelAfter(cash('Quinta com a malta', 2, 5), 1), false);
  assert.equal('name' in levelAfter(cash('Mesa 12/5', 2, 5), 1), false);
  assert.equal('name' in levelAfter(cash('1/2/5 mix', 1, 2), 1), false);
  assert.equal(nameForStakes('mix 1/2/5', { sb: 2, bb: 5 }, { sb: 5, bb: 5 }), undefined);
  assert.equal('name' in levelAfter(mk({ name: 'Main 400/800' }), 1), false);
  assert.equal(nameForStakes('NLH 1/2', { sb: 1, bb: 2 }, { sb: 1, bb: 2 }), undefined);
  assert.equal(nameForStakes('NLH 0.5/1', { sb: 0.5, bb: 1 }, { sb: 1, bb: 2 }), 'NLH 1/2');
  assert.equal(nameForStakes('1 / 2 deep', { sb: 1, bb: 2 }, { sb: 1, bb: 3 }), '1/3 deep');
});

test('lock-screen props: clock without breaks, stack in bb, level and next blinds', () => {
  const s = mk({ startedAt: 0, breaks: [{ start: 60 * MIN, end: 75 * MIN }], levelMinutes: 30, levelStartedAt: 100 * MIN });
  const p = liveProps(s, 120 * MIN);
  assert.equal(p.clockFrom, 15 * MIN); // 105 minutes played
  assert.equal(p.played, '1h 45');
  assert.equal(p.paused, false);
  assert.equal(p.pausedAt, 0);
  assert.match(p.stackBB, /^52[.,]5 bb$/);
  assert.equal(p.level, 'Nível 6');
  assert.equal(p.nextLevelAt, 130 * MIN);
  assert.equal(p.title, 'Main Event');
  // Must survive JSON: the native side gets it serialized.
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
});

test('paused session freezes the clock at the pause', () => {
  const s = mk({ breaks: [{ start: 50 * MIN }] });
  const p = liveProps(s, 60 * MIN);
  assert.equal(p.paused, true);
  assert.equal(p.pausedAt, 60 * MIN);
  assert.equal(p.pausedAt - p.clockFrom, 50 * MIN);
});

test('level-up message names the next level and blinds', () => {
  const m = levelUpMessage(mk());
  assert.equal(m.title, 'Subida de nível');
  assert.match(m.body, /Nível 7/);
  assert.match(m.body, /500\/1[\s.,]?000/);
});

test('privacy mode: a cash stack is money and shows •••, tournament chips stay', () => {
  const cash = liveProps(mk({ kind: 'cash', sb: 5, bb: 10, ante: 0, anteType: 'none', stack: 2400 }), 60 * MIN, true);
  assert.equal(cash.stack, '•••');
  assert.equal(cash.stackBB, '•••');
  assert.equal(cash.blinds, '5/10');
  const mttP = liveProps(mk(), 60 * MIN, true);
  assert.notEqual(mttP.stack, '•••');
  assert.notEqual(liveProps(mk({ kind: 'cash', stack: 2400 }), 60 * MIN).stack, '•••');
});

test('privacy mode: the session name (often the venue) gives way to the game', () => {
  assert.equal(liveProps(mk({ kind: 'cash', name: 'Casino X 2/5' }), 60 * MIN).title, 'Casino X 2/5');
  assert.equal(liveProps(mk({ kind: 'cash', name: 'Casino X 2/5' }), 60 * MIN, true).title, 'Cash game');
});

test('breaks on the structure: lock-screen line, the level-up reminder and the call back to the table', () => {
  const structure = [
    { sb: 100, bb: 200, ante: 200, minutes: 30 },
    { sb: 200, bb: 400, ante: 400, minutes: 30, breakAfter: 15 },
    { sb: 300, bb: 600, ante: 600, minutes: 30 },
  ];
  const at = (level: number) => mk({ level, sb: structure[level - 1].sb, bb: structure[level - 1].bb, levelMinutes: 30, levelStartedAt: 60 * MIN, tourney: { structure } });
  // Level 1 started at 60 min and ends at 90, level 2 at 120: the break starts then.
  const b1 = breakOf(at(1), 70 * MIN);
  assert.deepEqual(b1, { afterLevel: 2, at: 120 * MIN, minutes: 15 });
  assert.match(liveProps(at(1), 70 * MIN).breakAt, /^Intervalo às .+ · 15 min$/);
  assert.equal(breakLabel(b1, 125 * MIN), 'Intervalo agora · 15 min');
  // Not a break yet: the usual reminder. The level before the break: the reminder says pause.
  assert.equal(levelUpMessage(at(1), 70 * MIN).title, 'Subida de nível');
  const m = levelUpMessage(at(2), 70 * MIN);
  assert.equal(m.title, 'Intervalo de 15 min');
  assert.match(m.body, /pausa.*nível 3/);
  assert.match(breakEndMessage(at(2), breakOf(at(2), 70 * MIN)!).body, /nível 3: blinds 300\/600/);
  // No structure, a cash game or no level clock: nothing.
  assert.equal(liveProps(mk({ levelMinutes: 30, levelStartedAt: 60 * MIN }), 70 * MIN).breakAt, '');
  assert.equal(breakOf({ ...at(1), kind: 'cash' }, 70 * MIN), null);
  assert.equal(breakOf({ ...at(1), levelMinutes: undefined }, 70 * MIN), null);
});

test('levelsDue: the level moves up by itself when its clock runs out, on the floor\'s time', () => {
  const s = mk({ levelMinutes: 30, levelStartedAt: 10 * MIN });
  assert.equal(levelsDue(s, 39 * MIN), null);
  assert.deepEqual(levelsDue(s, 41 * MIN), { ...levelAfter(s, 1), levelMinutes: 30, levelStartedAt: 40 * MIN });
  // Away for two levels: both, and the third level's clock started at 70 min.
  const two = levelsDue(s, 75 * MIN)!;
  assert.equal(two.level, (s.level ?? 1) + 2);
  assert.equal(two.levelStartedAt, 70 * MIN);
  // No clock, a cash game, or a finished session: nothing.
  assert.equal(levelsDue(mk(), 99 * MIN), null);
  assert.equal(levelsDue(mk({ kind: 'cash', levelMinutes: 30, levelStartedAt: 10 * MIN }), 99 * MIN), null);
});

test('caughtUp: back after two levels, the lock screen and the reminder are on the current level', () => {
  const s = mk({ levelMinutes: 30, levelStartedAt: 10 * MIN });
  const now = caughtUp(s, 75 * MIN);
  assert.equal(now.level, (s.level ?? 1) + 2);
  assert.equal(nextLevelAt(now, 75 * MIN), 100 * MIN);
  assert.equal(liveProps(now, 75 * MIN).nextLevelAt, 100 * MIN);
  // Nothing due: the same session, untouched.
  assert.equal(caughtUp(s, 20 * MIN), s);
  const cash = mk({ kind: 'cash', levelMinutes: 30, levelStartedAt: 10 * MIN });
  assert.equal(caughtUp(cash, 99 * MIN), cash);
});

test('levelsDue: a 10-hour day of 15-minute levels away from the screen still lands on the right level', () => {
  const s = mk({ level: 1, levelMinutes: 15, levelStartedAt: MIN });
  const p = levelsDue(s, 10 * 60 * MIN + 5 * MIN)!;
  assert.equal(p.level, 41);
  assert.equal(p.levelStartedAt, 10 * 60 * MIN + MIN);
});

test('a tournament started before its published start keeps level 1 until the floor\'s clock has run a full level', () => {
  // Tapped at 16:35 for a 17:00 start with 30-min levels: the clock starts at 17:00.
  const s = withLevelClock(undefined, mk({ level: 1, levelMinutes: 30, levelStartedAt: 60 * MIN }), 35 * MIN);
  assert.equal(s.levelStartedAt, 60 * MIN);
  assert.equal(nextLevelAt(s, 66 * MIN), 90 * MIN);
  assert.equal(levelsDue(s, 66 * MIN), null);
  // A new session without a start still runs from now.
  assert.equal(withLevelClock(undefined, mk({ levelMinutes: 30 }), 35 * MIN).levelStartedAt, 35 * MIN);
});

test('lock-screen level bar: the level starts one length before it ends, breaks taken out', () => {
  const s = mk({ levelMinutes: 30, levelStartedAt: 60 * MIN, breaks: [{ start: 65 * MIN, end: 75 * MIN }] });
  const p = liveProps(s, 80 * MIN);
  assert.equal(p.nextLevelAt, 100 * MIN);
  assert.equal(p.levelFrom, 70 * MIN);
  // Paused mid-level: the bar freezes at the pause, a third of the way through.
  const paused = liveProps(mk({ levelMinutes: 30, levelStartedAt: 60 * MIN, breaks: [{ start: 70 * MIN }] }), 70 * MIN);
  assert.equal((paused.pausedAt - paused.levelFrom) / (paused.nextLevelAt - paused.levelFrom), 1 / 3);
  // No level clock (cash, or no length): no bar.
  assert.equal(liveProps(mk({ kind: 'cash' }), 80 * MIN).levelFrom, 0);
});

test('lock-screen buttons: pause, resume and rebuy only for this session and only when they still apply', () => {
  const running = mk();
  const paused = mk({ breaks: [{ start: 10 * MIN }] });
  const p = liveProps(running, 20 * MIN);
  assert.equal(p.pauseUrl, 'sweatbook://session?do=pause&id=s');
  assert.equal(liveProps(paused, 20 * MIN).pauseUrl, 'sweatbook://session?do=resume&id=s');
  assert.equal(p.labels.rebuy, 'Re-entry');
  assert.equal(liveProps(mk({ kind: 'cash' }), 20 * MIN).labels.rebuy, 'Rebuy');
  // VoiceOver reads the "→ next blinds" line by name, not as an arrow.
  assert.equal(p.labels.nextBlinds, 'Blinds seguintes');
  assert.equal(lockAction('pause', 's', running), 'pause');
  assert.equal(lockAction('resume', 's', paused), 'resume');
  assert.equal(lockAction('rebuy', 's', running), 'rebuy');
  // An out-of-date banner: never the opposite of what it showed.
  assert.equal(lockAction('pause', 's', paused), null);
  assert.equal(lockAction('resume', 's', running), null);
  // Another session, an ended one, no id or an unknown action: nothing.
  assert.equal(lockAction('rebuy', 'other', running), null);
  assert.equal(lockAction('rebuy', 's', mk({ endedAt: 1 })), null);
  assert.equal(lockAction('rebuy', undefined, running), null);
  assert.equal(lockAction('delete', 's', running), null);
});

test('Android lock-screen ask: once per running session, never on iOS or for an ended session', () => {
  const asked = new Set<string>();
  assert.equal(askForLockScreen('ios', { id: 'a' }, asked), false);
  assert.equal(askForLockScreen('android', { id: 'a', endedAt: 1 }, asked), false);
  assert.equal(askForLockScreen('android', { id: 'a' }, asked), true);
  assert.equal(askForLockScreen('android', { id: 'a' }, asked), false);
  assert.equal(askForLockScreen('android', { id: 'b' }, asked), true);
});

test('Android lock-screen ask: the preview is the notification line, with privacy mode', () => {
  const s = mk({ kind: 'cash', name: 'Casino Lisboa', stack: 500, sb: 1, bb: 2 });
  const shown = sessionNoticePreview(s, 0);
  assert.equal(shown.title, 'Casino Lisboa');
  assert.match(shown.body, /500 · 1\/2$/);
  const hidden = sessionNoticePreview(s, 0, true);
  assert.equal(hidden.title, 'Cash game');
  assert.match(hidden.body, /••• · 1\/2$/);
});

test('in-place lock-screen actions: pause and resume only, targets carry the session', () => {
  const running = mk({ stackLog: [{ t: 0, stack: 30000, level: 1 }] });
  const p = liveProps(running, 20 * MIN, false, true);
  assert.equal(p.inPlace, true);
  assert.equal(liveProps(running, 20 * MIN).inPlace, false);
  assert.deepEqual(parseTarget(p.pauseTarget), { what: 'pause', id: 's' });
  // A rebuy moves money: never a target, always a link into the app (with «Anular» there).
  assert.ok(!Object.values(p).some((v) => typeof v === 'string' && v.startsWith('rebuy:')));
  assert.equal(p.rebuyUrl, 'sweatbook://session?do=rebuy&id=s');
  assert.deepEqual(lockActionPatch(running, 'pause', 5 * MIN).breaks, [{ start: 5 * MIN }]);
  const paused = mk({ breaks: [{ start: 5 * MIN }] });
  assert.deepEqual(lockActionPatch(paused, 'resume', 9 * MIN).breaks, [{ start: 5 * MIN, end: 9 * MIN }]);
});

test('"end" from the lock screen: opens the end form for this running session only, never in place', () => {
  const running = mk();
  const p = liveProps(running, 20 * MIN, false, true);
  assert.equal(p.endUrl, 'sweatbook://session?do=end&id=s');
  assert.equal(p.labels.end, 'Terminar sessão');
  assert.equal(lockAction('end', 's', running), 'end');
  assert.equal(lockAction('end', 's', mk({ breaks: [{ start: 10 * MIN }] })), 'end');
  assert.equal(lockAction('end', 'other', running), null);
  assert.equal(lockAction('end', 's', mk({ endedAt: 1 })), null);
  // No in-place target for it: an "end:" target from a button would be ignored by the listener.
  assert.ok(!Object.values(p).some((v) => typeof v === 'string' && v.startsWith('end:')));
});

test('PLO: the session takes the game of its latest hand, and the lock screen puts it on the blinds label', () => {
  const h = (sessionId: string, createdAt: number, variant?: 'plo') => ({ sessionId, createdAt, game: variant ? { variant } : {} });
  assert.equal(sessionPLO([], 's'), false);
  assert.equal(sessionPLO([h('s', 1, 'plo'), h('s', 2)], 's'), false);
  assert.equal(sessionPLO([h('s', 2, 'plo'), h('s', 1)], 's'), true);
  // Another session's PLO hand doesn't count.
  assert.equal(sessionPLO([h('s', 1), h('t', 5, 'plo')], 's'), false);

  const mtt = liveProps(mk(), 0, false, false, true);
  assert.equal(mtt.game, 'PLO');
  assert.equal(mtt.gameLevel, 'PLO · ' + mtt.level);
  // The blinds keep their width: PLO goes on the label only.
  assert.equal(mtt.blinds, liveProps(mk(), 0).blinds);
  const cash = liveProps(mk({ kind: 'cash', level: undefined, sb: 1, bb: 2 }), 0, false, false, true);
  assert.equal(cash.gameLevel, 'PLO');
  // Hold'em: as before.
  const holdem = liveProps(mk(), 0);
  assert.equal(holdem.game, '');
  assert.equal(holdem.gameLevel, holdem.level);
});
