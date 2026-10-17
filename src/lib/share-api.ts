// Client for the hand-sharing backend. Interface agreed with the sharing
// thread; the implementation behind these URLs lives in /api.
import * as Crypto from 'expo-crypto';

import { publicHand, type ShareOptions } from '@/poker/privacy';
import type { Hand, Street } from '@/poker/types';
import { variant } from '@/i18n';
import { BRAND } from '@/theme';

export const API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? BRAND.webUrl;

export interface Comment {
  id: string;
  name: string;
  text: string;
  createdAt: number;
  /** Street the comment is about; null or missing = the whole hand. */
  street?: Street | null;
}

export function shareUrl(id: string) {
  return `${BRAND.webUrl}/h/${id}`;
}

/** Where a shared link was sent from, for install attribution. */
export type ShareChannel = 'link' | 'challenge' | 'story' | 'text';
const CHANNEL: Record<ShareChannel, [source: string, medium: string]> = {
  link: ['app', 'share_link'],
  challenge: ['app', 'challenge'],
  story: ['instagram', 'story'],
  text: ['app', 'text'],
};

/** The public link with its channel, the hand as campaign and the sharer's referral code. */
export function shareLink(id: string, channel: ShareChannel, opts: { quiz?: boolean; ref?: string } = {}) {
  const [source, medium] = CHANNEL[channel];
  const q = new URLSearchParams();
  if (opts.quiz) q.set('q', '1');
  q.set('utm_source', source);
  q.set('utm_medium', medium);
  q.set('utm_campaign', id);
  if (opts.ref) q.set('r', opts.ref);
  // The sharer's language, for the chat preview (see link-lang.ts).
  q.set('lang', variant);
  return `${shareUrl(id)}?${q.toString()}`;
}

export async function uploadHand(hand: Hand, opts?: ShareOptions): Promise<{ id: string; token: string }> {
  const res = await fetch(`${API}/api/hands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hand: publicHand(hand, opts) }),
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

/** How many times the shared page was opened. */
export async function fetchViews(id: string): Promise<number> {
  const res = await fetch(`${API}/api/hands/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('fetch ' + res.status);
  const j = (await res.json()) as { views?: number };
  return typeof j.views === 'number' ? j.views : 0;
}

export async function fetchComments(id: string): Promise<Comment[]> {
  const res = await fetch(`${API}/api/hands/${encodeURIComponent(id)}/comments`);
  if (!res.ok) return [];
  const j = await res.json();
  return (j.comments ?? j) as Comment[];
}

export async function postComment(id: string, c: { name: string; text: string; street?: Street }): Promise<Comment> {
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

/** Random v4 UUID from the platform's secure RNG (install ids double as credentials). */
export function anonId(): string {
  return Crypto.randomUUID();
}

/** Friends' votes on "what do you do here?" (web votes + in-app vote comments). */
export async function fetchVotes(id: string): Promise<Record<string, number>> {
  const res = await fetch(`${API}/api/hands/${encodeURIComponent(id)}/vote`);
  if (!res.ok) return {};
  const j = await res.json();
  return (j.counts ?? {}) as Record<string, number>;
}
