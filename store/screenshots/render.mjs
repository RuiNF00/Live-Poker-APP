// Renders store screenshots from the app's web build.
// Usage: node render.mjs <appUrl> <outDir>   (needs `playwright`; see README in store/screenshots.md)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import * as seed from './seed.mjs';

const [appUrl = 'http://localhost:4173', outDir = 'out'] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const frames = JSON.parse(fs.readFileSync(path.join(here, 'frames.json'), 'utf8'));
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

// Output sizes: App Store 6.9" and Google Play phone (Play caps the aspect ratio at 2:1).
const TARGETS = [
  { store: 'ios', w: 1320, h: 2868 },
  { store: 'android', w: 1080, h: 1920 },
];
const BG = '#0C1311', ACCENT = '#FF6A3D';

const browser = await chromium.launch({ executablePath: exe });

async function capture(locale) {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, locale });
  await ctx.addInitScript((s) => {
    if (localStorage.getItem('rl.hands.v1')) return;
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, { 'rl.hands.v1': seed.hands, 'rl.sessions.v1': seed.sessions, 'rl.players.v1': seed.players, 'rl.settings.v1': seed.settings, 'rl.offer.welcome.v1': '1', 'sweatbook.replayer.tips.v1': '1' });
  const page = await ctx.newPage();
  const shots = [];
  for (const f of frames) {
    // Opening the hand editor leaves a draft banner on other screens; clear it.
    // rl.offer.welcome.v1 and sweatbook.replayer.tips.v1 (seeded above) stop the one-time welcome paywall
    // and the replayer's first-open tip from covering their frames.
    await page.evaluate(() => localStorage.removeItem('rl.draft.v1')).catch(() => {});
    await page.goto(appUrl + f.route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    shots.push((await page.screenshot()).toString('base64'));
  }
  await ctx.close();
  return shots;
}

function html(lines, shot, t) {
  const shotW = Math.round(t.w * 0.78), capSize = Math.round(t.w * 0.075);
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@700;800&display=block" rel="stylesheet">
<style>
html,body{margin:0;width:${t.w}px;height:${t.h}px;background:${BG};overflow:hidden}
body{display:flex;flex-direction:column;align-items:center;font-family:'Hanken Grotesk',system-ui,sans-serif;
 background:radial-gradient(120% 60% at 50% 0%, rgba(255,106,61,.22), transparent 60%), ${BG}}
h1{color:#F4F1EC;font-weight:800;font-size:${capSize}px;line-height:1.08;text-align:center;letter-spacing:-.02em;margin:${Math.round(t.h*0.055)}px 0 ${Math.round(t.h*0.035)}px}
h1 span{color:${ACCENT}}
.phone{width:${shotW}px;border-radius:${Math.round(shotW*0.09)}px;overflow:hidden;border:${Math.round(t.w*0.008)}px solid #26302C;
 box-shadow:0 ${Math.round(t.w*0.03)}px ${Math.round(t.w*0.08)}px rgba(0,0,0,.55)}
.phone img{display:block;width:100%}
</style></head><body><h1>${lines[0]}<br><span>${lines[1]}</span></h1>
<div class="phone"><img src="data:image/png;base64,${shot}"></div></body></html>`;
}

for (const [locale, key] of [['pt-PT', 'pt'], ['en-US', 'en']]) {
  const shots = await capture(locale);
  for (const t of TARGETS) {
    const dir = path.join(outDir, t.store, key);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (let i = 0; i < frames.length; i++) {
      await page.setContent(html(frames[i][key], shots[i], t), { waitUntil: 'networkidle' });
      await page.screenshot({ path: path.join(dir, `${i + 1}.png`) });
    }
    await ctx.close();
  }
}
await browser.close();
console.log('Screenshots written to', outDir);
