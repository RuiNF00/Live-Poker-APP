-- Private coaching links (sweatbook.poker/c/<token>): a player sends a set of hands to their coach,
-- who replays them on the web and comments on a street or action, marking lines as good, mistake or
-- question. Same rules as the other links (security review 20261017090000): only the web server
-- (service_role) reaches these tables; the link token and the player's owner token are only stored
-- as hashes. The token is the secret: 128 random bits, never listed or indexed anywhere. The player
-- can revoke a link at any time (the coach loses access at once, the player keeps reading the
-- comments); links revoked or expired more than 30 days ago are deleted with everything in them.

create table public.coach_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  owner_token_hash text not null,
  title text not null default '' check (char_length(title) <= 80),
  player_name text not null default '' check (char_length(player_name) <= 40),
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.coach_hands (
  link_id uuid not null references public.coach_links (id) on delete cascade,
  hand_id text not null check (hand_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  position integer not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 65536),
  primary key (link_id, hand_id)
);

create table public.coach_comments (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null,
  hand_id text not null,
  step_index integer check (step_index between 0 and 1000),
  mark text check (mark in ('good', 'mistake', 'question')),
  author text not null check (author in ('coach', 'player')),
  name text not null check (char_length(name) between 1 and 40),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (link_id, hand_id) references public.coach_hands (link_id, hand_id) on delete cascade
);
create index coach_comments_link_time on public.coach_comments (link_id, created_at);

alter table public.coach_links enable row level security;
alter table public.coach_hands enable row level security;
alter table public.coach_comments enable row level security;
revoke all on public.coach_links, public.coach_hands, public.coach_comments from anon, authenticated;

create or replace function public.coach_hash(p text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(coalesce(p, ''), 'utf8')), 'hex');
$$;

-- p_hands: [{ "id": "<local hand id>", "payload": { ...hand } }], 1 to 50, in the player's order.
-- Returns the link token (for the URL) and the owner token (kept on the phone).
create or replace function public.create_coach_link(p_title text, p_player text, p_expires_at timestamptz, p_hands jsonb)
returns table (token text, owner_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_owner text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_id uuid;
begin
  if jsonb_typeof(p_hands) <> 'array' or jsonb_array_length(p_hands) not between 1 and 50 then
    raise exception 'coach link needs 1 to 50 hands';
  end if;
  insert into coach_links (token_hash, owner_token_hash, title, player_name, expires_at)
  values (coach_hash(v_token), coach_hash(v_owner), coalesce(p_title, ''), coalesce(p_player, ''), p_expires_at)
  returning id into v_id;
  insert into coach_hands (link_id, hand_id, position, payload)
  select v_id, h.value->>'id', h.ordinality::int, h.value->'payload'
    from jsonb_array_elements(p_hands) with ordinality h;
  return query select v_token, v_owner;
end $$;

-- What the coach sees: null once revoked, expired or gone. Counts the visit.
create or replace function public.open_coach_link(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v coach_links;
begin
  update coach_links l set view_count = view_count + 1
   where l.token_hash = coach_hash(p_token) and l.revoked_at is null and (l.expires_at is null or l.expires_at > now())
  returning * into v;
  if not found then return null; end if;
  return jsonb_build_object(
    'title', v.title,
    'player', v.player_name,
    'expiresAt', v.expires_at,
    'createdAt', v.created_at,
    'hands', coalesce((select jsonb_agg(jsonb_build_object('id', h.hand_id, 'payload', h.payload) order by h.position)
                         from coach_hands h where h.link_id = v.id), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'handId', c.hand_id, 'stepIndex', c.step_index, 'mark', c.mark,
                                                              'author', c.author, 'name', c.name, 'body', c.body, 'createdAt', c.created_at)
                                           order by c.created_at)
                            from coach_comments c where c.link_id = v.id), '[]'::jsonb)
  );
end $$;

