import type { Locale } from '@/lib/i18n';

// Every public page ends with the support contact and a way to report it (App Store 1.2 / Play UGC:
// published contact and an in-page report). The report is an email with the page already named,
// so it reaches the same 24 h review as the in-page report buttons. Its body is the notice the EU
// Digital Services Act (art. 16(2)) asks for: the exact page, why, a name and a good-faith statement.
const SUPPORT = 'support@sweatbook.poker';

const COPY: Record<Locale, { help: string; report: string; subject: string; body: string[] }> = {
  pt: {
    help: 'Ajuda',
    report: 'Denunciar esta página',
    subject: 'Denúncia',
    body: ['Página', 'Porque é ilegal ou contrário aos Termos:', 'O teu nome:', 'Declaro de boa-fé que esta informação é exata e completa: sim', '(Se for abuso sexual de menores, o nome é opcional.)'],
  },
  'pt-BR': {
    help: 'Ajuda',
    report: 'Denunciar esta página',
    subject: 'Denúncia',
    body: ['Página', 'Por que é ilegal ou contra os Termos:', 'Seu nome:', 'Declaro de boa-fé que esta informação é exata e completa: sim', '(Se for abuso sexual de menores, o nome é opcional.)'],
  },
  es: {
    help: 'Ayuda',
    report: 'Denunciar esta página',
    subject: 'Denuncia',
    body: ['Página', 'Por qué es ilegal o contrario a los Términos:', 'Tu nombre:', 'Declaro de buena fe que esta información es exacta y completa: sí', '(Si se trata de abuso sexual de menores, el nombre es opcional.)'],
  },
  en: {
    help: 'Help',
    report: 'Report this page',
    subject: 'Report',
    body: ['Page', 'Why it is illegal or against the Terms:', 'Your name:', 'I declare in good faith that this information is accurate and complete: yes', '(If it concerns child sexual abuse, your name is optional.)'],
  },
};

/** The report email for `page`, the path without the host (live/abc123), which goes in it as is. */
export function reportMailto(locale: Locale, page: string): string {
  const c = COPY[locale];
  const [label, why, name, faith, minors] = c.body;
  const body = `${label}: https://sweatbook.poker/${page}\n\n${why}\n\n\n${name}\n\n${faith}\n${minors}\n`;
  return `mailto:${SUPPORT}?subject=${encodeURIComponent(`${c.subject}: ${page}`)}&body=${encodeURIComponent(body)}`;
}

export function PageFooter({ locale, page }: { locale: Locale; page: string }) {
  const c = COPY[locale];
  const mail = reportMailto(locale, page);
  return (
    <footer className="page-footer">
      <span>
        {c.help}: <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>
      </span>
      <a href={mail} rel="nofollow">
        {c.report}
      </a>
    </footer>
  );
}
