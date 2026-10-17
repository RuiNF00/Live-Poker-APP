// "Enviar ao suporte" for an import that didn't work: what the email says
// next to the file. Only what helps support import it by hand (the app
// version, the phone, which app it looks like and why rows were left out),
// never anything else from the player's Sweatbook. Pure, so it can be tested.

import type { FailedRow, FailReason } from './convert';
import type { SourceId } from './mapping';

export interface SupportCase {
  /** The file as the player picked it. */
  fileName: string;
  text: string;
  /** What the app made of it ('unreadable' when it couldn't open it at all). */
  source: SourceId | 'unreadable';
  rows: number;
  read: number;
  failed: FailedRow[];
  version: string;
  platform: string;
}

/** "sweatbook-importacao-pbt.csv": the attachment's name, keeping the file's own extension. */
export function attachmentName(c: Pick<SupportCase, 'fileName' | 'source'>): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(c.fileName)?.[1]?.toLowerCase() ?? 'csv';
  return `sweatbook-importacao-${c.source}.${ext}`;
}

export function supportEmail(c: SupportCase): { subject: string; body: string } {
  const why = new Map<FailReason, number>();
  for (const f of c.failed) why.set(f.reason, (why.get(f.reason) ?? 0) + 1);
  const lines = [
    'Olá, a importação deste ficheiro não correu bem. Podem ajudar?',
    '',
    '---',
    `Ficheiro: ${attachmentName(c)} (${c.rows} linhas)`,
    `Formato detetado: ${c.source}`,
    `Sessões lidas: ${c.read}`,
    c.failed.length ? `Linhas de fora: ${c.failed.length} (${[...why].map(([r, n]) => `${r} ${n}`).join(', ')})` : '',
    c.failed.length ? `Primeiras linhas de fora: ${c.failed.slice(0, 5).map((f) => f.line).join(', ')}` : '',
    `App: ${c.version} · ${c.platform}`,
  ].filter((l) => l !== '');
  return { subject: `Importação: ${c.source} (${c.rows} linhas)`, body: lines.join('\n') };
}
