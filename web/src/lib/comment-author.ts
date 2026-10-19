import { createHash } from 'node:crypto';

/** The app's or browser's random commenter id, as sent. Only its hash is ever stored. */
export const AUTHOR_ID_RE = /^[\w-]{8,64}$/;

export function commentAuthorKey(authorId: string): string {
  return createHash('sha256').update(`comment-author:${authorId}`).digest('hex');
}
