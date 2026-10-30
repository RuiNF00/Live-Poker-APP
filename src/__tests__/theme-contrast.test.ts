/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { AVATAR_HUES, AVATAR_HUES_LIGHT, DARK, LIGHT, POS_LIGHT, type Palette } from '../theme';

type RGB = [number, number, number];

function parse(c: string): { rgb: RGB; a: number } {
  if (c.startsWith('#')) {
    const h = c.slice(1);
    return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB, a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  const [r, g, b, a] = c.replace(/rgba?\(|\)/g, '').split(',').map(Number);
  return { rgb: [r, g, b], a: a ?? 1 };
}

/** The colour seen when `c` (maybe translucent) sits on `under`. */
function over(c: string, under: RGB): RGB {
  const { rgb, a } = parse(c);
  return rgb.map((v, i) => v * a + under[i] * (1 - a)) as RGB;
}

function lum([r, g, b]: RGB) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function ratio(fg: string, bg: string, base = '#FFFFFF') {
  const b = over(bg, parse(base).rgb);
  const f = over(fg, b);
  const [hi, lo] = [lum(f), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['text', 'textDim', 'muted', 'accent', 'good', 'bad', 'danger', 'warn', 'info'] as const;
const GROUNDS = ['bg', 'surface', 'surface3'] as const;

for (const [name, P] of [['Noite', DARK], ['Dia', LIGHT]] as [string, Palette][]) {
  test(`${name}: every text colour is AA (4.5:1) on bg, surface and surface3`, () => {
    for (const fg of TEXT)
      for (const bg of GROUNDS) {
        const r = ratio(P[fg], P[bg], P.bg);
        // The dark theme's muted on surface3 and accent on surface3 were measured before at 4.7:1.
        assert.ok(r >= 4.5, `${fg} on ${bg}: ${r.toFixed(2)}:1`);
      }
  });

  test(`${name}: tinted badges keep their text AA`, () => {
    const pairs: [keyof Palette, keyof Palette][] = [
      ['accent', 'accentSoft'],
      ['good', 'goodSoft'],
      ['bad', 'badSoft'],
      ['danger', 'dangerSoft'],
      ['warn', 'warnSoft'],
      ['info', 'infoSoft'],
    ];
    for (const [fg, soft] of pairs) {
      // Tags sit on cards and straight on the screen (active chips at the bottom of a story screen).
      for (const base of ['bg', 'bgDeep', 'surface'] as const) {
        const ground = over(P[soft] as string, parse(P[base]).rgb);
        const hex = '#' + ground.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
        const r = ratio(P[fg] as string, hex);
        assert.ok(r >= 4.5, `${fg} on ${soft} over ${base}: ${r.toFixed(2)}:1`);
      }
    }
  });

  test(`${name}: button text and control outlines`, () => {
    assert.ok(ratio(P.accentInk, P.accent) >= 4.5, 'accentInk on accent');
    assert.ok(ratio(P.accentInk, P.accentPressed) >= 4.5, 'accentInk on accentPressed');
    for (const bg of ['bg', 'surface'] as const) {
      const r = ratio(P.fieldBorder, P[bg], P.bg);
      assert.ok(r >= 3, `fieldBorder on ${bg}: ${r.toFixed(2)}:1`);
    }
  });
}

test('suit ink reads on the cream card faces', () => {
  for (const face of ['#F6F2E8', '#F5EDD8']) {
    for (const [s, ink] of Object.entries(DARK.suit)) {
      const r = ratio(ink, face);
      assert.ok(r >= 4.5, `${s} on ${face}: ${r.toFixed(2)}:1`);
    }
  }
});

test('avatar initials read on their own tint', () => {
  for (const [hues, P] of [[AVATAR_HUES, DARK], [AVATAR_HUES_LIGHT, LIGHT]] as const) {
    for (const col of hues) {
      for (const ground of [P.bg, P.surface]) {
        const r = ratio(col, col + '26', ground);
        assert.ok(r >= 4.5, `${col} on its tint over ${ground}: ${r.toFixed(2)}:1`);
      }
    }
  }
});

test('light position badges read on their tint', () => {
  for (const [pos, col] of Object.entries(POS_LIGHT)) {
    for (const ground of [LIGHT.bg, LIGHT.surface, LIGHT.surface3]) {
      const r = ratio(col, col + '26', ground);
      assert.ok(r >= 4.5, `${pos} ${col} over ${ground}: ${r.toFixed(2)}:1`);
    }
  }
});

// Colours set inside components, checked against what they are drawn on (contraste-1a).
const src = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');
/** `fg` faded to `o` together with its ground `bg`, over `under` (a folded plate on the felt). */
const faded = (fg: string, bg: string, o: number, under: string) => {
  const u = parse(under).rgb;
  const hexOf = (c: RGB) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  return ratio(hexOf(over(fg, over(bg, u)).map((v, i) => v * o + u[i] * (1 - o)) as RGB), hexOf(over(bg, u).map((v, i) => v * o + u[i] * (1 - o)) as RGB));
};

test('share cards: the secondary ink on the orange is AA', () => {
  for (const f of ['components/YearCard.tsx', 'components/SessionCard.tsx', 'components/FestivalCard.tsx', 'components/MonthCard.tsx']) {
    const m = src(f).match(/rgba\(26,10,4,(0\.\d+)\)/);
    assert.ok(m, f);
    const r = ratio(`rgba(26,10,4,${m[1]})`, DARK.accent);
    assert.ok(r >= 4.5, `${f}: ${r.toFixed(2)}:1`);
  }
});

test('replayer: action badges, folded seats and the fold dot', () => {
  const t = src('components/replayer/ReplayerTable.tsx');
  for (const [, kind, bg, fg] of t.matchAll(/(\w+): \{ bg: '(#[0-9A-Fa-f]{3,6})', fg: '(#[0-9A-Fa-f]{3,6})' \}/g)) {
    const six = (h: string) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h);
    const r = ratio(six(fg), six(bg));
    assert.ok(r >= 4.5, `badge ${kind}: ${r.toFixed(2)}:1`);
  }
  // A folded plate is faded to 55% over the felt: its position pill goes grey with white text.
  assert.match(t, /s\.folded \? \{ bg: C\.surface3, fg: C\.text \}/);
  assert.ok(faded(DARK.text, DARK.surface3, 0.55, DARK.felt) >= 4.5);
  assert.ok(faded(DARK.text, '#0E0D0B', 0.55, DARK.felt) >= 4.5, 'folded name');
  // The entry table fades a folded plate to 60%: its position text turns white.
  assert.match(src('components/Table.tsx'), /styles\.posText, s\.folded && \{ color: C\.text \}/);
  assert.ok(faded(DARK.text, DARK.surface3, 0.6, DARK.felt) >= 4.5);
  // Timeline: the fold grey is the muted text colour, and steps ahead of the cursor fade the dot, not the text.
  const r = src('components/Replayer.tsx');
  assert.match(r, /fold: C\.muted, street: '#F5EDD8'/);
  assert.match(r, /opacity: future \? 0\.25 : 1 \}\}>/);
  assert.match(r, /color: idx > at \? C\.muted : street/);
});

test('month recap: a result never reads from colour alone', () => {
  const m = src('app/month.tsx');
  // Bars are the size of the result either way: a losing month is outlined, like the calendar.
  assert.match(m, /h\.profit < 0 \? \{ borderWidth: 2, borderColor: C\.bad \} : null/);
  // «This month / the average» has no sign: an arrow and the spoken «melhor» / «pior» say which way.
  assert.match(m, /<Diff\s+trend\s/);
  assert.match(m, /name=\{d > 0 \? 'caret-up' : 'caret-down'\}/);
  assert.match(m, /d > 0 \? t\('melhor'\) : t\('pior'\)/);
});
