import 'server-only';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { opaqueId } from './abuse';
import { serviceClient } from './supabase';
import { DEMO_SHARE } from './demo';
import type { HandComment, QuizSpot, SharedHand, VoteChoice } from './types';

export * from './types';

export interface CreateShareInput {
  payload: unknown;
  title?: string | null;
  revealAll?: boolean;
  quiz?: QuizSpot | null;
  allowComments?: boolean;
  /** Picked by the app (64 hex) so a retried create returns the same link (migration 340000). */
  token?: string | null;
}

/** A create's token that isn't 64 hex. */
export class BadCreateToken extends Error {}
/** A retried create for a hand that was taken down since. */
export class CreateGone extends Error {}

/** The app's own edit token, or null for one picked here. Throws BadCreateToken on anything else. */
export function createToken(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)) return v;
  throw new BadCreateToken();
}

export interface NewComment {
  name: string;
  text: string;
  stepIndex: number | null;
  /** Hash of the commenter's app or browser id, so the hand's owner can block them. Never returned. */
  authorKey?: string | null;
}

export interface ShareStore {
  createShare(input: CreateShareInput): Promise<{ id: string; editToken: string }>;
  getShare(id: string): Promise<SharedHand | null>;
  deleteShare(id: string, editToken: string): Promise<boolean>;
  /** True when `editToken` is this live share's: only its owner may list it on a profile. */
  ownsShare(id: string, editToken: string): Promise<boolean>;
  recordView(id: string): Promise<void>;
  listComments(id: string): Promise<HandComment[]>;
  addComment(id: string, c: NewComment): Promise<HandComment | null>;
  /** Hidden after 3 distinct reporters; 'hidden' when this report did it. */
  reportComment(commentId: string, reporterId: string): Promise<ReportResult>;
  /** The hand's owner (edit token) hides a comment; with `block`, every comment of its author on that hand, now and later. */
  removeComment(commentId: string, editToken: string, block: boolean): Promise<boolean>;
  /** "Delete all my data" in the app: every comment written with this author key, on any hand. */
  deleteCommentsByAuthor(authorKey: string): Promise<number>;
  /** Visible comments per hand, for the app's list of shared hands. */
  commentCounts(ids: string[]): Promise<Record<string, number>>;
  /** The owner turns "Novo comentário" notices on for this hand (an Expo push token) or off (null). */
  setCommentPush(id: string, editToken: string, pushToken: string | null, lang: string, tz: string): Promise<boolean>;
  /** The owner opened the hand: the next comment may notify again. */
  seenCommentPush(id: string, editToken: string): Promise<boolean>;
  /** A comment arrived: the Expo messages that may go out now (none in quiet hours or until the last one is opened). */
  queueCommentPush(id: string, street: string | null): Promise<PushMessage[]>;
  /** Expo says the token is dead. */
  dropCommentPush(id: string): Promise<void>;
  /** Taken down for review after 5 distinct reporters; 'hidden' when this report did it. */
  reportHand(id: string, reporterId: string, reason: string | null): Promise<ReportResult>;
  /** At most 5 voters per IP hash per hand. */
  vote(id: string, voterId: string, choice: VoteChoice, ipHash: string): Promise<void>;
  voteCounts(id: string): Promise<Partial<Record<VoteChoice, number>>>;
  logEvent(e: AppEvent): Promise<void>;
  /** Deletes usage events older than 12 months (privacy policy retention). */
  purgeOldEvents(): Promise<void>;
}

export type ReportResult = 'missing' | 'ok' | 'hidden';

/** One message for Expo's push API, built by the database (comment_push_message). */
export interface PushMessage {
  handId: string;
  message: { to: string; title: string; body: string; data?: { url?: string } } & Record<string, unknown>;
}

export const APP_EVENTS = [
  'app_open',
  'hand_saved',
  'limit_hit',
  'paywall_shown',
  'purchase',
  'share_created',
  'story_shared',
  'share_viewed',
  'store_click',
  'landing_view',
  'link_shared',
  'link_opened',
  'invite_claimed',
  'cancel_flow',
  'onboarding_step',
  'paywall_closed',
  'trial_start',
  'lifetime_offer_shown',
  'lifetime_purchased',
  'import_done',
  'session_started',
  'session_closed',
  'notify_permission',
  'replay_opened',
  'review_prompt',
  'receipt_read',
  'invite_rewarded',
] as const;
export type AppEventName = (typeof APP_EVENTS)[number];

export interface AppEvent {
  event: AppEventName;
  installId: string;
  platform: 'ios' | 'android' | 'web';
  props: Record<string, string | number | boolean>;
}

// ---------- Supabase ----------

interface ShareRow {
  id: string;
  payload: unknown;
  title: string | null;
  reveal_all: boolean;
  quiz: QuizSpot | null;
  allow_comments: boolean;
  view_count: number;
  created_at: string;
}

