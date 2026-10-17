-- Festival action packages, store-safe version (pacotes-festival-spec.md v2). The app sells
-- nothing: the player records a deal already made with a backer they chose, and that backer
-- gets a private link (sweatbook.poker/o/<id>) to confirm the agreed piece. One row per
-- package and backer; no reservations, no availability, no payment.
--
-- Same approach as live links (20261017120000): only the web server (service_role) can reach
-- it, writes need the edit token returned at creation (only its hash is stored), reads never
-- return the hash, and agreements go 60 days after their last event.

create table public.action_offers (
  id text primary key,
  edit_token_hash text not null,
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object' and payload->>'v' = '1'
           and jsonb_typeof(payload->'events') = 'array' and pg_column_size(payload) < 32768),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_event_at timestamptz not null default now()
);

create index action_offers_last_event_idx on public.action_offers (last_event_at);

alter table public.action_offers enable row level security;
revoke all on public.action_offers from anon, authenticated;

-- When the last event starts (events[].d is ms UTC); now() for a payload without events.
create or replace function public.action_offer_last_event(p_payload jsonb) returns timestamptz
language sql stable set search_path = public as $$
  select coalesce(
    (select to_timestamp(max((e->>'d')::double precision) / 1000)
       from jsonb_array_elements(case when jsonb_typeof(p_payload->'events') = 'array' then p_payload->'events' else '[]'::jsonb end) e
      where jsonb_typeof(e->'d') = 'number'),
    now());
$$;

create or replace function public.create_action_offer(p_payload jsonb) returns table (id text, edit_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.action_offers o where o.id = v_id);
  end loop;
  insert into public.action_offers (id, edit_token_hash, payload, last_event_at)
  values (v_id, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), p_payload, public.action_offer_last_event(p_payload));
  return query select v_id, v_token;
end $$;

-- The player changes the record. New terms (markup or events) clear the backer's
-- confirmation: they have to confirm what they now agree to. Other fields keep it.
create or replace function public.update_action_offer(p_id text, p_edit_token text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.action_offers o
     set confirmed_at = case
           when (o.payload->'markup') is distinct from (p_payload->'markup')
             or (o.payload->'events') is distinct from (p_payload->'events') then null
           else o.confirmed_at end,
         payload = p_payload,
         updated_at = now(),
         last_event_at = public.action_offer_last_event(p_payload)
   where o.id = p_id
     and o.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  return found;
end $$;

create or replace function public.delete_action_offer(p_id text, p_edit_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.action_offers o
   where o.id = p_id
     and o.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  return found;
end $$;

create or replace function public.get_action_offer(p_id text)
returns table (id text, payload jsonb, confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.payload, o.confirmed_at, o.created_at, o.updated_at from public.action_offers o where o.id = p_id;
$$;

-- The backer confirms the agreed piece. Idempotent: a second call keeps the first time.
-- Null when the link is gone.
create or replace function public.confirm_action_offer(p_id text) returns timestamptz
language sql security definer set search_path = public as $$
  update public.action_offers o
     set confirmed_at = coalesce(o.confirmed_at, now())
   where o.id = p_id
  returning o.confirmed_at;
$$;

-- Agreements go 60 days after their last event. Returns how many.
create or replace function public.purge_action_offers() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.action_offers where last_event_at < now() - interval '60 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.action_offer_last_event(jsonb) from public, anon, authenticated;
revoke execute on function public.create_action_offer(jsonb) from public, anon, authenticated;
revoke execute on function public.update_action_offer(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_action_offer(text, text) from public, anon, authenticated;
revoke execute on function public.get_action_offer(text) from public, anon, authenticated;
revoke execute on function public.confirm_action_offer(text) from public, anon, authenticated;
revoke execute on function public.purge_action_offers() from public, anon, authenticated;
grant execute on function public.create_action_offer(jsonb) to service_role;
grant execute on function public.update_action_offer(text, text, jsonb) to service_role;
grant execute on function public.delete_action_offer(text, text) to service_role;
grant execute on function public.get_action_offer(text) to service_role;
grant execute on function public.confirm_action_offer(text) to service_role;
grant execute on function public.purge_action_offers() to service_role;
grant select, insert, update, delete on public.action_offers to service_role;

-- Daily purge when pg_cron is there (Supabase); the API also purges now and then.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-action-offers';
    perform cron.schedule('purge-action-offers', '27 4 * * *', 'select public.purge_action_offers()');
  end if;
end $$;
