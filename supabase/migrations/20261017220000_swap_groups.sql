-- Group swaps (sweatbook.poker/swap/g/<id>): 3 to 8 players each give x% of their own prizes to
-- every other player in the group, for one event or a whole series. Whoever creates it takes
-- seat 0 and lists the others by name; the group link carries an invite secret (in the URL
-- fragment, never logged) and each player claims their own seat with it, getting a private
-- token for that seat. The terms and the names never change after creation.
--
-- Same approach as pair swaps (20261017160000): only the web server (service_role) reaches it,
-- only token and invite hashes are stored, reads never return them, and each seat adds and
-- removes only its own entries.

create table public.swap_groups (
  id text primary key,
  invite_hash text not null,
  terms jsonb not null
    check (jsonb_typeof(terms) = 'object' and terms->>'v' = '1' and pg_column_size(terms) < 8192),
  entries jsonb not null default '[]'::jsonb
    check (jsonb_typeof(entries) = 'array' and jsonb_array_length(entries) <= 600 and pg_column_size(entries) < 131072),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.swap_group_seats (
  group_id text not null references public.swap_groups (id) on delete cascade,
  seat smallint not null check (seat between 0 and 7),
  name text not null check (char_length(name) between 1 and 40),
  token_hash text,
  confirmed_at timestamptz,
  primary key (group_id, seat),
  check ((confirmed_at is null) = (token_hash is null))
);

create index swap_groups_updated_idx on public.swap_groups (updated_at);
create unique index swap_group_seats_token_idx on public.swap_group_seats (group_id, token_hash) where token_hash is not null;

alter table public.swap_groups enable row level security;
alter table public.swap_group_seats enable row level security;
revoke all on public.swap_groups from anon, authenticated;
revoke all on public.swap_group_seats from anon, authenticated;

-- p_names: every player in seat order, the creator first. The creator's seat is confirmed now.
create or replace function public.create_swap_group(p_terms jsonb, p_names text[])
returns table (id text, token text, invite text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token text := public.swap_new_token();
  v_invite text := public.swap_new_token();
  n integer := coalesce(array_length(p_names, 1), 0);
begin
  if n < 3 or n > 8 then raise exception 'group size'; end if;
  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.swap_groups g where g.id = v_id);
  end loop;
  insert into public.swap_groups (id, invite_hash, terms) values (v_id, public.swap_hash(v_invite), p_terms);
  insert into public.swap_group_seats (group_id, seat, name, token_hash, confirmed_at)
    select v_id, (i - 1)::smallint, p_names[i],
           case when i = 1 then public.swap_hash(v_token) end,
           case when i = 1 then now() end
      from generate_series(1, n) i;
  return query select v_id, v_token, v_invite;
end $$;

create or replace function public.get_swap_group(p_id text)
returns table (id text, terms jsonb, seats jsonb, entries jsonb, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.terms,
         coalesce((select jsonb_agg(jsonb_build_object('seat', s.seat, 'name', s.name, 'confirmedAt', s.confirmed_at) order by s.seat)
                     from swap_group_seats s where s.group_id = g.id), '[]'::jsonb),
         g.entries, g.created_at, g.updated_at
    from swap_groups g where g.id = p_id;
$$;

-- Which seat a token belongs to, or null.
create or replace function public.swap_group_seat(p_id text, p_token text) returns smallint
language sql stable security definer set search_path = public as $$
  select s.seat from swap_group_seats s
   where s.group_id = p_id and coalesce(p_token, '') <> '' and s.token_hash = public.swap_hash(p_token);
$$;

-- Takes a seat with the group's invite. Works once per seat: returns the seat's token, or null
-- (wrong invite, taken seat, no such group). The time is the database's.
create or replace function public.claim_swap_group_seat(p_id text, p_invite text, p_seat integer) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text := public.swap_new_token();
begin
  if not exists (select 1 from public.swap_groups g where g.id = p_id and g.invite_hash = public.swap_hash(p_invite) and coalesce(p_invite, '') <> '') then
    return null;
  end if;
  update public.swap_group_seats s
     set token_hash = public.swap_hash(v_token), confirmed_at = now()
   where s.group_id = p_id and s.seat = p_seat and s.confirmed_at is null;
  if not found then return null; end if;
  update public.swap_groups g set updated_at = now() where g.id = p_id;
  return v_token;
end $$;

-- One entry for the token's seat, once every seat is taken. `cid` makes a retry harmless.
-- A payment names the seat it went to (`to`), which must be another seat in the group.
create or replace function public.add_swap_group_entry(p_id text, p_token text, p_entry jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_seat smallint := public.swap_group_seat(p_id, p_token);
  v_entry jsonb;
begin
  if v_seat is null or jsonb_typeof(p_entry) <> 'object' then return false; end if;
  if exists (select 1 from public.swap_group_seats s where s.group_id = p_id and s.confirmed_at is null) then return false; end if;
  if p_entry->>'kind' = 'payment' and not exists (
    select 1 from public.swap_group_seats s where s.group_id = p_id and s.seat::text = p_entry->>'to' and s.seat <> v_seat
  ) then return false; end if;
  if exists (
    select 1 from public.swap_groups g, jsonb_array_elements(g.entries) e
     where g.id = p_id and e->>'seat' = v_seat::text and e->>'cid' = p_entry->>'cid'
  ) then return true; end if;
  v_entry := p_entry || jsonb_build_object(
    'id', substr(public.swap_new_token(), 1, 12),
    'seat', v_seat,
    'at', (extract(epoch from now()) * 1000)::bigint
  );
  update public.swap_groups g
     set entries = g.entries || jsonb_build_array(v_entry), updated_at = now()
   where g.id = p_id;
  return found;
end $$;

create or replace function public.remove_swap_group_entry(p_id text, p_token text, p_entry_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_seat smallint := public.swap_group_seat(p_id, p_token);
  v_before integer;
  v_after integer;
begin
  if v_seat is null then return false; end if;
  select jsonb_array_length(g.entries) into v_before from public.swap_groups g where g.id = p_id;
  update public.swap_groups g
     set entries = coalesce((
           select jsonb_agg(e order by n) from jsonb_array_elements(g.entries) with ordinality as x(e, n)
            where not (e->>'id' = p_entry_id and e->>'seat' = v_seat::text)
         ), '[]'::jsonb),
         updated_at = now()
   where g.id = p_id
  returning jsonb_array_length(g.entries) into v_after;
  return v_after < v_before;
end $$;

-- The creator (seat 0) removes the group for everyone. Anyone else leaving ("Delete all my
-- data") keeps the group's accounts whole for the others: their name becomes empty and their
-- token stops working. Returns true when something changed.
create or replace function public.leave_swap_group(p_id text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_seat smallint := public.swap_group_seat(p_id, p_token);
begin
  if v_seat is null then return false; end if;
  if v_seat = 0 then
    delete from public.swap_groups g where g.id = p_id;
  else
    update public.swap_group_seats s
       set name = '-', token_hash = public.swap_hash(public.swap_new_token())
     where s.group_id = p_id and s.seat = v_seat;
    update public.swap_groups g set updated_at = now() where g.id = p_id;
  end if;
  return true;
end $$;

-- Not every seat taken after 30 days, or untouched for 400 days: gone.
create or replace function public.purge_swap_groups() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.swap_groups g
   where (g.created_at < now() - interval '30 days'
          and exists (select 1 from public.swap_group_seats s where s.group_id = g.id and s.confirmed_at is null))
      or g.updated_at < now() - interval '400 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.create_swap_group(jsonb, text[]) from public, anon, authenticated;
revoke execute on function public.get_swap_group(text) from public, anon, authenticated;
revoke execute on function public.swap_group_seat(text, text) from public, anon, authenticated;
revoke execute on function public.claim_swap_group_seat(text, text, integer) from public, anon, authenticated;
revoke execute on function public.add_swap_group_entry(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.remove_swap_group_entry(text, text, text) from public, anon, authenticated;
revoke execute on function public.leave_swap_group(text, text) from public, anon, authenticated;
revoke execute on function public.purge_swap_groups() from public, anon, authenticated;
grant execute on function public.create_swap_group(jsonb, text[]) to service_role;
grant execute on function public.get_swap_group(text) to service_role;
grant execute on function public.swap_group_seat(text, text) to service_role;
grant execute on function public.claim_swap_group_seat(text, text, integer) to service_role;
grant execute on function public.add_swap_group_entry(text, text, jsonb) to service_role;
grant execute on function public.remove_swap_group_entry(text, text, text) to service_role;
grant execute on function public.leave_swap_group(text, text) to service_role;
grant execute on function public.purge_swap_groups() to service_role;
grant select, insert, update, delete on public.swap_groups to service_role;
grant select, insert, update, delete on public.swap_group_seats to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-swap-groups';
    perform cron.schedule('purge-swap-groups', '29 4 * * *', 'select public.purge_swap_groups()');
  end if;
end $$;

-- "Delete all my data" on a pair swap: the player who erases leaves, the other keeps the
-- record (read-only, with a note that the other side erased their data). Their name and token
-- go; the amounts stay so the other player still knows where they stand. Nobody left to keep
-- it for (never confirmed, or the other side already left): deleted outright.
alter table public.swaps add column left_side text check (left_side is null or left_side in ('a', 'b'));

drop function if exists public.get_swap(text);
create function public.get_swap(p_id text)
returns table (id text, terms jsonb, confirmed_at timestamptz, confirmed_name text, entries jsonb, created_at timestamptz, updated_at timestamptz, left_side text)
language sql stable security definer set search_path = public as $$
  select s.id, s.terms, s.confirmed_at, s.confirmed_name, s.entries, s.created_at, s.updated_at, s.left_side from swaps s where s.id = p_id;
$$;

create or replace function public.leave_swap(p_id text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_side text := public.swap_side(p_id, p_token);
begin
  if v_side is null then return false; end if;
  if exists (select 1 from public.swaps s where s.id = p_id and (s.confirmed_at is null or s.left_side is not null)) then
    delete from public.swaps s where s.id = p_id;
    return true;
  end if;
  update public.swaps s
     set left_side = v_side,
         terms = case when v_side = 'a' then jsonb_set(s.terms, '{a,name}', '"-"') else jsonb_set(s.terms, '{b,name}', '"-"') end,
         confirmed_name = case when v_side = 'b' then '-' else s.confirmed_name end,
         token_a_hash = case when v_side = 'a' then public.swap_hash(public.swap_new_token()) else s.token_a_hash end,
         token_b_hash = case when v_side = 'b' then public.swap_hash(public.swap_new_token()) else s.token_b_hash end,
         updated_at = now()
   where s.id = p_id;
  return true;
end $$;

-- Read-only once one side left: no new entries.
create or replace function public.add_swap_entry(p_id text, p_token text, p_entry jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_side text := public.swap_side(p_id, p_token);
  v_entry jsonb;
begin
  if v_side is null or jsonb_typeof(p_entry) <> 'object' then return false; end if;
  if exists (select 1 from public.swaps s where s.id = p_id and s.left_side is not null) then return false; end if;
  if exists (
    select 1 from public.swaps s, jsonb_array_elements(s.entries) e
     where s.id = p_id and e->>'side' = v_side and e->>'cid' = p_entry->>'cid'
  ) then return true; end if;
  v_entry := p_entry || jsonb_build_object(
    'id', substr(public.swap_new_token(), 1, 12),
    'side', v_side,
    'at', (extract(epoch from now()) * 1000)::bigint
  );
  update public.swaps s
     set entries = s.entries || jsonb_build_array(v_entry), updated_at = now()
   where s.id = p_id and s.confirmed_at is not null;
  return found;
end $$;

-- Group swaps the same way: once someone left, the group is read-only for the rest.
create or replace function public.add_swap_group_entry(p_id text, p_token text, p_entry jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_seat smallint := public.swap_group_seat(p_id, p_token);
  v_entry jsonb;
begin
  if v_seat is null or jsonb_typeof(p_entry) <> 'object' then return false; end if;
  if exists (select 1 from public.swap_group_seats s where s.group_id = p_id and (s.confirmed_at is null or s.name = '-')) then return false; end if;
  if p_entry->>'kind' = 'payment' and not exists (
    select 1 from public.swap_group_seats s where s.group_id = p_id and s.seat::text = p_entry->>'to' and s.seat <> v_seat
  ) then return false; end if;
  if exists (
    select 1 from public.swap_groups g, jsonb_array_elements(g.entries) e
     where g.id = p_id and e->>'seat' = v_seat::text and e->>'cid' = p_entry->>'cid'
  ) then return true; end if;
  v_entry := p_entry || jsonb_build_object(
    'id', substr(public.swap_new_token(), 1, 12),
    'seat', v_seat,
    'at', (extract(epoch from now()) * 1000)::bigint
  );
  update public.swap_groups g
     set entries = g.entries || jsonb_build_array(v_entry), updated_at = now()
   where g.id = p_id;
  return found;
end $$;

revoke execute on function public.get_swap(text) from public, anon, authenticated;
revoke execute on function public.leave_swap(text, text) from public, anon, authenticated;
revoke execute on function public.add_swap_entry(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.add_swap_group_entry(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.get_swap(text) to service_role;
grant execute on function public.leave_swap(text, text) to service_role;
grant execute on function public.add_swap_entry(text, text, jsonb) to service_role;
grant execute on function public.add_swap_group_entry(text, text, jsonb) to service_role;
