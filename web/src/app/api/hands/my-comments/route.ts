import { NextResponse } from 'next/server';
import { AUTHOR_ID_RE, commentAuthorKey } from '@/lib/comment-author';
import { limited } from '@/lib/abuse';
import { cors } from '@/lib/cors';
import { getStore } from '@/lib/store';

export function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

/**
 * DELETE { authorId } -> 200 { deleted }: "Delete all my data" in the app. Every comment this app
 * install wrote on shared hands goes, on any hand. The id is the random commenter id only the app
 * knows (sent in the body, never the URL); the server only ever had its hash.
 */
export async function DELETE(req: Request) {
  if (await limited(req, 'comment-erase', 20, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as { authorId?: unknown } | null;
  const authorId = typeof body?.authorId === 'string' && AUTHOR_ID_RE.test(body.authorId) ? body.authorId : null;
  if (!authorId) return NextResponse.json({ error: 'invalid_author' }, { status: 422, headers: cors });
  const deleted = await getStore().deleteCommentsByAuthor(commentAuthorKey(authorId));
  return NextResponse.json({ deleted }, { headers: { ...cors, 'cache-control': 'no-store' } });
}
