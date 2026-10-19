// Renders the Google Play feature graphic (1024×500) in every store language.
// Usage: node feature-graphic.mjs <outDir>   (needs `playwright`; run from store/screenshots)
// Icon: assets/images/icon.png (the orange app icon); font: web/src/fonts (Hanken Grotesk).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [outDir = 'final/android'] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const TAGLINE = {
  pt: 'Regista mãos de póquer live em segundos',
  en: 'Log live poker hands in seconds',
  'pt-BR': 'Registre mãos de poker ao vivo em segundos',
  es: 'Registra manos de póker en vivo en segundos',
};

const b64 = (p) => fs.readFileSync(path.join(root, p)).toString('base64');
const icon = b64('assets/images/icon.png');
const font = (w, f) => `@font-face{font-family:H;font-weight:${w};src:url(data:font/woff2;base64,${b64('web/src/fonts/' + f)})}`;

// Everything sits inside Play's safe area (15% in from each edge).
const html = (tagline) => `<!doctype html><meta charset="utf-8"><style>
${font(500, 'HankenGrotesk_500Medium.woff2')}${font(800, 'HankenGrotesk_800ExtraBold.woff2')}
html,body{margin:0;width:1024px;height:500px;overflow:hidden}
body{background:radial-gradient(ellipse 60% 45% at 50% 108%,rgba(255,106,61,.28),transparent 70%),#0C1311;
  font-family:H,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0}
img{width:136px;height:136px;border-radius:30px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
h1{margin:22px 0 0;font-size:92px;font-weight:800;letter-spacing:-.035em;line-height:1;color:#F4F1EA}
h1 span{color:#FF6A3D}
p{margin:18px 0 0;font-size:30px;font-weight:500;color:#D9D4C9}
</style><img src="data:image/png;base64,${icon}"><h1>Sweat<span>book</span></h1><p>${tagline}</p>`;

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
fs.mkdirSync(outDir, { recursive: true });
for (const [lang, tagline] of Object.entries(TAGLINE)) {
  await page.setContent(html(tagline));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, `feature-graphic-${lang}.png`) });
}
await browser.close();