interface CommentRow {
  id: string;
  author_name: string;
  body: string;
  step_index: number | null;
  created_at: string;
  author_key?: string | null;
}

const toComment = (r: CommentRow, handId: string): HandComment => ({
  id: r.id,
  name: r.author_name,
  text: r.body,
  stepIndex: r.step_index,
  createdAt: new Date(r.created_at).getTime(),
  ...(r.author_key ? { by: opaqueId(`comment:${handId}`, r.author_key) } : {}),
});

class SupabaseStore implements ShareStore {
  constructor(private db: SupabaseClient) {}

  async createShare(input: CreateShareInput) {
    const { data, error } = await this.db.rpc('create_shared_hand', {
      p_payload: input.payload,
      p_title: input.title ?? null,
      p_reveal_all: input.revealAll ?? false,
      p_quiz: input.quiz ?? null,
      p_allow_comments: input.allowComments ?? true,
      p_token: input.token ?? null,
    });
    if (error?.message === 'gone') throw new CreateGone();
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { id: row.id as string, editToken: row.edit_token as string };
  }

  async getShare(id: string) {
    // Only live hands (not taken down), never the secret columns.
    const { data: rows, error } = await this.db.rpc('get_shared_hand', { p_id: id });
    if (error) throw error;
    const data = (rows as ShareRow[] | null)?.[0];
    if (!data) return null;
    return {
      id: data.id,
      payload: data.payload,
      title: data.title,
      revealAll: data.reveal_all,
      quiz: data.quiz,
      allowComments: data.allow_comments,
      viewCount: data.view_count,
      createdAt: data.created_at,
    };
  }

  async deleteShare(id: string, editToken: string) {
    const { data, error } = await this.db.rpc('delete_shared_hand', { p_id: id, p_edit_token: editToken });
    if (error) throw error;
    return !!data;
  }

  async ownsShare(id: string, editToken: string) {
    const { data, error } = await this.db.rpc('shared_hand_token_ok', { p_id: id, p_edit_token: editToken });
    if (error) throw error;
    return !!data;
  }

  async recordView(id: string) {
    await this.db.rpc('record_hand_view', { p_id: id });
  }

  async listComments(id: string) {
    const { data, error } = await this.db.rpc('list_hand_comments', { p_hand_id: id });
    if (error) throw error;
    return ((data ?? []) as CommentRow[]).map((r) => toComment(r, id));
  }

