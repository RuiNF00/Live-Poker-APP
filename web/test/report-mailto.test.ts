import { describe, expect, it } from 'vitest';

import { reportMailto } from '../src/components/PageFooter';

const body = (href: string) => decodeURIComponent(new URL(href).searchParams.get('body') ?? '');

describe('the report email is a complete notice (DSA art. 16(2))', () => {
  it('names the exact page and asks why, for a name and the good-faith statement', () => {
    const href = reportMailto('pt', 'h/abc123');
    expect(href.startsWith('mailto:support@sweatbook.poker?subject=')).toBe(true);
    const b = body(href);
    expect(b).toContain('Página: https://sweatbook.poker/h/abc123');
    expect(b).toContain('Porque é ilegal ou contrário aos Termos:');
    expect(b).toContain('O teu nome:');
    expect(b).toContain('Declaro de boa-fé');
  });

  it('is in every site language', () => {
    expect(body(reportMailto('pt-BR', 'u/ana'))).toContain('Seu nome:');
    expect(body(reportMailto('es', 'u/ana'))).toContain('Declaro de buena fe');
    expect(body(reportMailto('en', 'u/ana'))).toContain('I declare in good faith');
  });
});
