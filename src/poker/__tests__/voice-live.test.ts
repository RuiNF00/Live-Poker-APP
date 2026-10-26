/// <reference types="node" />
// Live session updates by voice: what players say between hands, in pt-PT,
// pt-BR, Spanish and English, must make the changes the screen's buttons make.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Session } from '../../store/types';
import { applyLive, liveChanges, type LiveChange } from '../voice-live';

const mtt = (p: Partial<Session> = {}): Session =>
  ({
    id: 's1', kind: 'mtt', name: 'Main', venue: '', currency: '€', startedAt: 0, breaks: [], buyIn: 300, entries: 1, addOn: 0, cashOut: 0,
    sb: 500, bb: 1000, ante: 1000, anteType: 'bb', level: 8, tableSize: 9, stack: 40000, stackLog: [{ t: 0, stack: 30000, level: 1 }], roster: [], notes: '',
    tourney: { startStack: 30000 },
    ...p,
  }) as Session;

const CASES: [string, LiveChange[]][] = [
  // pt-PT
  ['Stack 45 mil', [{ k: 'stack', v: 45000 }]],
  ['Nível 12, stack 45 mil', [{ k: 'level', v: 12 }, { k: 'stack', v: 45000 }]],
  ['Tenho 38 mil', [{ k: 'stack', v: 38000 }]],
  ['Estou com 30 bb', [{ k: 'stack', v: 30, inBB: true }]],
  ['Subiu o nível', [{ k: 'levelStep', dir: 1 }]],
  ['Restam 80', [{ k: 'left', v: 80 }]],
  ['130 inscritos', [{ k: 'entries', v: 130 }]],
  ['Blinds 1000/2000 ante 2000', [{ k: 'blinds', sb: 1000, bb: 2000, ante: 2000 }]],
  ['Rebuy', [{ k: 'rebuy' }]],
  ['Re-entry, stack 40 mil', [{ k: 'rebuy' }, { k: 'stack', v: 40000 }]],
  ['Vamos para o intervalo', [{ k: 'pause' }]],
  // Dictation without commas, stacks said loosely, the break as a time (QA Instagram).
  ['Nível 12 blinds 600 1200', [{ k: 'level', v: 12 }, { k: 'blinds', sb: 600, bb: 1200 }]],
  ['Estou short, 8 bb', [{ k: 'stack', v: 8, inBB: true }]],
  ['Voy con 30 mil', [{ k: 'stack', v: 30000 }]],
  ['Fui ao bar no intervalo', []],
  ['No intervalo comi', []],
  ['Estou no intervalo', [{ k: 'pause' }]],
  ["We're on a break", [{ k: 'pause' }]],
  ['Voltei', [{ k: 'resume' }]],
  ['Depois do intervalo, nível 10', [{ k: 'level', v: 10 }]],
  ['Stack de 45 mil e restam 120 jogadores. Nota: mesa difícil', [{ k: 'stack', v: 45000 }, { k: 'left', v: 120 }, { k: 'note', text: 'mesa difícil' }]],
  ['52.500', [{ k: 'stack', v: 52500 }]],
  ['quarenta e cinco mil', [{ k: 'stack', v: 45000 }]],
  // Spoken corrections keep the last value; a negated word makes no change.
  ['Stack 45 mil, não, 47 mil', [{ k: 'stack', v: 47000 }]],
  ['Restam 80, não, 78', [{ k: 'left', v: 78 }]],
  ['Stack 45 mil e não há pausa', [{ k: 'stack', v: 45000 }]],
  ['Estou no intervalo', [{ k: 'pause' }]],
  ['Não fiz o add-on', []],
  // pt-BR
  ['Sem rebuy, stack 25 mil', [{ k: 'stack', v: 25000 }]],
  ['Tô com 52 mil, nível 14', [{ k: 'stack', v: 52000 }, { k: 'level', v: 14 }]],
  ['Fiz rebuy', [{ k: 'rebuy' }]],
  ['Fiz o add-on', [{ k: 'addon' }]],
  ['Sobraram 45 jogadores', [{ k: 'left', v: 45 }]],
  ['Uns 45 mil', [{ k: 'stack', v: 45000 }]],
  ['Faltam 45 jogadores', [{ k: 'left', v: 45 }]],
  // es
  ['Tengo 30000, perdón, 32000', [{ k: 'stack', v: 32000 }]],
  ['No hay descanso, nivel 9', [{ k: 'level', v: 9 }]],
  ['Tengo 45 mil, nivel 12', [{ k: 'stack', v: 45000 }, { k: 'level', v: 12 }]],
  ['Quedan 80 jugadores', [{ k: 'left', v: 80 }]],
  ['Nivel 9, ciegas 400/800 ante 800', [{ k: 'level', v: 9 }, { k: 'blinds', sb: 400, bb: 800, ante: 800 }]],
  ['Hice recompra', [{ k: 'rebuy' }]],
  ['Nivel siguiente', [{ k: 'levelStep', dir: 1 }]],
  ['Mis fichas: cuarenta mil', [{ k: 'stack', v: 40000 }]],
  ['Apunta: el del asiento 4 paga todo', [{ k: 'note', text: 'el del asiento 4 paga todo' }]],
  // en
  ['My stack is 40k, sorry, 42k', [{ k: 'stack', v: 42000 }]],
  ['I did not rebuy, stack 20k', [{ k: 'stack', v: 20000 }]],
  ['No rebuy', []],
  ['I have 45k, level 12', [{ k: 'stack', v: 45000 }, { k: 'level', v: 12 }]],
  ['Level up', [{ k: 'levelStep', dir: 1 }]],
  ['Stack is 61,500', [{ k: 'stack', v: 61500 }]],
  ['80 players left', [{ k: 'left', v: 80 }]],
  ['On break', [{ k: 'pause' }]],
  ['Note: seat 3 shows down light', [{ k: 'note', text: 'seat 3 shows down light' }]],
];

