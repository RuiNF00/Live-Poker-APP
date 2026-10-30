// The backer's side of a sealed page (sweatbook.poker/b#s=<id>.<key>, backer-page.ts): a backer who has
// the app opens the link there, or pastes it. The app fetches the page and opens it with the key from the
// link, as the website does (web/src/components/backing/BackingView.tsx).

import { checkStatement, type Statement } from './backing-link';
import { open, type Sealed } from './sealed-link';
import { BRAND } from '@/theme';

const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

/** The id and key of a sealed backer link, from the link, a whole pasted message or just its fragment. */
export function sealedPageRef(raw: string): { id: string; key: string } | null {
  const m = /(?:^|#)s=([A-Za-z0-9]{6,16})\.([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(raw.trim());
  return m ? { id: m[1], key: m[2] } : null;
}

/**
 * 'gone': the player removed the page. 'empty': made, but the player's phone hasn't filled it yet.
 * 'bad': the key doesn't open it (a link cut short). Throws with no signal, so the screen offers a retry.
 */
export async function readBackerPage(
  ref: { id: string; key: string },
  get: (url: string) => Promise<{ status: number; ok: boolean; json: () => Promise<unknown> }> = (url) => fetch(url, { cache: 'no-store' }),
): Promise<Statement | 'gone' | 'empty' | 'bad'> {
  const res = await get(`${API}/api/backer-pages/${encodeURIComponent(ref.id)}`);
  if (res.status === 404) return 'gone';
  if (!res.ok) throw new Error('page ' + res.status);
  const j = (await res.json()) as { sealed?: Sealed | null };
  if (!j?.sealed) return 'empty';
  return checkStatement(await open(j.sealed, ref.id, ref.key)) ?? 'bad';
}
