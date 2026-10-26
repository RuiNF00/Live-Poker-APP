// The comments list out of whatever the server answered. A proxy or captive portal can answer
// 200 with `{}` or something else that isn't the list; the hand screen must get [] then, not crash.

import type { Comment } from './share-api';

export function commentsFrom(body: unknown): Comment[] {
  const list = body && typeof body === 'object' && 'comments' in body ? (body as { comments: unknown }).comments : body;
  if (!Array.isArray(list)) return [];
  return list.filter((c): c is Comment => !!c && typeof c === 'object' && typeof (c as Comment).id === 'string' && typeof (c as Comment).text === 'string');
}