test('what players say between hands', () => {
  const wrong = CASES.filter(([text, want]) => JSON.stringify(liveChanges(text)) !== JSON.stringify(want)).map(([text]) => `${text} → ${JSON.stringify(liveChanges(text))}`);
  assert.deepEqual(wrong, []);
});

test('nothing understood: no change', () => {
  for (const text of ['', 'olá', 'what a cooler', 'ele tinha ases outra vez']) assert.deepEqual(liveChanges(text), [], text);
});

test('a new stack goes on the chart, at the level said with it', () => {
  const p = applyLive(mtt(), liveChanges('Nível 12, stack 45 mil'), 99);
  assert.equal(p.stack, 45000);
  assert.equal(p.level, 12);
  assert.deepEqual(p.stackLog?.at(-1), { t: 99, stack: 45000, level: 12 });
});

test('stack in big blinds uses the blinds said in the same breath', () => {
  const p = applyLive(mtt(), liveChanges('blinds 1000/2000, tenho 25 bb'), 1);
  assert.equal(p.bb, 2000);
  assert.equal(p.stack, 50000);
});

test('a tournament rebuy is a fresh starting stack and one more entry, like the button', () => {
  const p = applyLive(mtt(), [{ k: 'rebuy' }], 5);
  assert.equal(p.entries, 2);
  assert.equal(p.stack, 30000);
  // Cash: the buy-in goes on top of the stack.
  const c = applyLive(mtt({ kind: 'cash', buyIn: 200, stack: 150 }), [{ k: 'rebuy' }], 5);
  assert.equal(c.stack, 350);
});

test('the level follows the structure when there is one', () => {
  const structure = [1, 2, 3, 4].map((n) => ({ sb: n * 100, bb: n * 200, ante: n * 200, minutes: 30 }));
  const p = applyLive(mtt({ tourney: { structure } }), [{ k: 'level', v: 3 }]);
  assert.deepEqual([p.level, p.sb, p.bb, p.ante], [3, 300, 600, 600]);
  // Without one only the number changes.
  assert.deepEqual(applyLive(mtt({ tourney: undefined }), [{ k: 'level', v: 3 }]), { level: 3 });
});

test('pause and resume only when it changes something; players left on the tournament', () => {
  assert.equal(applyLive(mtt(), [{ k: 'pause' }], 7).breaks?.length, 1);
  assert.deepEqual(applyLive(mtt(), [{ k: 'resume' }], 7), {});
  const paused = mtt({ breaks: [{ start: 3 }] });
  assert.deepEqual(applyLive(paused, [{ k: 'resume' }], 7).breaks, [{ start: 3, end: 7 }]);
  assert.equal(applyLive(mtt(), [{ k: 'left', v: 80 }]).tourney?.left, 80);
  assert.deepEqual(applyLive(mtt({ kind: 'cash' }), [{ k: 'left', v: 80 }]), {});
});

test('a note goes under the ones already there; only what changed comes back', () => {
  const p = applyLive(mtt({ notes: 'mesa lenta' }), [{ k: 'note', text: 'seat 3 agressivo' }]);
  assert.deepEqual(p, { notes: 'mesa lenta\nseat 3 agressivo' });
});
