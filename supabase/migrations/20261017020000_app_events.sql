-- Conversion funnel events (app_open → hand_saved → limit_hit/paywall_shown → purchase,
-- share_created → share_viewed → store_click). No PII: install_id is a random uuid per
-- install (or per browser on the web), props hold only small flat values.
-- Nobody but the dashboard/service role can read it; clients only insert through log_app_event.

create table public.app_events (
  id bigint generated always as identity primary key,
  event text not null check (event in (
    'app_open', 'hand_saved', 'limit_hit', 'paywall_shown', 'purchase', 'share_created', 'story_shared',
    'share_viewed', 'store_click', 'landing_view'
  )),
  install_id uuid not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 2048),
  created_at timestamptz not null default now()
);

create index app_events_created_idx on public.app_events (created_at);
create index app_events_event_idx on public.app_events (event, created_at);

alter table public.app_events enable row level security;
revoke all on public.app_events from anon, authenticated;

create or replace function public.log_app_event(p_event text, p_install_id uuid, p_platform text, p_props jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = public as $$
  insert into public.app_events (event, install_id, platform, props)
  values (p_event, p_install_id, p_platform, coalesce(p_props, '{}'::jsonb));
$$;

revoke all on function public.log_app_event(text, uuid, text, jsonb) from public;
grant execute on function public.log_app_event(text, uuid, text, jsonb) to anon, authenticated;

-- Daily funnel for the Supabase dashboard (SQL editor: select * from app_event_daily limit 100).
create or replace view public.app_event_daily as
  select (created_at at time zone 'Europe/Lisbon')::date as day,
         event,
         platform,
         count(*) as events,
         count(distinct install_id) as installs
  from public.app_events
  group by 1, 2, 3
  order by 1 desc, 2, 3;

revoke all on public.app_event_daily from anon, authenticated;
