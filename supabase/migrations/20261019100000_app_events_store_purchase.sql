-- store_purchase and sub_cancel come from RevenueCat's webhook (web /api/revenuecat), not the app:
-- a first purchase as the store saw it (plan, trial, offer: code / intro / none) and auto-renew
-- turned off (plan, trial, reason). Nothing personal, never the offer code itself.
alter table public.app_events drop constraint if exists app_events_event_check;
alter table public.app_events add constraint app_events_event_check check (event in (
  'app_open', 'hand_saved', 'limit_hit', 'paywall_shown', 'purchase', 'share_created', 'story_shared',
  'share_viewed', 'store_click', 'landing_view', 'link_shared', 'link_opened', 'invite_claimed', 'cancel_flow',
  'onboarding_step', 'paywall_closed', 'trial_start', 'lifetime_offer_shown', 'lifetime_purchased',
  'import_done', 'session_started', 'session_closed', 'notify_permission', 'replay_opened', 'review_prompt',
  'receipt_read', 'invite_rewarded', 'trial_end', 'store_purchase', 'sub_cancel'
));

-- RevenueCat retries a webhook when our answer fails or is slow, with the same event id: each id
-- is recorded once (Swaps QA, 19 Oct). Only the id and when it arrived; kept 30 days.
create table public.rc_webhook_seen (
  id text primary key check (char_length(id) <= 100),
  at timestamptz not null default now()
);
create index rc_webhook_seen_at_idx on public.rc_webhook_seen (at);
alter table public.rc_webhook_seen enable row level security;
revoke all on public.rc_webhook_seen from public, anon, authenticated;

-- In one statement, so two deliveries of the same id at once can't both record it.
create or replace function public.log_rc_event(p_id text, p_event text, p_install_id uuid, p_platform text, p_props jsonb default '{}'::jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from rc_webhook_seen where at < now() - interval '30 days';
  insert into rc_webhook_seen (id) values (p_id) on conflict do nothing;
  if not found then return false; end if;
  insert into app_events (event, install_id, platform, props) values (p_event, p_install_id, p_platform, coalesce(p_props, '{}'::jsonb));
  return true;
end $$;
revoke all on function public.log_rc_event(text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_rc_event(text, text, uuid, text, jsonb) to service_role;
