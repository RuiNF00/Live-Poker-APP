-- Security review (2026-10-17, /mnt/project-files/security/revisao-seguranca.md):
--   1. Referral rewards are tied to the RevenueCat user, not the (client-chosen) install.
--   2. Reports and votes count server-derived ids (daily IP hash), and a reported hand is
--      hidden for review, not deleted.
--   3. Nothing is reachable with the anon/authenticated keys: the web server is the only
--      client and uses service_role.
--   4. "Delete link" really deletes; hidden hands and comments are purged after 30 days.
--   6. Database-backed rate limits and a storage quota for backups.

-- ---------- 3. Close the database to anon / authenticated ----------

drop policy if exists "read live shares" on public.shared_hands;
drop policy if exists "owners read their shares" on public.shared_hands;
drop policy if exists "read visible comments" on public.hand_comments;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;

-- ---------- 4. Real delete, moderation with review ----------

alter table public.hand_comments add column if not exists hidden_at timestamptz;
update public.hand_comments set hidden_at = created_at where hidden and hidden_at is null;

-- shared_hands.deleted_at now means "taken down by reports, waiting for review": owners
-- delete for real. Rows soft-deleted by owners before this migration go now.
delete from public.shared_hands s
where s.deleted_at is not null
  and (select count(*) from public.hand_reports r where r.hand_id = s.id) < 5;

