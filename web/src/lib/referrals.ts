import 'server-only';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { grantPromotional } from './revenuecat';

// Referral loop (see supabase/migrations/20261017040000_referrals.sql for the rules).
// Server-only: rewards are granted from here, so the tables are closed to app/browser keys.

export const REWARD_DAYS = 7;
export { CODE_RE, normalizeCode } from './refcode';

export type ReferralSource = 'share' | 'story' | 'link' | 'manual' | 'play_referrer';
export type ClaimResult = 'ok' | 'already' | 'unknown_code' | 'self' | 'too_late';

export interface ReferralStatus {
  code: string;
  invited: number;
  activated: number;
  daysEarned: number;
  proUntil: string | null;
}

interface Grant {
  install_id: string;
  rc_user_id: string | null;
  pro_until: string;
}

interface ReferralBackend {
  codeFor(installId: string, code: string, rcUserId: string | null): Promise<string>;
  claim(friend: string, code: string, source: ReferralSource, shareId: string | null): Promise<ClaimResult>;
  activate(friend: string): Promise<Grant[]>;
  pending(installId: string): Promise<Grant[]>;
  markGranted(installId: string, until: string): Promise<void>;
  status(installId: string): Promise<ReferralStatus | null>;
}

export function newCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join('');
}

class SupabaseReferrals implements ReferralBackend {
  constructor(private db: SupabaseClient) {}
  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(fn, args);
    if (error) throw error;
    return data as T;
  }
  codeFor(installId: string, code: string, rcUserId: string | null) {
    return this.rpc<string>('referral_code_for', { p_install_id: installId, p_code: code, p_rc_user_id: rcUserId });
  }
  claim(friend: string, code: string, source: ReferralSource, shareId: string | null) {
    return this.rpc<ClaimResult>('claim_referral', { p_friend: friend, p_code: code, p_source: source, p_share_id: shareId });
  }
  async activate(friend: string) {
    return (await this.rpc<Grant[]>('activate_referral', { p_friend: friend, p_days: REWARD_DAYS })) ?? [];
  }
  async pending(installId: string) {
    return (await this.rpc<Grant[]>('pending_referral_grants', { p_install_id: installId })) ?? [];
  }
  async markGranted(installId: string, until: string) {
    await this.rpc('mark_referral_granted', { p_install_id: installId, p_until: until });
  }
  async status(installId: string) {
    const rows = await this.rpc<{ code: string; invited: number; activated: number; days_earned: number; pro_until: string | null }[]>(
      'referral_status',
      { p_install_id: installId },
    );
    const r = rows?.[0];
    return r ? { code: r.code, invited: r.invited, activated: r.activated, daysEarned: r.days_earned, proUntil: r.pro_until } : null;
  }
}

// Local JSON file for development, same rules as the SQL functions.
interface LocalReferrals {
  codes: Record<string, { code: string; rcUserId: string | null }>;
  referrals: Record<string, { referrer: string; source: string; shareId: string | null; claimedAt: string; activatedAt: string | null }>;
  rewards: { installId: string; friend: string; role: 'friend' | 'referrer'; days: number; proUntil: string; grantedAt: string | null; createdAt: string }[];
}

class LocalBackend implements ReferralBackend {
  private file = path.join(process.cwd(), '.data', 'referrals.json');
  private queue: Promise<unknown> = Promise.resolve();
  private async read(): Promise<LocalReferrals> {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch {
      return { codes: {}, referrals: {}, rewards: [] };
    }
  }
  private mutate<T>(fn: (d: LocalReferrals) => T): Promise<T> {
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
  codeFor(installId: string, code: string, rcUserId: string | null) {
    return this.mutate((d) => {
      const cur = d.codes[installId];
      d.codes[installId] = { code: cur?.code ?? code, rcUserId: rcUserId ?? cur?.rcUserId ?? null };
      return d.codes[installId].code;
    });
  }
  claim(friend: string, code: string, source: ReferralSource, shareId: string | null) {
    return this.mutate((d): ClaimResult => {
      if (d.referrals[friend]) return 'already';
      const referrer = Object.entries(d.codes).find(([, c]) => c.code === code.toUpperCase() || c.code === code.toLowerCase())?.[0];
      if (!referrer) return 'unknown_code';
      if (referrer === friend) return 'self';
      d.referrals[friend] = { referrer, source, shareId, claimedAt: new Date().toISOString(), activatedAt: null };
      return 'ok';
    });
  }
  async activate(friend: string) {
    const ids = await this.mutate((d) => {
      const r = d.referrals[friend];
      if (!r || r.activatedAt) return [];
      const now = Date.now();
      r.activatedAt = new Date(now).toISOString();
      const days = REWARD_DAYS * 86_400_000;
      d.rewards.push({ installId: friend, friend, role: 'friend', days: REWARD_DAYS, proUntil: new Date(now + days).toISOString(), grantedAt: null, createdAt: r.activatedAt });
      const yearAgo = now - 365 * 86_400_000;
      const earned = d.rewards.filter((w) => w.installId === r.referrer && w.role === 'referrer' && Date.parse(w.createdAt) > yearAgo).length;
      if (earned < 10) {
        const prev = Math.max(now, ...d.rewards.filter((w) => w.installId === r.referrer).map((w) => Date.parse(w.proUntil)));
        d.rewards.push({ installId: r.referrer, friend, role: 'referrer', days: REWARD_DAYS, proUntil: new Date(prev + days).toISOString(), grantedAt: null, createdAt: r.activatedAt });
      }
      return [friend, r.referrer];
    });
    return (await Promise.all(ids.map((id) => this.pending(id)))).flat();
  }
  async pending(installId: string) {
    const d = await this.read();
    const open = d.rewards.filter((w) => w.installId === installId && !w.grantedAt && Date.parse(w.proUntil) > Date.now());
    if (!open.length) return [];
    const until = open.map((w) => w.proUntil).sort().at(-1)!;
    return [{ install_id: installId, rc_user_id: d.codes[installId]?.rcUserId ?? null, pro_until: until }];
  }
  async markGranted(installId: string, until: string) {
    await this.mutate((d) => {
      for (const w of d.rewards) if (w.installId === installId && !w.grantedAt && w.proUntil <= until) w.grantedAt = new Date().toISOString();
    });
  }
  async status(installId: string) {
    const d = await this.read();
    const c = d.codes[installId];
    if (!c) return null;
    const mine = Object.values(d.referrals).filter((r) => r.referrer === installId);
    const rewards = d.rewards.filter((w) => w.installId === installId);
    return {
      code: c.code,
      invited: mine.length,
      activated: mine.filter((r) => r.activatedAt).length,
      daysEarned: rewards.reduce((n, w) => n + w.days, 0),
      proUntil: rewards.map((w) => w.proUntil).sort().at(-1) ?? null,
    };
  }
}

let backend: ReferralBackend | null = null;

/** null when Supabase is configured without the service role key: referrals are then off. */
export function referrals(): ReferralBackend | null {
  if (backend) return backend;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && service) backend = new SupabaseReferrals(createClient(url, service, { auth: { persistSession: false } }));
  else if (!url) backend = new LocalBackend();
  return backend;
}

/** Pushes every booked-but-ungranted reward of these installs to RevenueCat. */
export async function grantPending(b: ReferralBackend, grants: Grant[]): Promise<void> {
  for (const g of grants) {
    if (!g.rc_user_id) continue; // granted later, once the app reports its RevenueCat user
    const ok = await grantPromotional(g.rc_user_id, Date.parse(g.pro_until));
    if (ok) await b.markGranted(g.install_id, g.pro_until);
  }
}
