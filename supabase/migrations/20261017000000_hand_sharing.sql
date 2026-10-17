-- Hand sharing: public share links, comments from friends (no account needed) and
-- "what would you do?" votes. Every write from the public goes through a
-- security definer function so the rules live in one place.

create table public.shared_hands (
  id text primary key,
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object' and (payload->>'v' = '1' or payload->>'version' = '1') and pg_column_size(payload) < 65536),
  title text check (char_length(title) <= 120),
  owner_id uuid references auth.users (id) on delete set null,
  edit_token_hash text not null,
  reveal_all boolean not null default false,
  quiz jsonb check (quiz is null or (quiz ? 'street' and quiz ? 'actionIndex')),
  allow_comments boolean not null default true,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index shared_hands_owner_idx on public.shared_hands (owner_id, created_at desc);

create table public.hand_comments (
  id uuid primary key default gen_random_uuid(),
  hand_id text not null references public.shared_hands (id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 40),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  step_index integer check (step_index between 0 and 500),
  user_id uuid references auth.users (id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index hand_comments_hand_idx on public.hand_comments (hand_id, created_at);

create table public.hand_votes (
  hand_id text not null references public.shared_hands (id) on delete cascade,
  voter_id uuid not null,
  choice text not null check (choice in ('fold', 'check', 'call', 'bet', 'raise', 'allin')),
  created_at timestamptz not null default now(),
  primary key (hand_id, voter_id)
);

alter table public.shared_hands enable row level security;
alter table public.hand_comments enable row level security;
alter table public.hand_votes enable row level security;

-- Anyone with the link can read a live share and its visible comments.
create policy "read live shares" on public.shared_hands
  for select to anon, authenticated
  using (deleted_at is null);

create policy "owners read their shares" on public.shared_hands
  for select to authenticated
  using (owner_id = auth.uid());

create policy "read visible comments" on public.hand_comments
  for select to anon, authenticated
  using (
    not hidden
    and exists (select 1 from public.shared_hands h where h.id = hand_id and h.deleted_at is null)
  );

-- Individual votes stay private; counts come from hand_vote_counts().

-- ---------- functions ----------

create or replace function public.short_id() returns text
language sql volatile as $$
  select substr(translate(encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'base64'), '+/=', ''), 1, 10)
$$;

create or replace function public.create_shared_hand(
  p_payload jsonb,
  p_title text default null,
  p_reveal_all boolean default false,
  p_quiz jsonb default null,
  p_allow_comments boolean default true
) returns table (id text, edit_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.shared_hands s where s.id = v_id);
  end loop;
  insert into public.shared_hands (id, payload, title, owner_id, edit_token_hash, reveal_all, quiz, allow_comments)
  values (v_id, p_payload, nullif(btrim(p_title), ''), auth.uid(), encode(sha256(convert_to(v_token, 'utf8')), 'hex'),
          coalesce(p_reveal_all, false), p_quiz, coalesce(p_allow_comments, true));
  return query select v_id, v_token;
end $$;

-- Owner deletes a share: signed-in owner, or anyone holding the edit token returned at creation.
create or replace function public.delete_shared_hand(p_id text, p_edit_token text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.shared_hands s
     set deleted_at = now()
   where s.id = p_id
     and s.deleted_at is null
     and ((auth.uid() is not null and s.owner_id = auth.uid())
          or s.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex'));
  return found;
end $$;

create or replace function public.record_hand_view(p_id text) returns void
language sql security definer set search_path = public as $$
  update public.shared_hands set view_count = view_count + 1 where id = p_id and deleted_at is null;
$$;

create or replace function public.add_hand_comment(
  p_hand_id text,
  p_author_name text,
  p_body text,
  p_step_index integer default null
) returns setof public.hand_comments
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.shared_hands h where h.id = p_hand_id and h.deleted_at is null and h.allow_comments) then
    return;
  end if;
  -- Flood guard: a hand takes at most 20 comments a minute.
  if (select count(*) from public.hand_comments c where c.hand_id = p_hand_id and c.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return query
    insert into public.hand_comments (hand_id, author_name, body, step_index, user_id)
    values (p_hand_id, btrim(p_author_name), btrim(p_body), p_step_index, auth.uid())
    returning *;
end $$;

-- Owner hides a comment (moderation), with the edit token or as the signed-in owner.
create or replace function public.hide_hand_comment(p_comment_id uuid, p_edit_token text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.hand_comments c
     set hidden = true
    from public.shared_hands s
   where c.id = p_comment_id
     and s.id = c.hand_id
     and ((auth.uid() is not null and s.owner_id = auth.uid())
          or s.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex'));
  return found;
end $$;

create or replace function public.cast_hand_vote(p_hand_id text, p_voter_id uuid, p_choice text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.shared_hands h where h.id = p_hand_id and h.deleted_at is null and h.quiz is not null) then
    return;
  end if;
  insert into public.hand_votes (hand_id, voter_id, choice)
  values (p_hand_id, p_voter_id, p_choice)
  on conflict (hand_id, voter_id) do update set choice = excluded.choice, created_at = now();
end $$;

create or replace function public.hand_vote_counts(p_hand_id text) returns table (choice text, votes bigint)
language sql stable security definer set search_path = public as $$
  select v.choice, count(*) from public.hand_votes v where v.hand_id = p_hand_id group by v.choice;
$$;

revoke all on function public.create_shared_hand(jsonb, text, boolean, jsonb, boolean) from public;
revoke all on function public.delete_shared_hand(text, text) from public;
revoke all on function public.record_hand_view(text) from public;
revoke all on function public.add_hand_comment(text, text, text, integer) from public;
revoke all on function public.hide_hand_comment(uuid, text) from public;
revoke all on function public.cast_hand_vote(text, uuid, text) from public;
revoke all on function public.hand_vote_counts(text) from public;

grant execute on function public.create_shared_hand(jsonb, text, boolean, jsonb, boolean) to anon, authenticated;
grant execute on function public.delete_shared_hand(text, text) to anon, authenticated;
grant execute on function public.record_hand_view(text) to anon, authenticated;
grant execute on function public.add_hand_comment(text, text, text, integer) to anon, authenticated;
grant execute on function public.hide_hand_comment(uuid, text) to anon, authenticated;
grant execute on function public.cast_hand_vote(text, uuid, text) to anon, authenticated;
grant execute on function public.hand_vote_counts(text) to anon, authenticated;

-- Column grants keep owner_id and edit_token_hash out of public reads.
revoke all on public.shared_hands, public.hand_comments, public.hand_votes from anon, authenticated;
grant select (id, payload, title, reveal_all, quiz, allow_comments, view_count, created_at, deleted_at)
  on public.shared_hands to anon, authenticated;
grant select (id, hand_id, author_name, body, step_index, created_at)
  on public.hand_comments to anon, authenticated;
