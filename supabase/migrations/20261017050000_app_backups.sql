-- Cloud backup of the player's hands, keyed by a recovery code (no accounts in v1).
-- The code is <id>-<secret>; only sha256(secret) is stored. Server-only (service_role):
-- the web route checks the secret before anything is read, written or deleted.
-- Backups untouched for 18 months are deleted (privacy policy).

create table public.app_backups (
  id text primary key check (id ~ '^[0-9A-HJKMNP-TV-Z]{10}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  data bytea not null,
  content_type text not null check (content_type in ('application/json', 'application/gzip')),
  bytes integer not null check (bytes between 1 and 5242880),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_backups enable row level security;
revoke all on public.app_backups from anon, authenticated;
grant all on public.app_backups to service_role;

-- Create or replace. Returns false when the backup exists under another secret.
create or replace function public.put_app_backup(p_id text, p_key_hash text, p_data_b64 text, p_content_type text)
returns boolean language plpgsql security definer set search_path = public as $$
declare d bytea := decode(p_data_b64, 'base64');
begin
  insert into app_backups as b (id, key_hash, data, content_type, bytes)
  values (p_id, p_key_hash, d, p_content_type, length(d))
  on conflict (id) do update
    set data = excluded.data, content_type = excluded.content_type, bytes = excluded.bytes, updated_at = now()
    where b.key_hash = excluded.key_hash;
  return found;
end $$;

create or replace function public.get_app_backup(p_id text, p_key_hash text)
returns table (data_b64 text, content_type text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select encode(b.data, 'base64'), b.content_type, b.updated_at
  from app_backups b where b.id = p_id and b.key_hash = p_key_hash;
$$;

create or replace function public.delete_app_backup(p_id text, p_key_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from app_backups where id = p_id and key_hash = p_key_hash;
  return found;
end $$;

create or replace function public.purge_old_app_backups() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from app_backups where updated_at < now() - interval '18 months';
  get diagnostics n = row_count;
  return n;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'put_app_backup(text, text, text, text)', 'get_app_backup(text, text)',
    'delete_app_backup(text, text)', 'purge_old_app_backups()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-old-app-backups';
    perform cron.schedule('purge-old-app-backups', '27 3 * * *', 'select public.purge_old_app_backups()');
  end if;
end $$;
