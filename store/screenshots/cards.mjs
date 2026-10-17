// Marketing share cards from the app's web build with demo data only (store/screenshots/seed.mjs).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import * as seed from './seed.mjs';
const [appUrl = 'http://localhost:4173', outDir = 'out'] = process.argv.slice(2);
const now = Date.now(), DAY = 86400000;
const swap = { id: 'Demo7Swap', token: 'a'.repeat(64), side: 'a', confirmedAt: now - 9 * DAY, confirmedName: 'Ana R.',
  terms: { v: 1, scope: 'series', title: 'Festival de dezembro', venue: '', currency: '$', a: { name: 'Hero', pct: 5 }, b: { name: 'Ana R.', pct: 5 }, note: '', createdAt: now - 10 * DAY },
  entries: [
    { id: 'e1', cid: 'c1', side: 'a', kind: 'result', event: '$25K High Roller', amount: 154000, finish: 3, at: now - 6 * DAY },
    { id: 'e2', cid: 'c2', side: 'b', kind: 'result', event: '$10K Turbo', amount: 41500, finish: 7, at: now - 4 * DAY },
    { id: 'e3', cid: 'c3', side: 'b', kind: 'payment', event: '', amount: 3000, finish: null, at: now - 2 * DAY },
  ], createdAt: now - 10 * DAY, updatedAt: now - 2 * DAY };
const items = [
  { name: 'mao-pergunta', route: '/story/h1' },
  { name: 'mao-resultado', route: '/story/h1', click: ['Resultado', 'Result'] },
  { name: 'sessao-valores-escondidos', route: '/session-card/s8', click: ['Esconder valores', 'Hide amounts'] },
  { name: 'torneio', route: '/tournament-card' },
  { name: 'festival', route: '/festival-card/t1' },
  { name: 'mes', route: '/month' },
  { name: 'swap', route: '/swap/Demo7Swap' },
  { name: 'planeador', route: '/festival' },
];
const hide = ['Abre a app no telemóvel', 'Open the app on your phone', 'Abra o app no celular', 'Abre la app en tu teléfono'];
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath: exe });
// LOCALES=pt-BR:pt-br,es-ES:es picks other languages (default pt-PT and en-US).
const LOCALES = (process.env.LOCALES ?? 'pt-PT:pt,en-US:en').split(',').map((x) => x.split(':'));
for (const [locale, key] of LOCALES) {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, locale });
  await ctx.addInitScript((s) => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /^rl\.coach\./.test(k) ? '1' : get.call(this, k); };
    if (localStorage.getItem('rl.hands.v1')) return;
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, { 'rl.hands.v1': seed.hands, 'rl.sessions.v1': seed.sessions, 'rl.players.v1': seed.players, 'rl.settings.v1': seed.settings, 'rl.offer.welcome.v1': '1', 'rl.trial.defer.v1': { shown: 1 }, 'sweatbook.replayer.tips.v1': '1', 'rl.trips.v1': seed.trips.map((x) => x.id), ...Object.fromEntries(seed.trips.map((x) => ['rl.trip.v1.' + x.id, x])), 'rl.backing.v1': seed.backing.map((x) => x.id), ...Object.fromEntries(seed.backing.map((x) => ['rl.backed.v1.' + x.id, x])), 'rl.start.hidden.v1': '1', 'rl.swaps.v1': [swap.id], ['rl.swap.v1.' + swap.id]: swap });
  const local = new URL(appUrl).origin;
  const remote = { id: swap.id, terms: swap.terms, confirmedAt: new Date(swap.confirmedAt).toISOString(), confirmedName: swap.confirmedName, entries: swap.entries, code: null, you: 'a', updatedAt: new Date(swap.updatedAt).toISOString() };
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(local)) return r.continue();
    if (u.includes('/api/swaps/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ swap: remote }) });
    return r.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage();
  const dir = path.join(outDir, key); fs.mkdirSync(dir, { recursive: true });
  for (const it of items) {
    await page.goto(appUrl + it.route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    for (const c of it.click ?? []) { const el = page.getByText(c, { exact: true }).first(); if (await el.count()) { await el.click().catch(() => {}); break; } }
    await page.waitForTimeout(600);
    for (const txt of hide) await page.evaluate((txt) => { for (const el of document.querySelectorAll('div')) if (el.childElementCount === 0 && el.textContent.includes(txt)) el.style.visibility = 'hidden'; }, txt);
    await page.screenshot({ path: path.join(dir, it.name + '.png') });
  }
  await ctx.close();
}
await browser.close();
console.log('done');
