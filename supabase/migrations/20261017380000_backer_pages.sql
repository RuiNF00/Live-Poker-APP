-- A backer's fixed link (sweatbook.poker/b#s=<id>.<key>): one page per player and backer, sent
-- once and kept current by the app. The page is sealed in the app (AES-256-GCM); the key rides
-- only in the link's fragment, so this table holds nothing it can read: no names, no amounts.
-- Same approach as the live links (20261017120000, 20261017340000): only the web server
-- (service_role) reaches it, writes need the edit token (only its hash is stored), the app picks
-- the token so a create sent twice makes one page, and pages nobody updates are purged.

create table public.backer_pages (
  id text primary key,
  edit_token_hash text not null unique,
  -- {"v":1,"n":"<nonce>","c":"<ciphertext>"}, or null until the app's first update.
  sealed jsonb
    check (sealed is null or (jsonb_typeof(sealed) = 'object' and sealed->>'v' = '1' and pg_column_size(sealed) < 65536)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index backer_pages_updated_idx on public.backer_pages (updated_at);

alter table public.backer_pages enable row level security;
revoke all on public.backer_pages from anon, authenticated;

create or replace function public.create_backer_page(p_token text) returns table (id text, edit_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_hash text;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'token'; end if;
  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');
  -- Same token again: the page made the first time.
  select p.id into v_id from public.backer_pages p where p.edit_token_hash = v_hash;
  if v_id is not null then
    return query select v_id, p_token;
    return;
  end if;
  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.backer_pages p where p.id = v_id);
  end loop;
  begin
    insert into public.backer_pages (id, edit_token_hash) values (v_id, v_hash);
  exception when unique_violation then
    -- Two copies of the same create at once: the other one won.
    select p.id into v_id from public.backer_pages p where p.edit_token_hash = v_hash;
  end;
  return query select v_id, p_token;
end $$;

create or replace function public.update_backer_page(p_id text, p_edit_token text, p_sealed jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.backer_pages p
     set sealed = p_sealed, updated_at = now()
   where p.id = p_id
     and p.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  return found;
end $$;

create or replace function public.delete_backer_page(p_id text, p_edit_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.backer_pages p
   where p.id = p_id
     and p.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  return found;
end $$;

create or replace function public.get_backer_page(p_id text)
returns table (id text, sealed jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.sealed, p.updated_at from public.backer_pages p where p.id = p_id;
$$;

-- A page the app hasn't touched for 180 days (no session, piece or payment with that backer) goes.
create or replace function public.purge_backer_pages() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.backer_pages where updated_at < now() - interval '180 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.create_backer_page(text) from public, anon, authenticated;
revoke execute on function public.update_backer_page(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_backer_page(text, text) from public, anon, authenticated;
revoke execute on function public.get_backer_page(text) from public, anon, authenticated;
revoke execute on function public.purge_backer_pages() from public, anon, authenticated;
grant execute on function public.create_backer_page(text) to service_role;
grant execute on function public.update_backer_page(text, text, jsonb) to service_role;
grant execute on function public.delete_backer_page(text, text) to service_role;
grant execute on function public.get_backer_page(text) to service_role;
grant execute on function public.purge_backer_pages() to service_role;
grant select, insert, update, delete on public.backer_pages to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-backer-pages';
    perform cron.schedule('purge-backer-pages', '23 4 * * *', 'select public.purge_backer_pages()');
  end if;
end $$;
