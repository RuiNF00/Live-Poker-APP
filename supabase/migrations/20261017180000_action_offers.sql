-- Festival action packages: a player sells action for a festival (sweatbook.poker/o/<id>)
-- and backers reserve a % of each event. Same approach as live links (20261017120000):
-- only the web server (service_role) can reach it, writes need the edit token returned at
-- creation (only its hash is stored), reads never return the hash, and offers go 60 days
-- after their last event.
--
-- The offer payload is the public contract (v: 1) rebuilt field by field by the web server
-- (web/src/lib/offer.ts). Reservations are checked here against it, under a lock on the
-- offer row, so two backers can never take the same last %.

create table public.action_offers (
  id text primary key,
  edit_token_hash text not null,
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object' and payload->>'v' = '1'
           and jsonb_typeof(payload->'events') = 'array' and pg_column_size(payload) < 32768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_event_at timestamptz not null default now()
);

create index action_offers_last_event_idx on public.action_offers (last_event_at);

create table public.action_reservations (
  id text primary key,
  offer_id text not null references public.action_offers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  contact text not null default '' check (char_length(contact) <= 60),
  shares jsonb not null check (jsonb_typeof(shares) = 'array' and pg_column_size(shares) < 8192),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index action_reservations_offer_idx on public.action_reservations (offer_id, created_at);

alter table public.action_offers enable row level security;
alter table public.action_reservations enable row level security;
revoke all on public.action_offers from anon, authenticated;
revoke all on public.action_reservations from anon, authenticated;

-- When the last event starts (events[].d is ms UTC); now() for an offer without events.
create or replace function public.action_offer_last_event(p_payload jsonb) returns timestamptz
language sql stable set search_path = public as $$
  select coalesce(
    (select to_timestamp(max((e->>'d')::double precision) / 1000)
       from jsonb_array_elements(case when jsonb_typeof(p_payload->'events') = 'array' then p_payload->'events' else '[]'::jsonb end) e
      where jsonb_typeof(e->'d') = 'number'),
    now());
$$;

-- % held per event: pending and confirmed reservations ({eventId: sum of p}).
create or replace function public.action_offer_taken(p_offer_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(x.e, x.t), '{}'::jsonb)
    from (select s->>'e' as e, sum((s->>'p')::numeric) as t
            from public.action_reservations r
            cross join lateral jsonb_array_elements(r.shares) s
           where r.offer_id = p_offer_id and r.status in ('pending', 'confirmed')
           group by 1) x;
$$;

-- Null when every event in p_shares still fits in what is left of it, else 'sold_out'.
-- p_skip leaves one reservation out of the count (the one being re-activated).
create or replace function public.action_offer_fits(p_offer_id text, p_payload jsonb, p_shares jsonb, p_skip text default null)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_taken jsonb;
  v_sh jsonb;
  v_s numeric;
begin
  select coalesce(jsonb_object_agg(x.e, x.t), '{}'::jsonb) into v_taken
    from (select s->>'e' as e, sum((s->>'p')::numeric) as t
            from public.action_reservations r
            cross join lateral jsonb_array_elements(r.shares) s
           where r.offer_id = p_offer_id and r.status in ('pending', 'confirmed')
             and r.id is distinct from p_skip
           group by 1) x;
  for v_sh in select value from jsonb_array_elements(p_shares) loop
    select (e->>'s')::numeric into v_s
      from jsonb_array_elements(p_payload->'events') e
     where e->>'id' = v_sh->>'e';
    if v_s is null or coalesce((v_taken->>(v_sh->>'e'))::numeric, 0) + (v_sh->>'p')::numeric > v_s then
      return 'sold_out';
    end if;
  end loop;
  return null;
end $$;

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

-- 'ok', 'not_found' (gone or wrong token) or 'conflict': an event would end up with less
-- on sale than backers already hold (a removed event counts as 0 on sale).
create or replace function public.update_action_offer(p_id text, p_edit_token text, p_payload jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_taken jsonb;
  v_k text;
  v_v jsonb;
  v_s numeric;
begin
  perform 1 from public.action_offers o
   where o.id = p_id
     and o.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex')
   for update;
  if not found then return 'not_found'; end if;
  v_taken := public.action_offer_taken(p_id);
  for v_k, v_v in select key, value from jsonb_each(v_taken) loop
    select (e->>'s')::numeric into v_s
      from jsonb_array_elements(case when jsonb_typeof(p_payload->'events') = 'array' then p_payload->'events' else '[]'::jsonb end) e
     where e->>'id' = v_k;
    if (v_v #>> '{}')::numeric > coalesce(v_s, 0) then return 'conflict'; end if;
  end loop;
  update public.action_offers o
     set payload = p_payload, updated_at = now(), last_event_at = public.action_offer_last_event(p_payload)
   where o.id = p_id;
  return 'ok';
end $$;

create or replace function public.delete_action_offer(p_id text, p_edit_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.action_offers o
   where o.id = p_id
     and o.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  return found;
end $$;

-- Public read: the offer, % held per event and how many active reservations. Never names.
create or replace function public.get_action_offer(p_id text)
returns table (id text, payload jsonb, taken jsonb, count integer, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.payload, public.action_offer_taken(o.id),
         (select count(*)::integer from public.action_reservations r
           where r.offer_id = o.id and r.status in ('pending', 'confirmed')),
         o.created_at, o.updated_at
    from public.action_offers o
   where o.id = p_id;
$$;

-- Owner read: every reservation with name and contact, oldest first, as a JSON array.
-- Null (not an empty array) when the offer is gone or the token is wrong.
create or replace function public.list_action_reservations(p_id text, p_edit_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', r.id, 'name', r.name, 'contact', r.contact, 'shares', r.shares, 'status', r.status,
                   'created_at', r.created_at, 'updated_at', r.updated_at) order by r.created_at), '[]'::jsonb)
            from public.action_reservations r
           where r.offer_id = o.id)
    from public.action_offers o
   where o.id = p_id
     and o.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
$$;

-- A backer reserves. Returns one row: rid when it went through, else result says why:
-- 'not_found', 'closed', 'invalid' (shape, unknown event, below min, whole package not
-- even), 'over_cap' (more than one backer may take), 'sold_out' (not that much left) or
-- 'full' (200 reservations on this offer). The offer row stays locked until commit, so
-- concurrent reservations on one offer run one after the other.
create or replace function public.reserve_action(p_offer_id text, p_name text, p_contact text, p_shares jsonb)
returns table (rid text, result text)
language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb;
  v_events jsonb;
  v_cap numeric;
  v_min numeric;
  v_whole boolean;
  v_first numeric;
  v_sh jsonb;
  v_p numeric;
  v_seen text[] := '{}';
  v_fit text;
  v_id text;
begin
  select o.payload into v_payload from public.action_offers o where o.id = p_offer_id for update;
  if not found then return query select null::text, 'not_found'::text; return; end if;
  if coalesce(v_payload->>'closed', 'false') = 'true' then return query select null::text, 'closed'::text; return; end if;

  v_events := v_payload->'events';
  v_cap := (v_payload->>'cap')::numeric;
  v_min := coalesce((v_payload->>'min')::numeric, 1);
  v_whole := coalesce(v_payload->>'whole', 'false') = 'true';

  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 40
     or char_length(coalesce(p_contact, '')) > 60
     or jsonb_typeof(p_shares) is distinct from 'array'
     or jsonb_array_length(p_shares) = 0
     or jsonb_array_length(p_shares) > jsonb_array_length(v_events) then
    return query select null::text, 'invalid'::text; return;
  end if;

  for v_sh in select value from jsonb_array_elements(p_shares) loop
    if jsonb_typeof(v_sh) <> 'object' or jsonb_typeof(v_sh->'e') is distinct from 'string'
       or jsonb_typeof(v_sh->'p') is distinct from 'number'
       or (v_sh->>'e') = any (v_seen)
       or not exists (select 1 from jsonb_array_elements(v_events) e where e->>'id' = v_sh->>'e') then
      return query select null::text, 'invalid'::text; return;
    end if;
    v_seen := v_seen || (v_sh->>'e');
    v_p := (v_sh->>'p')::numeric;
    if v_p <> round(v_p, 2) or v_p < v_min then return query select null::text, 'invalid'::text; return; end if;
    if v_p > v_cap then return query select null::text, 'over_cap'::text; return; end if;
    if v_whole and v_first is not null and v_p <> v_first then return query select null::text, 'invalid'::text; return; end if;
    v_first := coalesce(v_first, v_p);
  end loop;
  if v_whole and cardinality(v_seen) <> jsonb_array_length(v_events) then
    return query select null::text, 'invalid'::text; return;
  end if;

  if (select count(*) from public.action_reservations r where r.offer_id = p_offer_id) >= 200 then
    return query select null::text, 'full'::text; return;
  end if;

  v_fit := public.action_offer_fits(p_offer_id, v_payload, p_shares);
  if v_fit is not null then return query select null::text, v_fit; return; end if;

  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.action_reservations r where r.id = v_id);
  end loop;
  insert into public.action_reservations (id, offer_id, name, contact, shares)
  values (v_id, p_offer_id, btrim(p_name), coalesce(p_contact, ''), p_shares);
  update public.action_offers o set updated_at = now() where o.id = p_offer_id;
  return query select v_id, 'ok'::text;
end $$;

-- The player confirms or declines (or puts back to pending). 'ok', 'not_found', 'invalid'
-- or 'sold_out' when a declined reservation no longer fits what is left.
create or replace function public.set_reservation_status(p_id text, p_edit_token text, p_rid text, p_status text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb;
  v_old text;
  v_shares jsonb;
begin
  if p_status is null or p_status not in ('pending', 'confirmed', 'declined') then return 'invalid'; end if;
  select o.payload into v_payload from public.action_offers o
   where o.id = p_id
     and o.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex')
   for update;
  if not found then return 'not_found'; end if;
  select r.status, r.shares into v_old, v_shares from public.action_reservations r where r.id = p_rid and r.offer_id = p_id;
  if not found then return 'not_found'; end if;
  if v_old = 'declined' and p_status <> 'declined'
     and public.action_offer_fits(p_id, v_payload, v_shares, p_rid) is not null then
    return 'sold_out';
  end if;
  update public.action_reservations r set status = p_status, updated_at = now() where r.id = p_rid;
  update public.action_offers o set updated_at = now() where o.id = p_id;
  return 'ok';
end $$;

-- Offers go 60 days after their last event, reservations with them. Returns how many.
create or replace function public.purge_action_offers() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.action_offers where last_event_at < now() - interval '60 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.action_offer_last_event(jsonb) from public, anon, authenticated;
revoke execute on function public.action_offer_taken(text) from public, anon, authenticated;
revoke execute on function public.action_offer_fits(text, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function public.create_action_offer(jsonb) from public, anon, authenticated;
revoke execute on function public.update_action_offer(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_action_offer(text, text) from public, anon, authenticated;
revoke execute on function public.get_action_offer(text) from public, anon, authenticated;
revoke execute on function public.list_action_reservations(text, text) from public, anon, authenticated;
revoke execute on function public.reserve_action(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.set_reservation_status(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.purge_action_offers() from public, anon, authenticated;
grant execute on function public.create_action_offer(jsonb) to service_role;
grant execute on function public.update_action_offer(text, text, jsonb) to service_role;
grant execute on function public.delete_action_offer(text, text) to service_role;
grant execute on function public.get_action_offer(text) to service_role;
grant execute on function public.list_action_reservations(text, text) to service_role;
grant execute on function public.reserve_action(text, text, text, jsonb) to service_role;
grant execute on function public.set_reservation_status(text, text, text, text) to service_role;
grant execute on function public.purge_action_offers() to service_role;
grant select, insert, update, delete on public.action_offers to service_role;
grant select, insert, update, delete on public.action_reservations to service_role;

-- Daily purge when pg_cron is there (Supabase); the API also purges now and then.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-action-offers';
    perform cron.schedule('purge-action-offers', '27 4 * * *', 'select public.purge_action_offers()');
  end if;
end $$;
