/// <reference types="node" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

// Share images look the same whatever theme the phone is in: every card, poster
// or carousel laid out at story size paints with the dark palette, never the live `C`.
const DIR = path.join(__dirname, '..', 'components');

test('share images import DARK, not the live palette', () => {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => /(Card|Poster|Carousel)\.tsx$/.test(f))
    .filter((f) => /\bSTORY_[WH]\b/.test(fs.readFileSync(path.join(DIR, f), 'utf8')))
    // The mark and wordmark they draw, when they live apart from StoryCard (story-brand.tsx, from the lazy split).
    .concat(['story-brand.tsx'].filter((f) => fs.existsSync(path.join(DIR, f))));
  for (const f of ['FestivalPlanCard.tsx', 'HandPoster.tsx', 'StoryCard.tsx', 'YearCard.tsx']) assert.ok(files.includes(f), f);
  for (const f of files) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    const themeImport = src.match(/import \{([^}]*)\} from ['"]@\/theme['"]/);
    assert.ok(themeImport, `${f} imports from '@/theme'`);
    assert.match(themeImport[1], /\bDARK as C\b/, `${f} should import { DARK as C } from '@/theme'`);
  }
});
