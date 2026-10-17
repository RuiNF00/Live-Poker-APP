import 'server-only';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceClient } from './supabase';
import type { CoachComment, CoachLinkView, NewCoachComment } from './coach-data';

export * from './coach-data';

// Private coaching links (/c/<token>). Supabase in production (migration 20261017170000), a JSON
// file without it. The URL token and the player's owner token are only kept as hashes.

export interface CoachHandIn {
  id: string;
  payload: unknown;
}

export interface CoachStore {
  create(title: string, player: string, expiresAt: string | null, hands: CoachHandIn[]): Promise<{ token: string; ownerToken: string }>;
  /** Null once revoked, expired or gone. Counts the visit. */
  open(token: string): Promise<CoachLinkView | null>;
  /** The coach's comment; null when the link is closed or the hand isn't in it. */
  comment(token: string, c: NewCoachComment): Promise<CoachComment | null>;
  /** The player's side: comments after `since`, still readable once revoked. Empty with a wrong owner token. */
  since(token: string, ownerToken: string, since: string | null): Promise<CoachComment[]>;
  reply(token: string, ownerToken: string, c: Omit<NewCoachComment, 'mark'>): Promise<CoachComment | null>;
  revoke(token: string, ownerToken: string): Promise<boolean>;
  purge(): Promise<void>;
}

interface Row {
  id: string;
  hand_id: string;
  step_index: number | null;
  mark: CoachComment['mark'];
  author: CoachComment['author'];
  name: string;
  body: string;
  created_at: string;
}

class SupabaseCoach implements CoachStore {
  constructor(private db: SupabaseClient) {}

  async create(title: string, player: string, expiresAt: string | null, hands: CoachHandIn[]) {
    const { data, error } = await this.db.rpc('create_coach_link', { p_title: title, p_player: player, p_expires_at: expiresAt, p_hands: hands });
    if (error) throw error;
    const r = (data as { token: string; owner_token: string }[])[0];
    return { token: r.token, ownerToken: r.owner_token };
  }

  async open(token: string) {
    const { data, error } = await this.db.rpc('open_coach_link', { p_token: token });
    if (error) throw error;
    return (data as CoachLinkView | null) ?? null;
  }

  async comment(token: string, c: NewCoachComment) {
    const { data, error } = await this.db.rpc('add_coach_comment', {
      p_token: token,
      p_hand_id: c.handId,
      p_step: c.stepIndex,
      p_mark: c.mark,
      p_name: c.name,
      p_body: c.body,
    });
    if (error) throw error;
    return (data as CoachComment | null) ?? null;
  }

  async since(token: string, ownerToken: string, since: string | null) {
    const { data, error } = await this.db.rpc('coach_comments_since', { p_token: token, p_owner_token: ownerToken, p_since: since });
    if (error) throw error;
    return ((data as Row[] | null) ?? []).map((r) => ({
      id: r.id,
      handId: r.hand_id,
      stepIndex: r.step_index,
      mark: r.mark,
      author: r.author,
      name: r.name,
      body: r.body,
      createdAt: r.created_at,
    }));
  }

  async reply(token: string, ownerToken: string, c: Omit<NewCoachComment, 'mark'>) {
    const { data, error } = await this.db.rpc('add_player_reply', {
      p_token: token,
      p_owner_token: ownerToken,
      p_hand_id: c.handId,
      p_step: c.stepIndex,
      p_name: c.name,
      p_body: c.body,
    });
    if (error) throw error;
    return (data as CoachComment | null) ?? null;
  }

  async revoke(token: string, ownerToken: string) {
    const { data, error } = await this.db.rpc('revoke_coach_link', { p_token: token, p_owner_token: ownerToken });
    if (error) throw error;
    return !!data;
  }

  async purge() {
    await this.db.rpc('purge_coach_links');
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const MAX_COMMENTS = 1000;

interface LocalLink {
  ownerHash: string;
  title: string;
  player: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  views: number;
  hands: CoachHandIn[];
  comments: CoachComment[];
}

class LocalCoach implements CoachStore {
  private file = path.join(process.cwd(), '.data', 'coach.json');
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Record<string, LocalLink>> {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch {
      return {};
    }
  }

  private async mutate<T>(fn: (d: Record<string, LocalLink>) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const d = await this.read();
      const out = fn(d);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(d, null, 2));
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private static live(l: LocalLink | undefined): l is LocalLink {
    return !!l && !l.revokedAt && (!l.expiresAt || Date.parse(l.expiresAt) > Date.now());
  }

  async create(title: string, player: string, expiresAt: string | null, hands: CoachHandIn[]) {
    const token = randomBytes(16).toString('hex');
    const ownerToken = randomBytes(32).toString('hex');
    await this.mutate((d) => {
      d[sha256(token)] = { ownerHash: sha256(ownerToken), title, player, expiresAt, revokedAt: null, createdAt: new Date().toISOString(), views: 0, hands, comments: [] };
    });
    return { token, ownerToken };
  }

  async open(token: string) {
    return this.mutate((d): CoachLinkView | null => {
      const l = d[sha256(token)];
      if (!LocalCoach.live(l)) return null;
      l.views++;
      return { title: l.title, player: l.player, expiresAt: l.expiresAt, createdAt: l.createdAt, hands: l.hands, comments: l.comments };
    });
  }

  private add(l: LocalLink, c: Omit<CoachComment, 'id' | 'createdAt'>): CoachComment | null {
    if (!l.hands.some((h) => h.id === c.handId) || l.comments.length >= MAX_COMMENTS) return null;
    const out = { ...c, id: randomUUID(), createdAt: new Date().toISOString() };
    l.comments.push(out);
    return out;
  }

  async comment(token: string, c: NewCoachComment) {
    return this.mutate((d) => {
      const l = d[sha256(token)];
      return LocalCoach.live(l) ? this.add(l, { ...c, author: 'coach' }) : null;
    });
  }

  async since(token: string, ownerToken: string, since: string | null) {
    const l = (await this.read())[sha256(token)];
    if (l?.ownerHash !== sha256(ownerToken)) return [];
    return l.comments.filter((c) => !since || Date.parse(c.createdAt) > Date.parse(since)).slice(0, 500);
  }

  async reply(token: string, ownerToken: string, c: Omit<NewCoachComment, 'mark'>) {
    return this.mutate((d) => {
      const l = d[sha256(token)];
      if (l?.ownerHash !== sha256(ownerToken) || !LocalCoach.live(l)) return null;
      return this.add(l, { ...c, mark: null, author: 'player' });
    });
  }

  async revoke(token: string, ownerToken: string) {
    return this.mutate((d) => {
      const l = d[sha256(token)];
      if (l?.ownerHash !== sha256(ownerToken)) return false;
      l.revokedAt ??= new Date().toISOString();
      return true;
    });
  }

  async purge() {
    const cutoff = Date.now() - 30 * 86400000;
    await this.mutate((d) => {
      for (const [k, l] of Object.entries(d)) {
        const end = l.revokedAt ?? l.expiresAt;
        if (end && Date.parse(end) < cutoff) delete d[k];
      }
    });
  }
}

let store: CoachStore | null = null;

export function coachStore(): CoachStore {
  if (store) return store;
  const db = serviceClient();
  return (store = db ? new SupabaseCoach(db) : new LocalCoach());
}