  async addComment(id: string, c: NewComment) {
    const { data, error } = await this.db.rpc('add_hand_comment', {
      p_hand_id: id,
      p_author_name: c.name,
      p_body: c.text,
      p_step_index: c.stepIndex,
      p_author_key: c.authorKey ?? null,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as CommentRow | null;
    return row ? toComment({ ...row, author_key: c.authorKey }, id) : null;
  }

  async reportComment(commentId: string, reporterId: string) {
    const { data, error } = await this.db.rpc('report_hand_comment', { p_comment_id: commentId, p_reporter_id: reporterId });
    if (error) throw error;
    return data as ReportResult;
  }

  async removeComment(commentId: string, editToken: string, block: boolean) {
    const { data, error } = block
      ? await this.db.rpc('block_hand_commenter', { p_comment_id: commentId, p_edit_token: editToken })
      : await this.db.rpc('hide_hand_comment', { p_comment_id: commentId, p_edit_token: editToken });
    if (error) throw error;
    return !!data;
  }

  async deleteCommentsByAuthor(authorKey: string) {
    const { data, error } = await this.db.rpc('delete_comments_by_author', { p_author_key: authorKey });
    if (error) throw error;
    return Number(data ?? 0);
  }

  async commentCounts(ids: string[]) {
    const { data, error } = await this.db.rpc('hand_comment_counts', { p_ids: ids });
    if (error) throw error;
    return Object.fromEntries(((data ?? []) as { hand_id: string; comments: number }[]).map((r) => [r.hand_id, r.comments]));
  }

  async setCommentPush(id: string, editToken: string, pushToken: string | null, lang: string, tz: string) {
    const { data, error } = await this.db.rpc('set_comment_push', { p_hand_id: id, p_edit_token: editToken, p_push_token: pushToken, p_lang: lang, p_tz: tz });
    if (error) throw error;
    return !!data;
  }

  async seenCommentPush(id: string, editToken: string) {
    const { data, error } = await this.db.rpc('seen_comment_push', { p_hand_id: id, p_edit_token: editToken });
    if (error) throw error;
    return !!data;
  }

  async queueCommentPush(id: string, street: string | null) {
    const q = await this.db.rpc('queue_comment_push', { p_hand_id: id, p_street: street });
    if (q.error) throw q.error;
    const { data, error } = await this.db.rpc('take_comment_pushes', { p_hand_id: id });
    if (error) throw error;
    return ((data ?? []) as { hand_id: string; message: PushMessage['message'] }[]).map((r) => ({ handId: r.hand_id, message: r.message }));
  }

  async dropCommentPush(id: string) {
    await this.db.rpc('drop_comment_push', { p_hand_id: id });
  }

  async reportHand(id: string, reporterId: string, reason: string | null) {
    const { data, error } = await this.db.rpc('report_shared_hand', { p_hand_id: id, p_reporter_id: reporterId, p_reason: reason });
    if (error) throw error;
    return data as ReportResult;
  }

  async vote(id: string, voterId: string, choice: VoteChoice, ipHash: string) {
    const { error } = await this.db.rpc('cast_hand_vote', { p_hand_id: id, p_voter_id: voterId, p_choice: choice, p_ip_hash: ipHash });
    if (error) throw error;
  }

  async voteCounts(id: string) {
    const { data, error } = await this.db.rpc('hand_vote_counts', { p_hand_id: id });
    if (error) throw error;
    const out: Partial<Record<VoteChoice, number>> = {};
    for (const r of (data ?? []) as { choice: VoteChoice; votes: number }[]) out[r.choice] = Number(r.votes);
    return out;
  }

  async logEvent(e: AppEvent) {
    const { error } = await this.db.rpc('log_app_event', {
      p_event: e.event,
      p_install_id: e.installId,
      p_platform: e.platform,
      p_props: e.props,
    });
    if (error) throw error;
  }

  async purgeOldEvents() {
    await this.db.rpc('purge_old_app_events');
    await this.db.rpc('purge_moderation');
  }
}

// ---------- Local JSON file (development and demos without Supabase) ----------

interface LocalData {
  shares: Record<string, SharedHand & { editTokenHash: string }>;
  comments: Record<string, HandComment[]>;
  votes: Record<string, Record<string, VoteChoice>>;
  reports?: Record<string, string[]>;
  handReports?: Record<string, string[]>;
  /** Hidden by the hand's owner. */
  removed?: string[];
  /** Blocked author keys per hand. */
  blocks?: Record<string, string[]>;
  events?: (AppEvent & { createdAt: string })[];
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function shortId(): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  return Array.from(randomBytes(10), (b) => alphabet[b % 62]).join('');
}

class LocalStore implements ShareStore {
  private file = path.join(process.cwd(), '.data', 'store.json');
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<LocalData> {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch {
      const data: LocalData = { shares: {}, comments: {}, votes: {} };
      data.shares.demo = { ...DEMO_SHARE, createdAt: new Date().toISOString(), editTokenHash: sha256(randomUUID()) };
      data.comments.demo = [
        {
          id: randomUUID(),
          name: 'Tiago',
          text: 'Contra este big stack o 3-bet é muito forte. Pagar é ok, mas no turn o shove só é pago por melhor.',
          stepIndex: 17,
          createdAt: Date.now() - 1000 * 60 * 42,
        },
      ];
      return data;
    }
  }

  private async mutate<T>(fn: (d: LocalData) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const data = await this.read();
      const out = fn(data);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(data, null, 2));
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async createShare(input: CreateShareInput) {
    const editToken = input.token ?? randomBytes(16).toString('hex');
    return this.mutate((d) => {
      // Same token again: the link made the first time.
      const again = Object.values(d.shares).find((s) => s.editTokenHash === sha256(editToken));
      if (again) return { id: again.id, editToken };
      const id = shortId();
      d.shares[id] = {
        id,
        payload: input.payload,
        title: input.title ?? null,
        revealAll: input.revealAll ?? false,
        quiz: input.quiz ?? null,
        allowComments: input.allowComments ?? true,
        viewCount: 0,
        createdAt: new Date().toISOString(),
        editTokenHash: sha256(editToken),
      };
      return { id, editToken };
    });
  }

  async getShare(id: string) {
    const s = (await this.read()).shares[id];
    if (!s) return null;
    const { editTokenHash: _, ...share } = s;
    return share;
  }

  async deleteShare(id: string, editToken: string) {
    return this.mutate((d) => {
      if (d.shares[id]?.editTokenHash !== sha256(editToken)) return false;
      delete d.shares[id];
      delete d.comments[id];
      delete d.votes[id];
      return true;
    });
  }

  async ownsShare(id: string, editToken: string) {
    return (await this.read()).shares[id]?.editTokenHash === sha256(editToken);
  }

  async recordView(id: string) {
    await this.mutate((d) => {
      if (d.shares[id]) d.shares[id].viewCount++;
    });
  }

  async listComments(id: string) {
    const d = await this.read();
    return (d.comments[id] ?? [])
      .filter((c) => (d.reports?.[c.id]?.length ?? 0) < 3 && !d.removed?.includes(c.id))
      .map(({ authorKey, ...c }: HandComment & { authorKey?: string | null }) => ({ ...c, ...(authorKey ? { by: opaqueId(`comment:${id}`, authorKey) } : {}) }));
  }

  async removeComment(commentId: string, editToken: string, block: boolean) {
    return this.mutate((d) => {
      const handId = Object.keys(d.comments).find((h) => d.comments[h].some((c) => c.id === commentId));
      if (!handId || d.shares[handId]?.editTokenHash !== sha256(editToken)) return false;
      const list = d.comments[handId] as (HandComment & { authorKey?: string | null })[];
      const key = list.find((c) => c.id === commentId)?.authorKey ?? null;
      if (block && key) ((d.blocks ??= {})[handId] ??= []).push(key);
      d.removed = [...(d.removed ?? []), ...list.filter((c) => c.id === commentId || (block && key && c.authorKey === key)).map((c) => c.id)];
      return true;
    });
  }

  async deleteCommentsByAuthor(authorKey: string) {
    return this.mutate((d) => {
      let n = 0;
      for (const h of Object.keys(d.comments)) {
        const list = d.comments[h] as (HandComment & { authorKey?: string | null })[];
        const keep = list.filter((c) => c.authorKey !== authorKey);
        n += list.length - keep.length;
        d.comments[h] = keep;
      }
      return n;
    });
  }

  async commentCounts(ids: string[]) {
    const out: Record<string, number> = {};
    for (const id of ids.slice(0, 100)) {
      const n = (await this.listComments(id)).length;
      if (n) out[id] = n;
    }
    return out;
  }

  // Local dev sends no pushes: the owner check answers as the real one would, nothing is kept.
  async setCommentPush(id: string, editToken: string) {
    return this.ownsShare(id, editToken);
  }

  async seenCommentPush(id: string, editToken: string) {
    return this.ownsShare(id, editToken);
  }

  async queueCommentPush(): Promise<PushMessage[]> {
    return [];
  }

  async dropCommentPush() {}

  async reportComment(commentId: string, reporterId: string) {
    return this.mutate((d): ReportResult => {
      if (!Object.values(d.comments).some((list) => list.some((c) => c.id === commentId))) return 'missing';
      const list = ((d.reports ??= {})[commentId] ??= []);
      if (list.includes(reporterId)) return 'ok';
      list.push(reporterId);
      return list.length === 3 ? 'hidden' : 'ok';
    });
  }

  async addComment(id: string, c: NewComment) {
    return this.mutate((d) => {
      if (!d.shares[id]?.allowComments) return null;
      if (c.authorKey && d.blocks?.[id]?.includes(c.authorKey)) throw new Error('blocked');
      const comment = { id: randomUUID(), ...c, createdAt: Date.now() };
      (d.comments[id] ??= []).push(comment);
      const { authorKey, ...out } = comment;
      return { ...out, ...(authorKey ? { by: opaqueId(`comment:${id}`, authorKey) } : {}) };
    });
  }

  async reportHand(id: string, reporterId: string) {
    return this.mutate((d): ReportResult => {
      if (!d.shares[id]) return 'missing';
      const list = ((d.handReports ??= {})[id] ??= []);
      if (list.includes(reporterId)) return 'ok';
      list.push(reporterId);
      if (list.length < 5) return 'ok';
      delete d.shares[id];
      return 'hidden';
    });
  }

  async vote(id: string, voterId: string, choice: VoteChoice) {
    // Local dev only: no per-IP cap here.
    await this.mutate((d) => {
      if (!d.shares[id]) return;
      (d.votes[id] ??= {})[voterId] = choice;
    });
  }

  async voteCounts(id: string) {
    const out: Partial<Record<VoteChoice, number>> = {};
    for (const c of Object.values((await this.read()).votes[id] ?? {})) out[c] = (out[c] ?? 0) + 1;
    return out;
  }

  async logEvent(e: AppEvent) {
    await this.mutate((d) => {
      d.events = [...(d.events ?? []), { ...e, createdAt: new Date().toISOString() }].slice(-2000);
    });
  }

  async purgeOldEvents() {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    await this.mutate((d) => {
      d.events = (d.events ?? []).filter((e) => new Date(e.createdAt) >= cutoff);
    });
  }
}

let store: ShareStore | null = null;

/** Share by id; /h/demo always resolves, even on a fresh database. */
export async function loadShare(id: string): Promise<SharedHand | null> {
  if (!/^[A-Za-z0-9]{3,20}$/.test(id)) return null;
  const share = await getStore().getShare(id);
  if (share || id !== 'demo') return share;
  return { ...DEMO_SHARE, allowComments: false };
}

export function getStore(): ShareStore {
  if (store) return store;
  const db = serviceClient();
  store = db ? new SupabaseStore(db) : new LocalStore();
  return store;
}
