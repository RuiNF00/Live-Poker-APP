-- Swaps between players (sweatbook.poker/swap/<id>): X% of each other's prizes for one event
-- or a whole series. The player who proposes it gets side 'a'; the other confirms through the
-- link and gets side 'b'. From then on the terms and the confirmation time are fixed: no
-- function changes them, so neither side can rewrite what was agreed.
--
-- Same approach as live links (20261017120000): only the web server (service_role) reaches it,
-- each side has its own token and only the token hashes are stored, reads never return them.
-- Each side can add and remove only its own entries (prizes it won, payments it made).

create table public.swaps (
  id text primary key,
  token_a_hash text not null,
  token_b_hash text,
  terms jsonb not null
    check (jsonb_typeof(terms) = 'object' and terms->>'v' = '1' and pg_column_size(terms) < 8192),
  confirmed_at timestamptz,
  confirmed_name text check (confirmed_name is null or char_length(confirmed_name) between 1 and 40),
  entries jsonb not null default '[]'::jsonb
    check (jsonb_typeof(entries) = 'array' and jsonb_array_length(entries) <= 300 and pg_column_size(entries) < 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((confirmed_at is null) = (token_b_hash is null))
);

create index swaps_updated_idx on public.swaps (updated_at);

alter table public.swaps enable row level security;
revoke all on public.swaps from anon, authenticated;

create or replace function public.swap_hash(p_token text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
$$;

create or replace function public.swap_new_token() returns text
language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.create_swap(p_terms jsonb) returns table (id text, token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token text := public.swap_new_token();
begin
  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.swaps s where s.id = v_id);
  end loop;
  insert into public.swaps (id, token_a_hash, terms) values (v_id, public.swap_hash(v_token), p_terms);
  return query select v_id, v_token;
end $$;

create or replace function public.get_swap(p_id text)
returns table (id text, terms jsonb, confirmed_at timestamptz, confirmed_name text, entries jsonb, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.terms, s.confirmed_at, s.confirmed_name, s.entries, s.created_at, s.updated_at from swaps s where s.id = p_id;
$$;

-- Which side a token belongs to: 'a', 'b' or null.
create or replace function public.swap_side(p_id text, p_token text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when s.token_a_hash = public.swap_hash(p_token) then 'a'
    when s.token_b_hash = public.swap_hash(p_token) then 'b'
  end
  from swaps s where s.id = p_id and coalesce(p_token, '') <> '';
$$;

-- The other player accepts. Works once: returns their token, or nothing when it was already
-- confirmed (or doesn't exist). The time is the database's, not the phone's.
create or replace function public.confirm_swap(p_id text, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text := public.swap_new_token();
begin
  update public.swaps s
     set token_b_hash = public.swap_hash(v_token), confirmed_at = now(), confirmed_name = p_name, updated_at = now()
   where s.id = p_id and s.confirmed_at is null;
  if not found then return null; end if;
  return v_token;
end $$;

-- Adds one entry for the token's side, only once confirmed. `cid` (the client's id) makes a
-- retry harmless: the same side sending the same cid again changes nothing.
create or replace function public.add_swap_entry(p_id text, p_token text, p_entry jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_side text := public.swap_side(p_id, p_token);
  v_entry jsonb;
begin
  if v_side is null or jsonb_typeof(p_entry) <> 'object' then return false; end if;
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

-- Removes one of the token side's own entries. The other side's entries can't be touched.
create or replace function public.remove_swap_entry(p_id text, p_token text, p_entry_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_side text := public.swap_side(p_id, p_token);
  v_before integer;
  v_after integer;
begin
  if v_side is null then return false; end if;
  select jsonb_array_length(s.entries) into v_before from public.swaps s where s.id = p_id;
  update public.swaps s
     set entries = coalesce((
           select jsonb_agg(e order by n) from jsonb_array_elements(s.entries) with ordinality as x(e, n)
            where not (e->>'id' = p_entry_id and e->>'side' = v_side)
         ), '[]'::jsonb),
         updated_at = now()
   where s.id = p_id
  returning jsonb_array_length(s.entries) into v_after;
  return v_after < v_before;
end $$;

-- Either side can remove the swap for both (a real delete). Each phone keeps its own copy of
-- the terms and confirmation, so the record survives where it matters.
create or replace function public.delete_swap(p_id text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.swap_side(p_id, p_token) is null then return false; end if;
  delete from public.swaps s where s.id = p_id;
  return found;
end $$;

-- Never confirmed after 30 days, or untouched for 400 days (a series and its settling are long
-- over): gone. Returns how many.
create or replace function public.purge_swaps() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.swaps
   where (confirmed_at is null and created_at < now() - interval '30 days')
      or updated_at < now() - interval '400 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.swap_hash(text) from public, anon, authenticated;
revoke execute on function public.swap_new_token() from public, anon, authenticated;
revoke execute on function public.create_swap(jsonb) from public, anon, authenticated;
revoke execute on function public.get_swap(text) from public, anon, authenticated;
revoke execute on function public.swap_side(text, text) from public, anon, authenticated;
revoke execute on function public.confirm_swap(text, text) from public, anon, authenticated;
revoke execute on function public.add_swap_entry(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.remove_swap_entry(text, text, text) from public, anon, authenticated;
revoke execute on function public.delete_swap(text, text) from public, anon, authenticated;
revoke execute on function public.purge_swaps() from public, anon, authenticated;
grant execute on function public.swap_hash(text) to service_role;
grant execute on function public.swap_new_token() to service_role;
grant execute on function public.create_swap(jsonb) to service_role;
grant execute on function public.get_swap(text) to service_role;
grant execute on function public.swap_side(text, text) to service_role;
grant execute on function public.confirm_swap(text, text) to service_role;
grant execute on function public.add_swap_entry(text, text, jsonb) to service_role;
grant execute on function public.remove_swap_entry(text, text, text) to service_role;
grant execute on function public.delete_swap(text, text) to service_role;
grant execute on function public.purge_swaps() to service_role;
grant select, insert, update, delete on public.swaps to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-swaps';
    perform cron.schedule('purge-swaps', '23 4 * * *', 'select public.purge_swaps()');
  end if;
end $$;
