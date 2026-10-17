-- Several shared hands in one link (sweatbook.poker/p/<id>): "the 5 key hands of my day 2" for the
-- group chat or a coach. A pack only points at hands already shared through /h, and only the
-- player who owns each of those links can put it in a pack (its edit token is checked here).
-- Same rules as the other links: only the web server (service_role) reaches the table, the owner
-- token is kept as a hash, a hand deleted from sharing simply drops out of the pack, and
-- "delete all my data" deletes the pack itself.

create table public.hand_packs (
  id text primary key check (id ~ '^[a-f0-9]{12}$'),
  owner_token_hash text not null,
  title text not null default '' check (char_length(title) <= 80),
  hand_ids text[] not null check (cardinality(hand_ids) between 1 and 30),
  hide_amounts boolean not null default true,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.hand_packs enable row level security;
revoke all on public.hand_packs from anon, authenticated;

-- p_hands: [{ "id": "<share id>", "token": "<that share's edit token>" }], in the player's order.
-- Returns the pack id and the owner token, or nothing when a hand isn't the player's.
create or replace function public.create_hand_pack(p_title text, p_hands jsonb, p_hide boolean)
returns table (id text, owner_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_owner text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_ids text[];
begin
  if jsonb_typeof(p_hands) <> 'array' or jsonb_array_length(p_hands) not between 1 and 30 then
    raise exception 'a pack needs 1 to 30 hands';
  end if;
  if exists (select 1 from jsonb_array_elements(p_hands) h where not shared_hand_token_ok(h->>'id', h->>'token')) then
    return;
  end if;
  select array_agg(h.value->>'id' order by h.ordinality) into v_ids
    from jsonb_array_elements(p_hands) with ordinality h;
  insert into hand_packs (id, owner_token_hash, title, hand_ids, hide_amounts)
  values (v_id, encode(sha256(convert_to(v_owner, 'utf8')), 'hex'), coalesce(p_title, ''), v_ids, coalesce(p_hide, true));
  return query select v_id, v_owner;
end $$;

create or replace function public.get_hand_pack(p_id text)
returns table (id text, title text, hand_ids text[], hide_amounts boolean, view_count integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.hand_ids, p.hide_amounts, p.view_count, p.created_at from hand_packs p where p.id = p_id;
$$;

create or replace function public.record_pack_view(p_id text) returns void
language sql security definer set search_path = public as $$
  update hand_packs set view_count = view_count + 1 where id = p_id;
$$;

create or replace function public.delete_hand_pack(p_id text, p_owner_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from hand_packs where id = p_id and owner_token_hash = encode(sha256(convert_to(coalesce(p_owner_token, ''), 'utf8')), 'hex');
  return found;
end $$;

-- Every hand gone from sharing: the pack is an empty shell, so it goes too.
create or replace function public.purge_hand_packs() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from hand_packs p
   where not exists (select 1 from shared_hands s where s.id = any (p.hand_ids) and s.deleted_at is null);
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.create_hand_pack(text, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.get_hand_pack(text) from public, anon, authenticated;
revoke execute on function public.record_pack_view(text) from public, anon, authenticated;
revoke execute on function public.delete_hand_pack(text, text) from public, anon, authenticated;
revoke execute on function public.purge_hand_packs() from public, anon, authenticated;
grant execute on function public.create_hand_pack(text, jsonb, boolean) to service_role;
grant execute on function public.get_hand_pack(text) to service_role;
grant execute on function public.record_pack_view(text) to service_role;
grant execute on function public.delete_hand_pack(text, text) to service_role;
grant execute on function public.purge_hand_packs() to service_role;
grant select, insert, update, delete on public.hand_packs to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-hand-packs';
    perform cron.schedule('purge-hand-packs', '47 4 * * *', 'select public.purge_hand_packs()');
  end if;
end $$;
