// Renders store screenshots from the app's web build.
// Usage: node render.mjs <appUrl> <outDir>   (needs `playwright`; see README in store/screenshots.md)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import * as seed from './seed.mjs';

const [appUrl = 'http://localhost:4173', outDir = 'out'] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const frames = JSON.parse(fs.readFileSync(path.join(here, 'frames.json'), 'utf8'));
// ONLY=2,5 renders just those frames (1-based), each still written as <its number>.png.
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;
const picked = frames.map((f, i) => ({ f, n: i + 1 })).filter(({ n }) => !only || only.has(n));
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

// Output sizes: App Store 6.9" and 6.5", and Google Play phone (Play caps the aspect ratio at 2:1).
const TARGETS = [
  { store: 'ios', w: 1320, h: 2868 },
  { store: 'ios-6.5', w: 1284, h: 2778 },
  { store: 'android', w: 1080, h: 1920 },
];
const BG = '#0C1311', ACCENT = '#F45A27'; // brand orange for the frame; the app's own #FF6A3D stays inside the screens

const browser = await chromium.launch({ executablePath: exe });

async function capture(locale, key) {
  const map = seed.typed[key] ?? {};
  const tr = (v) => (typeof v === 'string' ? map[v] ?? v : Array.isArray(v) ? v.map(tr) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tr(x)])) : v);
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, locale });
  await ctx.addInitScript((s) => {
    // One-time coach-mark tours (rl.coach.<screen>.v1) would cover their screens: report every one as seen.
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /^rl\.coach\./.test(k) ? '1' : get.call(this, k); };
    // Seed once per context: newer builds migrate rl.hands.v1 away, so it can't be the marker.
    if (localStorage.getItem('shots.seeded')) return;
    localStorage.setItem('shots.seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, tr({ 'rl.hands.v1': seed.hands, 'rl.sessions.v1': seed.sessions, 'rl.players.v1': seed.players, 'rl.settings.v1': seed.settings, 'rl.offer.welcome.v1': '1', 'rl.trial.defer.v1': { shown: 1 }, 'sweatbook.replayer.tips.v1': '1', 'rl.trips.v1': seed.trips.map((x) => x.id), ...Object.fromEntries(seed.trips.map((x) => ['rl.trip.v1.' + x.id, x])), 'rl.backing.v1': seed.backing.map((x) => x.id), ...Object.fromEntries(seed.backing.map((x) => ['rl.backed.v1.' + x.id, x])), 'rl.start.hidden.v1': '1' }));
  // The sandbox has no route to the backend, so the app would show its
  // "no signal" pill on every frame. Answer every outside request with an
  // empty 204: the app sees itself online, as on a phone with signal.
  const local = new URL(appUrl).origin;
  await ctx.route('**/*', (r) => (r.request().url().startsWith(local) ? r.continue() : r.fulfill({ status: 204, body: '' })));
  const page = await ctx.newPage();
  // The seed is dated at seed.now; run the clock from there so session timers and "yesterday" match it.
  await page.clock.install({ time: seed.now });
  const shots = [];
  for (const { f } of picked) {
    // Opening the hand editor leaves a draft banner on other screens; clear it.
    // rl.offer.welcome.v1 and sweatbook.replayer.tips.v1 (seeded above) stop the one-time welcome paywall
    // and the replayer's first-open tip from covering their frames.
    await page.evaluate(() => localStorage.removeItem('rl.draft.v1')).catch(() => {});
    // `hideAmounts`: store art shows no money, so these frames turn on the app's own "Hide amounts" setting.
    await page.evaluate((on) => {
      const s = JSON.parse(localStorage.getItem('rl.settings.v1') || '{}');
      localStorage.setItem('rl.settings.v1', JSON.stringify({ ...s, hideAmounts: on }));
    }, !!f.hideAmounts).catch(() => {});
    await page.goto(appUrl + f.route.split('#')[0], { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    // A frame can open something first: tap the button whose label matches `act.click`, then type `act.fill` (per language) into the sheet's text box.
    if (f.act) {
      // `act.pro`: this frame shows a Pro screen, so turn on the screenshot build's Pro just for it (dev-pro.ts).
      if (f.act.pro) {
        await page.evaluate(() => localStorage.setItem('sweatbook.devPro', '1'));
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
      }
      // A real pointer tap: react-native-web's Pressable ignores a synthetic element.click().
      await page.getByText(new RegExp(f.act.click, 'i')).first().click();
      await page.waitForTimeout(1500);
      if (f.act.fill) {
        const box = page.locator('textarea').last();
        await box.fill(f.act.fill[key] ?? f.act.fill.en);
        await box.blur();
        await page.waitForTimeout(1200);
      }
    }
    // Web-only hints (e.g. "open the app on your phone to post") don't exist on the phone; hide them.
    for (const txt of f.hide ?? []) {
      await page.evaluate((txt) => {
        for (const el of document.querySelectorAll('div')) if (el.childElementCount === 0 && el.textContent.includes(txt)) el.style.visibility = 'hidden';
      }, txt);
    }
    // Elements that must not appear in store art at all (e.g. the "Won/Lost" filter chips): remove the
    // whole control so the row closes up instead of leaving a gap.
    for (const txt of f.drop ?? []) {
      await page.evaluate((txt) => {
        for (const el of document.querySelectorAll('div')) {
          if (el.childElementCount !== 0 || el.textContent.trim() !== txt) continue;
          // A plain chip is a one-child pill around the text: hide the pill, not just the label.
          (el.closest('[role="button"],[tabindex]') ?? (el.parentElement?.childElementCount === 1 ? el.parentElement : el)).style.display = 'none';
        }
      }, txt);
    }
    // Text to cut out of a line without hiding the rest (e.g. a share domain); a [from, to] pair rewrites it instead.
    for (const txt of f.strip ?? []) {
      await page.evaluate((entry) => {
        const [txt, to] = Array.isArray(entry) ? entry : [entry, ''];
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue.includes(txt)) n.nodeValue = n.nodeValue.replace(txt, to);
      }, txt);
    }
    // Example text inside inputs (placeholders) that must not appear in store art: swap it for the frame's own.
    for (const [txt, by] of Object.entries(f.placeholder ?? {})) {
      await page.evaluate(([txt, rep]) => {
        for (const el of document.querySelectorAll('input,textarea')) if (el.placeholder?.includes(txt)) el.placeholder = rep;
      }, [txt, by[key] ?? by.en]);
    }
    shots.push((await page.screenshot()).toString('base64'));
    if (f.act?.pro) await page.evaluate(() => localStorage.removeItem('sweatbook.devPro'));
  }
  await ctx.close();
  return shots;
}

function html(f, key, shot, t) {
  const lines = f[key], sub = f.sub?.[key];
  const capSize = Math.round(t.w * 0.075), subSize = Math.round(t.w * 0.03);
  // The phone keeps the screen's 440×956 shape; on the shorter Android canvas it shrinks so the bottom
  // of the screen (the locked voice button, "See with Pro") isn't cut off.
  const top = t.h * 0.09 + capSize * 2.2 + (sub ? subSize * 2 : 0);
  const shotW = Math.round(Math.min(t.w * 0.78, ((t.h - top - t.h * 0.02) * 440) / 956));
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@700;800&display=block" rel="stylesheet">
<style>
html,body{margin:0;width:${t.w}px;height:${t.h}px;background:${BG};overflow:hidden}
body{display:flex;flex-direction:column;align-items:center;font-family:'Hanken Grotesk',system-ui,sans-serif;
 background:radial-gradient(120% 60% at 50% 0%, rgba(244,90,39,.22), transparent 60%), ${BG}}
h1{color:#F4F1EC;font-weight:800;font-size:${capSize}px;line-height:1.08;text-align:center;letter-spacing:-.02em;margin:${Math.round(t.h*0.055)}px 0 ${Math.round(t.h*0.035)}px}
h1 span{color:${ACCENT}}
h1 em{font-style:normal;font-size:.42em;vertical-align:.55em;margin-left:.3em;padding:.12em .45em;border-radius:.5em;background:${ACCENT};color:#0C1311;letter-spacing:0}
p.sub{color:#B9C2BE;font-weight:700;font-size:${subSize}px;text-align:center;margin:-${Math.round(t.h*0.02)}px ${Math.round(t.w*0.08)}px ${Math.round(t.h*0.025)}px}
.phone{width:${shotW}px;border-radius:${Math.round(shotW*0.09)}px;overflow:hidden;border:${Math.round(t.w*0.008)}px solid #26302C;
 box-shadow:0 ${Math.round(t.w*0.03)}px ${Math.round(t.w*0.08)}px rgba(0,0,0,.55)}
.phone img{display:block;width:100%}
</style></head><body><h1>${lines[0]}<br><span>${lines[1]}</span>${f.badge ? `<em>${f.badge}</em>` : ''}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}
<div class="phone"><img src="data:image/png;base64,${shot}"></div></body></html>`;
}

for (const [locale, key] of [['pt-PT', 'pt'], ['en-US', 'en'], ['pt-BR', 'pt-BR'], ['es-ES', 'es']]) {
  const shots = await capture(locale, key);
  for (const t of TARGETS) {
    const dir = path.join(outDir, t.store, key);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (let i = 0; i < picked.length; i++) {
      await page.setContent(html(picked[i].f, key, shots[i], t), { waitUntil: 'networkidle' });
      await page.screenshot({ path: path.join(dir, `${picked[i].n}.png`) });
    }
    await ctx.close();
  }
}
await browser.close();
console.log('Screenshots written to', outDir);
