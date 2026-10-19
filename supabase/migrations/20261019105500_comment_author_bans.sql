-- App Store 1.2: the team removes objectionable content and ejects whoever posted it. A hand's
-- owner can already block a commenter on that hand (20261017265000); this lets the team stop one
-- author on every hand. There are no accounts: an author is the hash of the random id of the app
-- install or browser (author_key), so a ban is that hash, kept one year, never a name or an IP.
-- Used from the SQL editor by the person reviewing a report (security/incidentes.md §3).

create table if not exists public.banned_comment_authors (
  author_key text primary key check (author_key ~ '^[0-9a-f]{64}$'),
  banned_at timestamptz not null default now()
);
alter table public.banned_comment_authors enable row level security;
revoke all on public.banned_comment_authors from anon, authenticated;
grant select, insert, update, delete on public.banned_comment_authors to service_role;

-- Hides every comment by the author of p_comment_id, on every hand, and refuses their new ones.
-- Returns how many comments it hid; null when the comment doesn't exist. A comment without an
-- author_key (from before 20261017265000) is hidden on its own.
create or replace function public.ban_comment_author(p_comment_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare v_key text; n integer;
begin
  select c.author_key into v_key from hand_comments c where c.id = p_comment_id;
  if not found then return null; end if;
  if v_key is not null then
    insert into banned_comment_authors (author_key) values (v_key)
    on conflict (author_key) do update set banned_at = now();
  end if;
  update hand_comments
     set hidden = true, hidden_at = coalesce(hidden_at, now())
   where (id = p_comment_id or (v_key is not null and author_key = v_key)) and not hidden;
  get diagnostics n = row_count;
  return n;
end $$;

-- Lifts the ban on the author of p_comment_id, to correct a mistake; their hidden comments stay
-- hidden (restore_hand_comment puts one back). False when there was no ban.
create or replace function public.unban_comment_author(p_comment_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from banned_comment_authors b using hand_comments c
   where c.id = p_comment_id and b.author_key = c.author_key;
  return found;
end $$;

-- Undoes a report review on one comment: shown again and its reports cleared (like
-- restore_shared_hand and restore_profile). Doesn't lift a ban.
create or replace function public.restore_hand_comment(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update hand_comments set hidden = false, hidden_at = null where id = p_id and hidden;
  if not found then return false; end if;
  delete from hand_comment_reports where comment_id = p_id;
  return true;
end $$;

-- Same as 20261017265000, plus the ban: a banned author gets the same 'blocked' as a block on
-- one hand, so the app and the site say only that the comment couldn't be sent.
create or replace function public.add_hand_comment(
  p_hand_id text,
  p_author_name text,
  p_body text,
  p_step_index integer default null,
  p_author_key text default null
) returns setof public.hand_comments
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from shared_hands h where h.id = p_hand_id and h.deleted_at is null and h.allow_comments) then
    return;
  end if;
  if p_author_key is not null and (
       exists (select 1 from hand_comment_blocks b where b.hand_id = p_hand_id and b.author_key = p_author_key)
    or exists (select 1 from banned_comment_authors x where x.author_key = p_author_key)) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  -- Flood guard: a hand takes at most 20 comments a minute.
  if (select count(*) from hand_comments c where c.hand_id = p_hand_id and c.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return query
    insert into hand_comments (hand_id, author_name, body, step_index, user_id, author_key)
    values (p_hand_id, btrim(p_author_name), btrim(p_body), p_step_index, auth.uid(), p_author_key)
    returning *;
end $$;

-- 20261019105000 plus the bans, kept one year.
create or replace function public.purge_moderation() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from shared_hands where deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  delete from hand_comments where hidden and hidden_at < now() - interval '30 days';
  delete from hand_reports where created_at < now() - interval '30 days';
  delete from hand_comment_reports where created_at < now() - interval '30 days';
  delete from profile_reports where created_at < now() - interval '30 days';
  delete from banned_comment_authors where banned_at < now() - interval '1 year';
  update hand_votes set ip_hash = null where ip_hash is not null and created_at < now() - interval '2 days';
  delete from rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;

revoke execute on function public.ban_comment_author(uuid) from public, anon, authenticated;
revoke execute on function public.restore_hand_comment(uuid) from public, anon, authenticated;
revoke execute on function public.unban_comment_author(uuid) from public, anon, authenticated;
revoke execute on function public.add_hand_comment(text, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.purge_moderation() from public, anon, authenticated;
grant execute on function public.ban_comment_author(uuid) to service_role;
grant execute on function public.restore_hand_comment(uuid) to service_role;
grant execute on function public.unban_comment_author(uuid) to service_role;
grant execute on function public.add_hand_comment(text, text, text, integer, text) to service_role;
