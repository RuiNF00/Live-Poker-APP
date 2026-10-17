-- Public player profiles (sweatbook.poker/u/<handle>): opt-in, made from the app, showing only
-- the shared hands and session cards the player picked. Same rules as the other public links
-- (security review 20261017090000): only the web server (service_role) reaches these tables,
-- writes need the edit token returned at creation (only its hash is stored), the owner's delete
-- is a real delete, and profiles hidden by reports are kept 30 days for review, then purged.

create table public.player_profiles (
  handle text primary key check (handle ~ '^[a-z0-9][a-z0-9_.]{2,19}$'),
  edit_token_hash text not null,
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object' and payload->>'v' = '1' and pg_column_size(payload) < 65536),
  view_count integer not null default 0,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_reports (
  handle text not null references public.player_profiles (handle) on delete cascade on update cascade,
  reporter_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (handle, reporter_id)
);

alter table public.player_profiles enable row level security;
alter table public.profile_reports enable row level security;
revoke all on public.player_profiles, public.profile_reports from anon, authenticated;

-- Returns the edit token, or null when the handle is taken.
create or replace function public.create_profile(p_handle text, p_payload jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  insert into public.player_profiles (handle, edit_token_hash, payload)
  values (p_handle, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), p_payload)
  on conflict (handle) do nothing;
  if not found then return null; end if;
  return v_token;
end $$;

-- p_new_handle renames the profile (the old link stops working). False with a wrong token
-- or a new handle that is taken.
create or replace function public.update_profile(p_handle text, p_edit_token text, p_payload jsonb, p_new_handle text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_new_handle is not null and p_new_handle <> p_handle
     and exists (select 1 from public.player_profiles where handle = p_new_handle) then
    return false;
  end if;
  update public.player_profiles p
     set payload = p_payload, handle = coalesce(p_new_handle, p.handle), updated_at = now()
   where p.handle = p_handle
     and p.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  return found;
end $$;

create or replace function public.delete_profile(p_handle text, p_edit_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.player_profiles p
   where p.handle = p_handle
     and p.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  return found;
end $$;

-- Live profiles only, never the token hash.
create or replace function public.get_profile(p_handle text)
returns table (handle text, payload jsonb, view_count integer, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.handle, p.payload, p.view_count, p.created_at, p.updated_at
    from player_profiles p where p.handle = p_handle and p.hidden_at is null;
$$;

create or replace function public.profile_handle_free(p_handle text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from player_profiles where handle = p_handle);
$$;

create or replace function public.record_profile_view(p_handle text) returns void
language sql security definer set search_path = public as $$
  update public.player_profiles set view_count = view_count + 1 where handle = p_handle and hidden_at is null;
$$;

-- Reporter ids come from the server (daily IP hash). Three different ones hide the profile for review.
create or replace function public.report_profile(p_handle text, p_reporter_id uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from player_profiles p where p.handle = p_handle and p.hidden_at is null) then return 'missing'; end if;
  insert into profile_reports (handle, reporter_id) values (p_handle, p_reporter_id) on conflict do nothing;
  if found and (select count(*) from profile_reports r where r.handle = p_handle) >= 3 then
    update player_profiles set hidden_at = now() where handle = p_handle and hidden_at is null;
    if found then return 'hidden'; end if;
  end if;
  return 'ok';
end $$;

-- For the review (SQL editor): select restore_profile('<handle>'); puts a reported profile back.
create or replace function public.restore_profile(p_handle text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update player_profiles set hidden_at = null where handle = p_handle and hidden_at is not null;
  if not found then return false; end if;
  delete from profile_reports where handle = p_handle;
  return true;
end $$;

-- Hidden for 30 days without a restore: gone for good. Returns how many.
create or replace function public.purge_hidden_profiles() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.player_profiles where hidden_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.create_profile(text, jsonb) from public, anon, authenticated;
revoke execute on function public.update_profile(text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.delete_profile(text, text) from public, anon, authenticated;
revoke execute on function public.get_profile(text) from public, anon, authenticated;
revoke execute on function public.profile_handle_free(text) from public, anon, authenticated;
revoke execute on function public.record_profile_view(text) from public, anon, authenticated;
revoke execute on function public.report_profile(text, uuid) from public, anon, authenticated;
revoke execute on function public.restore_profile(text) from public, anon, authenticated;
revoke execute on function public.purge_hidden_profiles() from public, anon, authenticated;
grant execute on function public.create_profile(text, jsonb) to service_role;
grant execute on function public.update_profile(text, text, jsonb, text) to service_role;
grant execute on function public.delete_profile(text, text) to service_role;
grant execute on function public.get_profile(text) to service_role;
grant execute on function public.profile_handle_free(text) to service_role;
grant execute on function public.record_profile_view(text) to service_role;
grant execute on function public.report_profile(text, uuid) to service_role;
grant execute on function public.restore_profile(text) to service_role;
grant execute on function public.purge_hidden_profiles() to service_role;
grant select, insert, update, delete on public.player_profiles, public.profile_reports to service_role;

-- Profiles can only list hands the player owns: the server checks each hand's edit token.
create or replace function public.shared_hand_token_ok(p_id text, p_edit_token text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from shared_hands s
     where s.id = p_id and s.deleted_at is null
       and s.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex'));
$$;
revoke execute on function public.shared_hand_token_ok(text, text) from public, anon, authenticated;
grant execute on function public.shared_hand_token_ok(text, text) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-hidden-profiles';
    perform cron.schedule('purge-hidden-profiles', '27 4 * * *', 'select public.purge_hidden_profiles()');
  end if;
end $$;
