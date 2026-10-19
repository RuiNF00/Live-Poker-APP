import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { funnelFrom, installIdForRc, trialEndFrom } from '@/lib/rc-webhook';

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }));
vi.mock('@/lib/abuse', async (orig) => ({ ...(await orig<typeof import('@/lib/abuse')>()), limited: async () => false }));
// The file-backed store, in a scratch folder: no database in tests.
process.chdir(mkdtempSync(path.join(tmpdir(), 'rc-')));
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { getStore } = await import('@/lib/store');
const { POST } = await import('../src/app/api/revenuecat/route');
const events = await import('../src/app/api/events/route');

const conversion = { type: 'RENEWAL', is_trial_conversion: true, period_type: 'NORMAL', environment: 'PRODUCTION', store: 'APP_STORE', product_id: 'sweatbook_pro_annual', app_user_id: '$RCAnonymousID:abc' };
const post = (body: object, auth?: string) =>
  POST(new Request('http://x/api/revenuecat', { method: 'POST', body: JSON.stringify(body), headers: auth ? { authorization: auth } : {} }));

afterEach(() => {
  delete process.env.REVENUECAT_WEBHOOK_AUTH;
  vi.restoreAllMocks();
});

describe('trial_end from RevenueCat', () => {
  it('maps a converted trial to paid and an expired one to ended', () => {
    expect(trialEndFrom(conversion)).toEqual({ appUserId: '$RCAnonymousID:abc', platform: 'ios', props: { result: 'paid', plan: 'annual' } });
    expect(trialEndFrom({ ...conversion, type: 'EXPIRATION', is_trial_conversion: false, period_type: 'TRIAL', store: 'PLAY_STORE' })).toEqual({
      appUserId: '$RCAnonymousID:abc',
      platform: 'android',
      props: { result: 'ended', plan: 'annual' },
    });
  });

  it('ignores sandbox, ordinary renewals, paid expirations and events without a user', () => {
    expect(trialEndFrom({ ...conversion, environment: 'SANDBOX' })).toBeNull();
    expect(trialEndFrom({ ...conversion, is_trial_conversion: false })).toBeNull();
    expect(trialEndFrom({ ...conversion, type: 'EXPIRATION', period_type: 'NORMAL' })).toBeNull();
    expect(trialEndFrom({ ...conversion, type: 'INITIAL_PURCHASE', period_type: 'TRIAL' })).toBeNull();
    expect(trialEndFrom({ ...conversion, app_user_id: undefined })).toBeNull();
    expect(trialEndFrom(null)).toBeNull();
  });

  it('gives an unmatched RevenueCat user the same uuid-shaped id every time', async () => {
    const id = await installIdForRc('$RCAnonymousID:abc');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await installIdForRc('$RCAnonymousID:abc')).toBe(id);
    expect(await installIdForRc('$RCAnonymousID:abd')).not.toBe(id);
  });
});

