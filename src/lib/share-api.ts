// Client for the hand-sharing backend. Interface agreed with the sharing
// thread; the implementation behind these URLs lives in /api.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { createKey, forgetCreateKey } from './create-key';
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
  /** Opaque id of who wrote it, on this hand only: "Bloquear" hides their comments on this phone. */
  by?: string;
}

export function shareUrl(id: string) {
  return `${BRAND.webUrl}/h/${id}`;
}

/** Where a shared link was sent from, for install attribution. */
export type ShareChannel = 'link' | 'challenge' | 'story' | 'text' | 'x' | 'whatsapp';
const CHANNEL: Record<ShareChannel, [source: string, medium: string]> = {
  link: ['app', 'share_link'],
  challenge: ['app', 'challenge'],
  story: ['instagram', 'story'],
  text: ['app', 'text'],
  x: ['x', 'post'],
  whatsapp: ['whatsapp', 'message'],
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
  // The link's token is picked here and kept until the answer arrives: sent again after a timeout
  // (or from the share queue), the server hands back the same link instead of making a second one.
  const scope = `hand:${hand.id}`;
  const token = await createKey(scope);
  const res = await fetch(`${API}/api/hands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hand: publicHand(hand, opts), token }),
  });
  // 410: taken down by reports since the first try; the next share is a new link.
  if (res.status === 410) await forgetCreateKey(scope);
  if (!res.ok) throw new Error('upload ' + res.status);
  const out = (await res.json()) as { id: string; token: string };
  await forgetCreateKey(scope);
  return out;
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

const AUTHOR_KEY = 'rl.commentAuthor.v1';
let author: Promise<string> | null = null;

/**
 * This phone as a commenter: a random id of its own (not the install id), so the player who shared a
 * hand can block it there. The server keeps only a hash.
 */
function authorId(): Promise<string> {
  author ??= AsyncStorage.getItem(AUTHOR_KEY)
    .then(async (v) => {
      if (v) return v;
      const id = anonId();
      await AsyncStorage.setItem(AUTHOR_KEY, id);
      return id;
    })
    .catch(() => anonId());
  return author;
}

/** `ownerToken`: the hand's own player replying, so the server doesn't send them a notice about it. */
export async function postComment(id: string, c: { name: string; text: string; street?: Street }, ownerToken?: string): Promise<Comment> {
  const res = await fetch(`${API}/api/hands/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(ownerToken ? { 'x-edit-token': ownerToken } : {}) },
    body: JSON.stringify({ ...c, authorId: await authorId() }),
  });
  if (res.status === 422) throw new Error('offensive');
  if (res.status === 403) throw new Error('blocked');
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

/** Flags one comment for review, like the site's "Denunciar" under each comment (3 reporters hide it). */
export async function reportComment(shareId: string, commentId: string): Promise<void> {
  await fetch(`${API}/api/hands/${encodeURIComponent(shareId)}/comments/${encodeURIComponent(commentId)}/report`, { method: 'POST' });
}

/**
 * The player who shared the hand (its `shareToken`) removes a comment; `block` also blocks its author
 * on that hand: their other comments go and they can't comment there again.
 */
export async function removeComment(shareId: string, token: string, commentId: string, block = false): Promise<void> {
  const res = await fetch(`${API}/api/hands/${encodeURIComponent(shareId)}/comments/${encodeURIComponent(commentId)}${block ? '?block=1' : ''}`, {
    method: 'DELETE',
    headers: { 'x-edit-token': token },
  });
  if (!res.ok && res.status !== 404) throw new Error('remove ' + res.status);
}

/** Visible comments on each of these shared hands, in one call (up to 100 ids). */
export async function fetchCommentCounts(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const res = await fetch(`${API}/api/hands/comment-counts?ids=${ids.slice(0, 100).map(encodeURIComponent).join(',')}`);
  if (!res.ok) throw new Error('counts ' + res.status);
  const j = (await res.json()) as { counts?: Record<string, number> };
  return j.counts ?? {};
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
