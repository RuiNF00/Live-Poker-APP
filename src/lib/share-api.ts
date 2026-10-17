// Client for the hand-sharing backend. Interface agreed with the sharing
// thread; the implementation behind these URLs lives in /api.

import type { Hand } from '@/poker/types';
import { BRAND } from '@/theme';

export const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

export interface Comment {
  id: string;
  name: string;
  text: string;
  createdAt: number;
}

export function shareUrl(id: string) {
  return `${BRAND.webUrl}/h/${id}`;
}

function publicHand(hand: Hand): Hand {
  const { sessionId: _s, shareToken: _t, ...rest } = hand;
  return rest as Hand;
}

export async function uploadHand(hand: Hand): Promise<{ id: string; token: string }> {
  const res = await fetch(`${API}/api/hands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hand: publicHand(hand) }),
  });
  if (!res.ok) throw new Error('upload ' + res.status);
  return res.json();
}

export async function fetchHand(id: string): Promise<Hand> {
  const res = await fetch(`${API}/api/hands/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('fetch ' + res.status);
  const j = await res.json();
  return (j.hand ?? j) as Hand;
}

export async function fetchComments(id: string): Promise<Comment[]> {
  const res = await fetch(`${API}/api/hands/${encodeURIComponent(id)}/comments`);
  if (!res.ok) return [];
  const j = await res.json();
  return (j.comments ?? j) as Comment[];
}

export async function postComment(id: string, c: { name: string; text: string }): Promise<Comment> {
  const res = await fetch(`${API}/api/hands/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(c),
  });
  if (res.status === 422) throw new Error('offensive');
  if (!res.ok) throw new Error('comment ' + res.status);
  const j = await res.json();
  return (j.comment ?? j) as Comment;
}

/** Owner removes the public link (and its comments/votes). */
export async function deleteShare(id: string, token: string): Promise<void> {
  const res = await fetch(`${API}/api/hands/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-edit-token': token },
  });
  if (!res.ok && res.status !== 404) throw new Error('delete ' + res.status);
}

export async function reportHand(id: string, reporterId: string, reason?: string): Promise<void> {
  await fetch(`${API}/api/hands/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reporterId, reason }),
  });
}

/** RFC 4122 v4-shaped id for anonymous reports/votes (no accounts in v1). */
export function anonId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
