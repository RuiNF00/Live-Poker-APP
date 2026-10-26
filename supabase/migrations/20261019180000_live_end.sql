-- Push-to-end (first update): ends a session's Live Activity on the other phones that share a
-- cloud-backup recovery code, when the session ends or is deleted on one of them.
-- Holds no session data: `slot` is HMAC(backup key, session id) made on the phone, `token` is the
-- Live Activity's APNs token. Rows are scoped to the backup id and its key hash (as app_backups),
-- taken (deleted) when used, and gone after 13 hours (a Live Activity lives 12 at most).
-- Numbered after 20261019070000 (Security, 19 Oct); check again against the integration before merging.

create table public.live_end (
  backup_id text not null check (backup_id ~ '^[0-9A-HJKMNP-TV-Z]{10}$'),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  slot text not null check (slot ~ '^[a-f0-9]{32}$'),
  token text not null check (token ~ '^[a-fA-F0-9]{16,200}$'),
  created_at timestamptz not null default now(),
  primary key (backup_id, slot, token)
);

create index live_end_created_idx on public.live_end (created_at);

alter table public.live_end enable row level security;
revoke all on public.live_end from anon, authenticated;

-- Register (or refresh) a token. At most 20 live rows per recovery code: one per phone and session.
create or replace function public.put_live_end(p_id text, p_key_hash text, p_slot text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from live_end where created_at < now() - interval '13 hours';
  if (select count(*) from live_end where backup_id = p_id and key_hash = p_key_hash) >= 20 then
    delete from live_end where ctid in (
      select ctid from live_end where backup_id = p_id and key_hash = p_key_hash order by created_at limit 1);
  end if;
  insert into live_end (backup_id, key_hash, slot, token) values (p_id, p_key_hash, p_slot, p_token)
  on conflict (backup_id, slot, token) do update set created_at = now(), key_hash = excluded.key_hash
  where live_end.key_hash = excluded.key_hash;
  return true;
end $$;

-- The tokens to end for a slot, removed as they are handed out (an end is sent once).
create or replace function public.take_live_end(p_id text, p_key_hash text, p_slot text) returns table (token text)
language sql security definer set search_path = public as $$
  delete from live_end
  where backup_id = p_id and key_hash = p_key_hash and slot = p_slot and created_at >= now() - interval '13 hours'
  returning live_end.token;
$$;

revoke all on function public.put_live_end(text, text, text, text) from public, anon, authenticated;
revoke all on function public.take_live_end(text, text, text) from public, anon, authenticated;
grant execute on function public.put_live_end(text, text, text, text) to service_role;
grant execute on function public.take_live_end(text, text, text) to service_role;
