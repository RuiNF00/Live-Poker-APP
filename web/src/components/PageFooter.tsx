import type { Locale } from '@/lib/i18n';

// Every public page ends with the support contact and a way to report it (App Store 1.2 / Play UGC:
// published contact and an in-page report). The report is an email with the page already named,
// so it reaches the same 24 h review as the in-page report buttons.
const SUPPORT = 'support@sweatbook.poker';

const COPY: Record<Locale, { help: string; report: string; subject: string; body: string }> = {
  pt: { help: 'Ajuda', report: 'Denunciar esta página', subject: 'Denúncia', body: 'Página' },
  'pt-BR': { help: 'Ajuda', report: 'Denunciar esta página', subject: 'Denúncia', body: 'Página' },
  es: { help: 'Ayuda', report: 'Denunciar esta página', subject: 'Denuncia', body: 'Página' },
  en: { help: 'Help', report: 'Report this page', subject: 'Report', body: 'Page' },
};

/** `page` is the path without the host (live/abc123): it goes in the report email as is. */
export function PageFooter({ locale, page }: { locale: Locale; page: string }) {
  const c = COPY[locale];
  const mail = `mailto:${SUPPORT}?subject=${encodeURIComponent(`${c.subject}: ${page}`)}&body=${encodeURIComponent(`${c.body}: https://sweatbook.poker/${page}\n\n`)}`;
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
