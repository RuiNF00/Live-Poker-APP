-- Live link for backers: a public page (sweatbook.poker/live/<id>) that follows a session.
-- Same approach as shared hands after the security review (20261017090000): only the web
-- server (service_role) can reach it, writes need the edit token returned at creation (only
-- its hash is stored), reads never return the hash, and links that stop updating are purged.

create table public.live_sessions (
  id text primary key,
  edit_token_hash text not null,
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object' and payload->>'v' = '1' and pg_column_size(payload) < 32768),
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index live_sessions_updated_idx on public.live_sessions (updated_at);

alter table public.live_sessions enable row level security;
revoke all on public.live_sessions from anon, authenticated;

create or replace function public.create_live_session(p_payload jsonb) returns table (id text, edit_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.live_sessions s where s.id = v_id);
  end loop;
  insert into public.live_sessions (id, edit_token_hash, payload)
  values (v_id, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), p_payload);
  return query select v_id, v_token;
end $$;

create or replace function public.update_live_session(p_id text, p_edit_token text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.live_sessions s
     set payload = p_payload, updated_at = now()
   where s.id = p_id
     and s.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  return found;
end $$;

create or replace function public.delete_live_session(p_id text, p_edit_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.live_sessions s
   where s.id = p_id
     and s.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  return found;
end $$;

create or replace function public.get_live_session(p_id text)
returns table (id text, payload jsonb, view_count integer, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.payload, s.view_count, s.created_at, s.updated_at from live_sessions s where s.id = p_id;
$$;

create or replace function public.record_live_view(p_id text) returns void
language sql security definer set search_path = public as $$
  update public.live_sessions set view_count = view_count + 1 where id = p_id;
$$;

-- A link nobody has updated for 30 days goes, page and all. Returns how many.
create or replace function public.purge_live_sessions() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.live_sessions where updated_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.create_live_session(jsonb) from public, anon, authenticated;
revoke execute on function public.update_live_session(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_live_session(text, text) from public, anon, authenticated;
revoke execute on function public.get_live_session(text) from public, anon, authenticated;
revoke execute on function public.record_live_view(text) from public, anon, authenticated;
revoke execute on function public.purge_live_sessions() from public, anon, authenticated;
grant execute on function public.create_live_session(jsonb) to service_role;
grant execute on function public.update_live_session(text, text, jsonb) to service_role;
grant execute on function public.delete_live_session(text, text) to service_role;
grant execute on function public.get_live_session(text) to service_role;
grant execute on function public.record_live_view(text) to service_role;
grant execute on function public.purge_live_sessions() to service_role;
grant select, insert, update, delete on public.live_sessions to service_role;

-- Daily purge when pg_cron is there (Supabase); the API also purges now and then.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-live-sessions';
    perform cron.schedule('purge-live-sessions', '17 4 * * *', 'select public.purge_live_sessions()');
  end if;
end $$;