-- The coach comments (no account: a display name). Null when the link is not live, the hand is not in
-- it, or the link already holds 1000 comments.
create or replace function public.add_coach_comment(p_token text, p_hand_id text, p_step integer, p_mark text, p_name text, p_body text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; c coach_comments;
begin
  select l.id into v_id from coach_links l
   where l.token_hash = coach_hash(p_token) and l.revoked_at is null and (l.expires_at is null or l.expires_at > now());
  if v_id is null or not exists (select 1 from coach_hands h where h.link_id = v_id and h.hand_id = p_hand_id)
     or (select count(*) from coach_comments x where x.link_id = v_id) >= 1000 then
    return null;
  end if;
  insert into coach_comments (link_id, hand_id, step_index, mark, author, name, body)
  values (v_id, p_hand_id, p_step, p_mark, 'coach', p_name, p_body) returning * into c;
  return jsonb_build_object('id', c.id, 'handId', c.hand_id, 'stepIndex', c.step_index, 'mark', c.mark,
                            'author', c.author, 'name', c.name, 'body', c.body, 'createdAt', c.created_at);
end $$;

-- The player's side (owner token): works on a revoked or expired link until it is purged, so no
-- comment is lost. Returns the link's id, or null with a wrong token.
create or replace function public.coach_link_owned(p_token text, p_owner_token text) returns uuid
language sql stable security definer set search_path = public as $$
  select l.id from coach_links l where l.token_hash = coach_hash(p_token) and l.owner_token_hash = coach_hash(p_owner_token);
$$;

create or replace function public.coach_comments_since(p_token text, p_owner_token text, p_since timestamptz)
returns table (id uuid, hand_id text, step_index integer, mark text, author text, name text, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.hand_id, c.step_index, c.mark, c.author, c.name, c.body, c.created_at
    from coach_comments c
   where c.link_id = coach_link_owned(p_token, p_owner_token)
     and (p_since is null or c.created_at > p_since)
   order by c.created_at
   limit 500;
$$;

-- The player's reply (only while the link is live, so the coach can read it).
create or replace function public.add_player_reply(p_token text, p_owner_token text, p_hand_id text, p_step integer, p_name text, p_body text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid := coach_link_owned(p_token, p_owner_token); c coach_comments;
begin
  if v_id is null
     or not exists (select 1 from coach_links l where l.id = v_id and l.revoked_at is null and (l.expires_at is null or l.expires_at > now()))
     or not exists (select 1 from coach_hands h where h.link_id = v_id and h.hand_id = p_hand_id)
     or (select count(*) from coach_comments x where x.link_id = v_id) >= 1000 then
    return null;
  end if;
  insert into coach_comments (link_id, hand_id, step_index, mark, author, name, body)
  values (v_id, p_hand_id, p_step, null, 'player', p_name, p_body) returning * into c;
  return jsonb_build_object('id', c.id, 'handId', c.hand_id, 'stepIndex', c.step_index, 'mark', c.mark,
                            'author', c.author, 'name', c.name, 'body', c.body, 'createdAt', c.created_at);
end $$;

create or replace function public.revoke_coach_link(p_token text, p_owner_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update coach_links set revoked_at = coalesce(revoked_at, now())
   where id = coach_link_owned(p_token, p_owner_token);
  return found;
end $$;

-- Revoked or expired for 30 days: gone with its hands and comments. Returns how many links.
create or replace function public.purge_coach_links() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from coach_links where revoked_at < now() - interval '30 days' or expires_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.coach_hash(text) from public, anon, authenticated;
revoke execute on function public.create_coach_link(text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.open_coach_link(text) from public, anon, authenticated;
revoke execute on function public.add_coach_comment(text, text, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.coach_link_owned(text, text) from public, anon, authenticated;
revoke execute on function public.coach_comments_since(text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.add_player_reply(text, text, text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.revoke_coach_link(text, text) from public, anon, authenticated;
revoke execute on function public.purge_coach_links() from public, anon, authenticated;
grant execute on function public.create_coach_link(text, text, timestamptz, jsonb) to service_role;
grant execute on function public.open_coach_link(text) to service_role;
grant execute on function public.add_coach_comment(text, text, integer, text, text, text) to service_role;
grant execute on function public.coach_comments_since(text, text, timestamptz) to service_role;
grant execute on function public.add_player_reply(text, text, text, integer, text, text) to service_role;
grant execute on function public.revoke_coach_link(text, text) to service_role;
grant execute on function public.purge_coach_links() to service_role;
grant select, insert, update, delete on public.coach_links, public.coach_hands, public.coach_comments to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-coach-links';
    perform cron.schedule('purge-coach-links', '37 4 * * *', 'select public.purge_coach_links()');
  end if;
end $$;