describe('store purchases and cancellations from RevenueCat', () => {
  const buy = { type: 'INITIAL_PURCHASE', period_type: 'NORMAL', environment: 'PRODUCTION', store: 'APP_STORE', product_id: 'sweatbook_pro_monthly', app_user_id: '$RCAnonymousID:abc' };
  it('records a first purchase with its plan, trial and kind of offer, never the code itself', () => {
    expect(funnelFrom(buy)).toEqual({ event: 'store_purchase', appUserId: '$RCAnonymousID:abc', platform: 'ios', props: { plan: 'monthly', trial: false, offer: 'none' } });
    expect(funnelFrom({ ...buy, offer_code: 'INVITEAB12' })?.props).toEqual({ plan: 'monthly', trial: false, offer: 'code' });
    expect(JSON.stringify(funnelFrom({ ...buy, offer_code: 'INVITEAB12' }))).not.toContain('INVITEAB12');
    expect(funnelFrom({ ...buy, store: 'PLAY_STORE', period_type: 'INTRO' })?.props).toEqual({ plan: 'monthly', trial: false, offer: 'intro' });
    expect(funnelFrom({ ...buy, product_id: 'sweatbook_pro_annual', period_type: 'TRIAL' })?.props).toEqual({ plan: 'annual', trial: true, offer: 'none' });
    expect(funnelFrom({ ...buy, type: 'NON_RENEWING_PURCHASE', product_id: 'sweatbook_lifetime' })?.props.plan).toBe('lifetime');
  });
  it('records auto-renew turned off with a known reason only', () => {
    expect(funnelFrom({ ...buy, type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' })).toEqual({ event: 'sub_cancel', appUserId: '$RCAnonymousID:abc', platform: 'ios', props: { plan: 'monthly', trial: false, reason: 'unsubscribe' } });
    expect(funnelFrom({ ...buy, type: 'CANCELLATION', cancel_reason: 'something new' })?.props.reason).toBe('unknown');
  });
  it('ignores sandbox, renewals and other events, and keeps trial_end', () => {
    expect(funnelFrom({ ...buy, environment: 'SANDBOX' })).toBeNull();
    expect(funnelFrom({ ...buy, type: 'RENEWAL' })).toBeNull();
    expect(funnelFrom({ ...buy, type: 'PRODUCT_CHANGE' })).toBeNull();
    expect(funnelFrom(conversion)?.event).toBe('trial_end');
  });
});

describe('the webhook route', () => {
  it('is closed without the secret and refuses a wrong header', async () => {
    expect((await post({ event: conversion }, 'x')).status).toBe(503);
    process.env.REVENUECAT_WEBHOOK_AUTH = 'Bearer s3cret';
    expect((await post({ event: conversion })).status).toBe(401);
    expect((await post({ event: conversion }, 'Bearer s3creT')).status).toBe(401);
  });

  it('records trial_end once and acknowledges everything else without recording', async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = 'Bearer s3cret';
    const log = vi.spyOn(getStore(), 'logEvent');
    expect((await post({ event: conversion }, 'Bearer s3cret')).status).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ event: 'trial_end', installId: await installIdForRc('$RCAnonymousID:abc'), platform: 'ios', props: { result: 'paid', plan: 'annual' } });
    expect((await post({ event: { ...conversion, type: 'TRANSFER' } }, 'Bearer s3cret')).status).toBe(204);
    expect((await post({ event: { ...conversion, environment: 'SANDBOX' } }, 'Bearer s3cret')).status).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
    expect((await post({ event: { ...conversion, type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' } }, 'Bearer s3cret')).status).toBe(204);
    expect(log).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'sub_cancel' }));
  });
});

describe('webhook retries and the Authorization value', () => {
  it('records a retried event once, also when both deliveries arrive together', async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = 's3cret';
    const once = vi.spyOn(getStore(), 'logEventOnce');
    const ev = { ...conversion, id: 'rc-evt-1' };
    const [a, b] = await Promise.all([post({ event: ev }, 's3cret'), post({ event: ev }, 's3cret')]);
    expect([a.status, b.status]).toEqual([204, 204]);
    expect(once).toHaveBeenCalledTimes(2);
    const results = await Promise.all(once.mock.results.map((r) => r.value));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('takes the secret with or without «Bearer »', async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = 's3cret';
    expect((await post({ event: { ...conversion, type: 'TRANSFER' } }, 's3cret')).status).toBe(204);
    expect((await post({ event: { ...conversion, type: 'TRANSFER' } }, 'Bearer s3cret')).status).toBe(204);
    expect((await post({ event: { ...conversion, type: 'TRANSFER' } }, 'Bearer s3cre')).status).toBe(401);
  });
});

describe('the public events route', () => {
  it('refuses the events only the webhook writes', async () => {
    const send = (event: string) =>
      events.POST(new Request('http://x/api/events', { method: 'POST', body: JSON.stringify({ event, installId: '67cd51ed-e23f-4c8e-84a5-41a61637b53a', platform: 'ios', props: { result: 'paid' } }) }));
    expect((await send('trial_end')).status).toBe(422);
    expect((await send('store_purchase')).status).toBe(422);
    expect((await send('sub_cancel')).status).toBe(422);
    expect((await send('trial_start')).status).toBe(204);
  });
});
