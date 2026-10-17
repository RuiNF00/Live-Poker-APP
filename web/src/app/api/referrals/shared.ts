import { NextResponse } from 'next/server';
import { brand } from '@/config/brand';
import { cors } from '@/lib/cors';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { newCode, normalizeCode, referrals } from '@/lib/referrals';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: cors });
export const inviteUrl = (code: string) => `${brand.siteUrl}/r/${code}`;

export interface ReferralBody {
  installId: string;
  rcUserId: string | null;
  /** The app's own code (`myCode`), validated, so the first code registered is always the app's. */
  myCode: string | null;
  raw: Record<string, unknown>;
}

/** Common checks: rate limit, backend on, installId uuid, optional RevenueCat app user id. */
export async function readBody(req: Request, bucket: string) {
  if (rateLimited(`ref:${bucket}:${clientIp(req)}`, 30, 60_000)) return { error: json({ error: 'rate_limited' }, 429) };
  const b = referrals();
  if (!b) return { error: json({ error: 'referrals_disabled' }, 503) };
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const installId = raw?.installId;
  if (typeof installId !== 'string' || !UUID.test(installId)) return { error: json({ error: 'invalid_install' }, 422) };
  const rc = raw?.rcUserId;
  const rcUserId = typeof rc === 'string' && rc.length > 0 && rc.length <= 100 ? rc : null;
  const myCode = typeof raw!.myCode === 'string' ? normalizeCode(raw!.myCode) : null;
  return { b, body: { installId, rcUserId, myCode, raw: raw! } as ReferralBody };
}

/** Code to register for an install that has none yet: the app's own when it sent one. */
export const codeToRegister = (body: ReferralBody, fallback: string | null = null) => body.myCode ?? fallback ?? newCode();
