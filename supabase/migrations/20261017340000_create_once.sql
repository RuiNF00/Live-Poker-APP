-- A create sent twice makes one row: a public hand link, a backer live link, a coach comment or a
-- player's reply. The app retries by itself when the signal comes back, and a create whose answer
-- was lost on the way may already exist (Velocidade). Same pattern as swaps (20261017300000):
--   - Hand and live links: the app picks the edit token itself (64 hex, one per link it is making)
--     and keeps it until the answer arrives. Only its hash is stored, as before; a second create with
--     the same token returns the link it already made. A token nobody else knows is the only way in.
--   - Coach comments and replies: a client key (the comment's local id) per link. A second post with
--     the same key returns the comment already there.
-- Old callers (no token, no key) still work and get a new row each time.

-- ---------- Public hand links ----------
create unique index if not exists shared_hands_edit_token_idx on public.shared_hands (edit_token_hash);

drop function if exists public.create_shared_hand(jsonb, text, boolean, jsonb, boolean);

create or replace function public.create_shared_hand(
  p_payload jsonb,
  p_title text default null,
  p_reveal_all boolean default false,
  p_quiz jsonb default null,
  p_allow_comments boolean default true,
  p_token text default null
) returns table (id text, edit_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token text := coalesce(p_token, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
  v_hash text;
begin
  if p_token is not null and p_token !~ '^[a-f0-9]{64}$' then raise exception 'token'; end if;
  v_hash := encode(sha256(convert_to(v_token, 'utf8')), 'hex');
  -- Same token again: the link made the first time (unless it was taken down since).
  select s.id into v_id from public.shared_hands s where s.edit_token_hash = v_hash and s.deleted_at is null;
  if v_id is not null then
    return query select v_id, v_token;
    return;
  end if;
  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.shared_hands s where s.id = v_id);
  end loop;
  begin
    insert into public.shared_hands (id, payload, title, owner_id, edit_token_hash, reveal_all, quiz, allow_comments)
    values (v_id, p_payload, nullif(btrim(p_title), ''), auth.uid(), v_hash,
            coalesce(p_reveal_all, false), p_quiz, coalesce(p_allow_comments, true));
  exception when unique_violation then
    -- Two copies of the same create at once: the other one won. A deleted link stays deleted.
    select s.id into v_id from public.shared_hands s where s.edit_token_hash = v_hash and s.deleted_at is null;
    if v_id is null then raise exception 'gone'; end if;
  end;
  return query select v_id, v_token;
end $$;

-- ---------- Backer live links ----------
create unique index if not exists live_sessions_edit_token_idx on public.live_sessions (edit_token_hash);

drop function if exists public.create_live_session(jsonb);

create or replace function public.create_live_session(p_payload jsonb, p_token text default null) returns table (id text, edit_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token text := coalesce(p_token, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
  v_hash text;
begin
  if p_token is not null and p_token !~ '^[a-f0-9]{64}$' then raise exception 'token'; end if;
  v_hash := encode(sha256(convert_to(v_token, 'utf8')), 'hex');
  -- Same token again: the link made the first time, left as it is (the app sends its updates after).
  select s.id into v_id from public.live_sessions s where s.edit_token_hash = v_hash;
  if v_id is not null then
    return query select v_id, v_token;
    return;
  end if;
  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.live_sessions s where s.id = v_id);
  end loop;
  begin
    insert into public.live_sessions (id, edit_token_hash, payload) values (v_id, v_hash, p_payload);
  exception when unique_violation then
    select s.id into v_id from public.live_sessions s where s.edit_token_hash = v_hash;
    if v_id is null then raise; end if;
  end;
  return query select v_id, v_token;
end $$;

-- ---------- Coach comments and the player's replies ----------
alter table public.coach_comments add column if not exists client_key text
  check (client_key is null or client_key ~ '^[A-Za-z0-9_-]{8,64}$');
create unique index if not exists coach_comments_client_key_idx on public.coach_comments (link_id, client_key) where client_key is not null;

create or replace function public.coach_comment_json(c public.coach_comments) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object('id', c.id, 'handId', c.hand_id, 'stepIndex', c.step_index, 'mark', c.mark,
                            'author', c.author, 'name', c.name, 'body', c.body, 'createdAt', c.created_at);
$$;

drop function if exists public.add_coach_comment(text, text, integer, text, text, text);

create or replace function public.add_coach_comment(p_token text, p_hand_id text, p_step integer, p_mark text, p_name text, p_body text, p_key text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; c coach_comments;
begin
  select l.id into v_id from coach_links l
   where l.token_hash = coach_hash(p_token) and l.revoked_at is null and (l.expires_at is null or l.expires_at > now());
  if v_id is null then return null; end if;
  -- Same key again: the comment already there.
  if p_key is not null then
    select * into c from coach_comments x where x.link_id = v_id and x.client_key = p_key and x.author = 'coach';
    if found then return coach_comment_json(c); end if;
  end if;
  if not exists (select 1 from coach_hands h where h.link_id = v_id and h.hand_id = p_hand_id)
     or (select count(*) from coach_comments x where x.link_id = v_id) >= 1000 then
    return null;
  end if;
  begin
    insert into coach_comments (link_id, hand_id, step_index, mark, author, name, body, client_key)
    values (v_id, p_hand_id, p_step, p_mark, 'coach', p_name, p_body, p_key) returning * into c;
  exception when unique_violation then
    select * into c from coach_comments x where x.link_id = v_id and x.client_key = p_key and x.author = 'coach';
    if not found then return null; end if;
  end;
  return coach_comment_json(c);
end $$;

drop function if exists public.add_player_reply(text, text, text, integer, text, text);

create or replace function public.add_player_reply(p_token text, p_owner_token text, p_hand_id text, p_step integer, p_name text, p_body text, p_key text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid := coach_link_owned(p_token, p_owner_token); c coach_comments;
begin
  if v_id is null then return null; end if;
  -- Same key again (the answer was lost): the reply already there, even if the link closed since.
  if p_key is not null then
    select * into c from coach_comments x where x.link_id = v_id and x.client_key = p_key and x.author = 'player';
    if found then return coach_comment_json(c); end if;
  end if;
  if not exists (select 1 from coach_links l where l.id = v_id and l.revoked_at is null and (l.expires_at is null or l.expires_at > now()))
     or not exists (select 1 from coach_hands h where h.link_id = v_id and h.hand_id = p_hand_id)
     or (select count(*) from coach_comments x where x.link_id = v_id) >= 1000 then
    return null;
  end if;
  begin
    insert into coach_comments (link_id, hand_id, step_index, mark, author, name, body, client_key)
    values (v_id, p_hand_id, p_step, null, 'player', p_name, p_body, p_key) returning * into c;
  exception when unique_violation then
    select * into c from coach_comments x where x.link_id = v_id and x.client_key = p_key and x.author = 'player';
    if not found then return null; end if;
  end;
  return coach_comment_json(c);
end $$;

revoke execute on function public.create_shared_hand(jsonb, text, boolean, jsonb, boolean, text) from public, anon, authenticated;
revoke execute on function public.create_live_session(jsonb, text) from public, anon, authenticated;
revoke execute on function public.coach_comment_json(public.coach_comments) from public, anon, authenticated;
revoke execute on function public.add_coach_comment(text, text, integer, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.add_player_reply(text, text, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.create_shared_hand(jsonb, text, boolean, jsonb, boolean, text) to service_role;
grant execute on function public.create_live_session(jsonb, text) to service_role;
grant execute on function public.add_coach_comment(text, text, integer, text, text, text, text) to service_role;
grant execute on function public.add_player_reply(text, text, text, integer, text, text, text) to service_role;
