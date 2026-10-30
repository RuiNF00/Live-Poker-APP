import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/lib/i18n';
import { siteImage } from '@/lib/site-image';

describe('site link preview', () => {
  it.each(LOCALES)('%s gets its own image, so a cached copy never answers in another language', (l) => {
    expect(siteImage(l)).toEqual({ url: `/og/site?lang=${l}`, width: 1200, height: 630, alt: 'Sweatbook' });
  });
});