create or replace function public.delete_shared_hand(p_id text, p_edit_token text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  -- Comments, votes and reports go with it (on delete cascade).
  delete from public.shared_hands s
   where s.id = p_id
     and ((auth.uid() is not null and s.owner_id = auth.uid())
          or s.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex'));
  return found;
end $$;

create or replace function public.hide_hand_comment(p_comment_id uuid, p_edit_token text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.hand_comments c
     set hidden = true, hidden_at = coalesce(c.hidden_at, now())
    from public.shared_hands s
   where c.id = p_comment_id
     and s.id = c.hand_id
     and ((auth.uid() is not null and s.owner_id = auth.uid())
          or s.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex'));
  return found;
end $$;

-- Reads go through these now that the server role bypasses RLS: only live hands, only
-- visible comments, never the secret columns.
create or replace function public.get_shared_hand(p_id text)
returns table (id text, payload jsonb, title text, reveal_all boolean, quiz jsonb, allow_comments boolean, view_count integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.payload, s.title, s.reveal_all, s.quiz, s.allow_comments, s.view_count, s.created_at
  from shared_hands s where s.id = p_id and s.deleted_at is null;
$$;

create or replace function public.list_hand_comments(p_hand_id text)
returns table (id uuid, author_name text, body text, step_index integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.author_name, c.body, c.step_index, c.created_at
  from hand_comments c join shared_hands s on s.id = c.hand_id
  where c.hand_id = p_hand_id and not c.hidden and s.deleted_at is null
  order by c.created_at
  limit 500;
$$;

-- Reporter ids are derived by the server from the IP (a daily-rotating hash), so one
-- person can't count as five. Returns 'missing', 'ok' or 'hidden' (this report hid it).
drop function if exists public.report_hand_comment(uuid, uuid);
create function public.report_hand_comment(p_comment_id uuid, p_reporter_id uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from hand_comments c where c.id = p_comment_id) then return 'missing'; end if;
  insert into hand_comment_reports (comment_id, reporter_id) values (p_comment_id, p_reporter_id)
  on conflict do nothing;
  if found and (select count(*) from hand_comment_reports r where r.comment_id = p_comment_id) >= 3 then
    update hand_comments set hidden = true, hidden_at = now() where id = p_comment_id and not hidden;
    if found then return 'hidden'; end if;
  end if;
  return 'ok';
end $$;

drop function if exists public.report_shared_hand(text, uuid, text);
create function public.report_shared_hand(p_hand_id text, p_reporter_id uuid, p_reason text default null) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from shared_hands h where h.id = p_hand_id and h.deleted_at is null) then return 'missing'; end if;
  insert into hand_reports (hand_id, reporter_id, reason) values (p_hand_id, p_reporter_id, left(p_reason, 200))
  on conflict do nothing;
  if found and (select count(*) from hand_reports r where r.hand_id = p_hand_id) >= 5 then
    update shared_hands set deleted_at = now() where id = p_hand_id and deleted_at is null;
    if found then return 'hidden'; end if;
  end if;
  return 'ok';
end $$;

-- For the review (SQL editor): select restore_shared_hand('<id>'); puts a reported hand back.
create or replace function public.restore_shared_hand(p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update shared_hands set deleted_at = null where id = p_id and deleted_at is not null;
  if not found then return false; end if;
  delete from hand_reports where hand_id = p_id;
  return true;
end $$;

-- Votes: voter ids are derived by the server from the browser's id; at most 5 voters
-- per IP (daily hash) per hand, so one person can't stuff the poll.
alter table public.hand_votes add column if not exists ip_hash text check (char_length(ip_hash) <= 64);
drop function if exists public.cast_hand_vote(text, uuid, text);
create function public.cast_hand_vote(p_hand_id text, p_voter_id uuid, p_choice text, p_ip_hash text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from shared_hands h where h.id = p_hand_id and h.deleted_at is null) then return; end if;
  if not exists (select 1 from hand_votes v where v.hand_id = p_hand_id and v.voter_id = p_voter_id)
     and (select count(*) from hand_votes v where v.hand_id = p_hand_id and v.ip_hash = p_ip_hash) >= 5 then
    return;
  end if;
  insert into hand_votes (hand_id, voter_id, choice, ip_hash) values (p_hand_id, p_voter_id, p_choice, p_ip_hash)
  on conflict (hand_id, voter_id) do update set choice = excluded.choice, ip_hash = excluded.ip_hash, created_at = now();
end $$;

-- ---------- 6. Rate limits that hold across server instances ----------

create table if not exists public.rate_limits (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key, window_start)
);
alter table public.rate_limits enable row level security;

-- True when this hit goes over p_max in the current fixed window. key is an IP hash.
create or replace function public.hit_rate_limit(p_bucket text, p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into rate_limits as r (bucket, key, window_start, hits) values (left(p_bucket, 40), left(p_key, 64), w, 1)
  on conflict (bucket, key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  return n > p_max;
end $$;

-- Backups: 2 MB each (gzip JSON is far smaller), at most 300 new backups an hour across
-- everyone, and a 250 MB ceiling in total so the database can't be filled up.
alter table public.app_backups drop constraint if exists app_backups_bytes_check;
alter table public.app_backups add constraint app_backups_bytes_check check (bytes between 1 and 2097152) not valid;

create or replace function public.put_app_backup(p_id text, p_key_hash text, p_data_b64 text, p_content_type text)
returns boolean language plpgsql security definer set search_path = public as $$
declare d bytea := decode(p_data_b64, 'base64'); old integer;
begin
  select bytes into old from app_backups where id = p_id;
  if old is null and (select count(*) from app_backups where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'quota' using errcode = 'P0001';
  end if;
  if (select coalesce(sum(bytes), 0) from app_backups) - coalesce(old, 0) + length(d) > 262144000 then
    raise exception 'quota' using errcode = 'P0001';
  end if;
  insert into app_backups as b (id, key_hash, data, content_type, bytes)
  values (p_id, p_key_hash, d, p_content_type, length(d))
  on conflict (id) do update
    set data = excluded.data, content_type = excluded.content_type, bytes = excluded.bytes, updated_at = now()
    where b.key_hash = excluded.key_hash;
  return found;
end $$;

-- ---------- 1. Referral rewards per RevenueCat user ----------

-- The RevenueCat user is remembered once per install and never replaced, so nobody can
-- redirect someone else's rewards by sending their installId.
create or replace function public.referral_code_for(p_install_id uuid, p_code text, p_rc_user_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  insert into referral_codes (install_id, code, rc_user_id)
  values (p_install_id, p_code, nullif(p_rc_user_id, ''))
  on conflict (install_id) do update set rc_user_id = coalesce(referral_codes.rc_user_id, excluded.rc_user_id)
  returning coalesce(app_code, code) into c;
  if p_code ~ '^[0-9a-f]{10}$' and c <> p_code and c !~ '^[0-9a-f]{10}$'
     and not exists (select 1 from referral_codes where code = p_code or app_code = p_code) then
    update referral_codes set app_code = p_code where install_id = p_install_id;
    c := p_code;
  end if;
  return c;
end $$;

-- The friend's stored RevenueCat user when a claimed referral waits for activation, else
-- null. The server checks that user on RevenueCat before calling activate_referral.
create or replace function public.referral_awaiting_rc(p_friend uuid) returns text
language sql stable security definer set search_path = public as $$
  select c.rc_user_id from referrals r join referral_codes c on c.install_id = r.friend_install_id
  where r.friend_install_id = p_friend and r.activated_at is null;
$$;

-- Rewards need both RevenueCat users. A RevenueCat user gets the friend reward once, ever
-- (however many installs it shows up on), and earns as a referrer for at most 10 friends
-- per 365 days across all its installs. Same user on both sides earns nothing.
create or replace function public.activate_referral(p_friend uuid, p_days integer default 7)
returns table (install_id uuid, rc_user_id text, pro_until timestamptz)
language plpgsql security definer set search_path = public as $$
declare r referrals%rowtype; friend_rc text; ref_rc text; earned integer;
begin
  select * into r from referrals where friend_install_id = p_friend for update;
  if not found or r.activated_at is not null then return; end if;
  select c.rc_user_id into friend_rc from referral_codes c where c.install_id = p_friend;
  if friend_rc is null then return; end if; -- the app retries with its RevenueCat id
  select c.rc_user_id into ref_rc from referral_codes c where c.install_id = r.referrer_install_id;
  update referrals set activated_at = now() where friend_install_id = p_friend;
  if ref_rc is not null and ref_rc = friend_rc then return; end if;

  if not exists (
    select 1 from referral_rewards w join referral_codes c on c.install_id = w.install_id
    where w.role = 'friend' and c.rc_user_id = friend_rc
  ) then
    insert into referral_rewards (install_id, friend_install_id, role, days, pro_until)
    values (p_friend, p_friend, 'friend', p_days, now() + make_interval(days => p_days));
  end if;

  if ref_rc is not null then
    select count(*) into earned from referral_rewards w join referral_codes c on c.install_id = w.install_id
    where w.role = 'referrer' and c.rc_user_id = ref_rc and w.created_at > now() - interval '365 days';
    if earned < 10 then
      insert into referral_rewards (install_id, friend_install_id, role, days, pro_until)
      values (
        r.referrer_install_id, p_friend, 'referrer', p_days,
        greatest(now(), coalesce((select max(w.pro_until) from referral_rewards w where w.install_id = r.referrer_install_id), now()))
          + make_interval(days => p_days)
      );
    end if;
  end if;

  return query
    select * from pending_referral_grants(p_friend)
    union all
    select * from pending_referral_grants(r.referrer_install_id);
end $$;

-- ---------- Retention for all of the above ----------

-- Hands taken down by reports and hidden comments are kept 30 days for review, then
-- deleted. Report rows and vote IP hashes don't outlive their purpose either.
create or replace function public.purge_moderation() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from shared_hands where deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  delete from hand_comments where hidden and hidden_at < now() - interval '30 days';
  delete from hand_reports where created_at < now() - interval '30 days';
  delete from hand_comment_reports where created_at < now() - interval '30 days';
  update hand_votes set ip_hash = null where ip_hash is not null and created_at < now() - interval '2 days';
  delete from rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;

-- ---------- Grants: service_role only ----------

revoke execute on all functions in schema public from public, anon, authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-moderation';
    perform cron.schedule('purge-moderation', '37 3 * * *', 'select public.purge_moderation()');
  end if;
end $$;
