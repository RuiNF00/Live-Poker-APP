-- Feedback between players in the app: the owner of a shared hand removes a comment and blocks
-- whoever wrote it (App Store 1.2 / Play UGC: "block abusive users"), and the app asks how many
-- comments its hands have in one call.
--
-- No accounts: the commenter is the random id of their app install or browser, kept only as a
-- hash and never returned. A block holds on that hand: that author's comments hide and new ones
-- are refused. Blocks go with the hand (on delete cascade).

alter table public.hand_comments add column if not exists author_key text;
create index if not exists hand_comments_author_idx on public.hand_comments (hand_id, author_key) where author_key is not null;

create table if not exists public.hand_comment_blocks (
  hand_id text not null references public.shared_hands (id) on delete cascade,
  author_key text not null,
  created_at timestamptz not null default now(),
  primary key (hand_id, author_key)
);
alter table public.hand_comment_blocks enable row level security;
revoke all on public.hand_comment_blocks from anon, authenticated;

drop function if exists public.add_hand_comment(text, text, text, integer);
create function public.add_hand_comment(
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
  if p_author_key is not null and exists (select 1 from hand_comment_blocks b where b.hand_id = p_hand_id and b.author_key = p_author_key) then
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

-- The owner (edit token) hides one comment and blocks its author on that hand.
create or replace function public.block_hand_commenter(p_comment_id uuid, p_edit_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_hand text;
  v_key text;
begin
  select c.hand_id, c.author_key into v_hand, v_key
    from hand_comments c join shared_hands s on s.id = c.hand_id
   where c.id = p_comment_id
     and s.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  if v_hand is null then return false; end if;
  if v_key is not null then
    insert into hand_comment_blocks (hand_id, author_key) values (v_hand, v_key) on conflict do nothing;
  end if;
  update hand_comments
     set hidden = true, hidden_at = coalesce(hidden_at, now())
   where hand_id = v_hand and (id = p_comment_id or (v_key is not null and author_key = v_key));
  return true;
end $$;

-- Visible comments per hand, for the app's list of shared hands (at most 100 ids a call).
create or replace function public.hand_comment_counts(p_ids text[])
returns table (hand_id text, comments integer)
language sql stable security definer set search_path = public as $$
  select c.hand_id, count(*)::integer
    from hand_comments c join shared_hands s on s.id = c.hand_id
   where c.hand_id = any (p_ids[1:100]) and not c.hidden and s.deleted_at is null
   group by c.hand_id;
$$;

revoke execute on function public.add_hand_comment(text, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.block_hand_commenter(uuid, text) from public, anon, authenticated;
revoke execute on function public.hand_comment_counts(text[]) from public, anon, authenticated;
revoke execute on function public.hide_hand_comment(uuid, text) from public, anon, authenticated;
grant execute on function public.add_hand_comment(text, text, text, integer, text) to service_role;
grant execute on function public.block_hand_commenter(uuid, text) to service_role;
grant execute on function public.hand_comment_counts(text[]) to service_role;
grant execute on function public.hide_hand_comment(uuid, text) to service_role;
