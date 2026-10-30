/// <reference types="node" />
// Taps that need the network, with no signal or a server that says no: nothing is lost in silence,
// nothing hangs without a word, and «Sem ligação» is only said when it is the reason.
// These screens and modules load React Native, so the checks read their code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const fn = (src: string, start: string) => {
  const i = src.indexOf(start);
  assert.ok(i >= 0, start);
  return src.slice(i, src.indexOf('\n}', i) > 0 ? src.indexOf('\n}', i) : undefined);
};

test('reports of a hand or a comment go through the outbox, and a refusal is not taken as sent', () => {
  const api = read('lib/share-api.ts');
  for (const f of ['export async function reportHand', 'export async function reportComment']) assert.match(fn(api, f), /if \(!res\.ok\) throw new Error\('report ' \+ res\.status\)/, f);
  const q = read('lib/share-queue.ts');
  assert.match(q, /registerSender\('hand-report'/);
  assert.match(q, /registerSender\('comment-report'/);
  assert.match(read('app/h/[id].tsx'), /queueHandReport\(id!, anonId\(\)\)/);
  assert.doesNotMatch(read('app/h/[id].tsx'), /reportHand\(/);
  assert.match(read('components/Comments.tsx'), /queueCommentReport\(shareId, id\)/);
  assert.doesNotMatch(read('components/Comments.tsx'), /reportComment\(/);
});

test('comment notices switched off without signal still reach the server, and switching on again cancels it', () => {
  const cp = read('lib/comment-push.ts');
  const off = fn(cp, 'export async function turnOffCommentPush');
  assert.match(off, /queueCommentPushOff\(/);
  assert.doesNotMatch(off, /send\(/);
  assert.match(fn(cp, 'export async function turnOnCommentPush'), /await cancelCommentPushOff\(h\.shareId\)/);
  assert.match(read('lib/share-queue.ts'), /registerSender\('comment-push-off'[\s\S]*return outcomeOf\(res\.status\);[\s\S]*return 'retry';/);
  // Kept until the server answers, like a delete.
  assert.match(read('lib/erase-core.ts'), /'comment-push-off'/);
});

test('«Enviar contas» says it is preparing, ignores no tap in silence, and says when it fails', () => {
  const s = read('app/staking/[id].tsx');
  assert.match(s, /setPreparing\(withYear \? 'year' : 'statement'\)/);
  assert.match(s, /catch \{\s*notice\(t\('Não deu para enviar as contas'\)/);
  assert.equal((s.match(/disabled=\{!!preparing\}/g) ?? []).length, 3);
});

test('the story link works like the hand screen: one public copy, queued without signal, the right message', () => {
  const s = read('app/story/[id].tsx');
  assert.match(s, /const slot = await takeDirectShare\(hand\.id\)/);
  assert.match(s, /queueShare\(linked, shareOptions\(settings\)\)/);
  assert.match(s, /'upload 422'/);
  assert.equal((s.match(/ensureShareId\(/g) ?? []).length, 1, 'every path goes through linkId');
  assert.doesNotMatch(s, /Precisamos de internet para criar o link/);
});

test('re-sending a festival package link that exists works offline: the terms follow by the outbox', () => {
  const s = read('app/action/[id].tsx');
  assert.match(s, /await updateAgreement\(remote, body\)\.catch\(\(e: unknown\) => \{\s*if \(!\(e instanceof OfferFailure\) \|\| e\.reason !== 'network'\) throw e;\s*queueAgreementUpdate\(remote!, body\);/);
});

test('a swap link opened without signal offers a retry instead of «não encontrado»', () => {
  for (const f of ['app/swap/[id].tsx', 'app/swap/g/[id].tsx']) {
    const s = read(f);
    assert.match(s, /\.catch\(\(\) => alive && setOffline\(true\)\)/, f);
    assert.match(s, /\[ready, own, id, k, attempt\]/, f);
    assert.match(s, /title=\{t\('Tentar outra vez'\)\} onPress=\{\(\) => \(setOffline\(false\), setAttempt/, f);
  }
});

test('a shared hand: comments that did not load and a vote that did not go are said', () => {
  const s = read('app/h/[id].tsx');
  assert.match(s, /setCommentsFailed\(true\)/);
  assert.match(s, /t\('Sem ligação: não deu para carregar os comentários\.'\)/);
  assert.doesNotMatch(s, /postComment\([^)]*\)[\s\S]{0,120}\.catch\(\(\) => \{\}\)/);
  assert.match(s, /t\('O teu voto não foi enviado'\)/);
});

test('the live backer link: a server refusal is not «Sem ligação», and a failed share sheet is not «not created»', () => {
  const s = read('components/staking/BackerLive.tsx');
  const create = fn(s, '  const create = async () => {');
  assert.match(create, /else if \(\/\^live \\d\+\$\/\.test/);
  assert.ok(create.indexOf('await shareLink(s, id)') > create.indexOf('} finally {'), 'shared after the try');
});

test('a new swap: a share sheet that fails after the create never queues a second create', () => {
  for (const [f, call] of [['app/swaps/new.tsx', 'if (made) await send(made.id'], ['app/swaps/group-new.tsx', 'if (made) await send(made.group.id']]) {
    const s = read(f);
    const i = s.indexOf(call);
    assert.ok(i > s.indexOf("code === 'offline'"), f);
  }
});
