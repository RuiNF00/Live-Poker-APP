-- Blocking from the reader's side (Play "block users", Apple 1.2): whoever reads a hand can stop
-- seeing one commenter, or every hand from one sender. The block lives on the reader's phone; the
-- server only hands out opaque ids for it (an HMAC with a server secret, computed in the web server),
-- so the raw keys below never leave the database.

alter table public.shared_hands add column if not exists sender_key text;

drop function if exists public.create_shared_hand(jsonb, text, boolean, jsonb, boolean);
create function public.create_shared_hand(
  p_payload jsonb,
  p_title text default null,
  p_reveal_all boolean default false,
  p_quiz jsonb default null,
  p_allow_comments boolean default true,
  p_sender_key text default null
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
  insert into public.shared_hands (id, payload, title, owner_id, edit_token_hash, reveal_all, quiz, allow_comments, sender_key)
  values (v_id, p_payload, nullif(btrim(p_title), ''), auth.uid(), encode(sha256(convert_to(v_token, 'utf8')), 'hex'),
          coalesce(p_reveal_all, false), p_quiz, coalesce(p_allow_comments, true), left(p_sender_key, 64));
  return query select v_id, v_token;
end $$;

drop function if exists public.get_shared_hand(text);
create function public.get_shared_hand(p_id text)
returns table (id text, payload jsonb, title text, reveal_all boolean, quiz jsonb, allow_comments boolean, view_count integer, created_at timestamptz, sender_key text)
language sql stable security definer set search_path = public as $$
  select s.id, s.payload, s.title, s.reveal_all, s.quiz, s.allow_comments, s.view_count, s.created_at, s.sender_key
  from shared_hands s where s.id = p_id and s.deleted_at is null;
$$;

drop function if exists public.list_hand_comments(text);
create function public.list_hand_comments(p_hand_id text)
returns table (id uuid, author_name text, body text, step_index integer, created_at timestamptz, author_key text)
language sql stable security definer set search_path = public as $$
  select c.id, c.author_name, c.body, c.step_index, c.created_at, c.author_key
  from hand_comments c join shared_hands s on s.id = c.hand_id
  where c.hand_id = p_hand_id and not c.hidden and s.deleted_at is null
  order by c.created_at
  limit 500;
$$;

revoke execute on function public.create_shared_hand(jsonb, text, boolean, jsonb, boolean, text) from public, anon, authenticated;
revoke execute on function public.get_shared_hand(text) from public, anon, authenticated;
revoke execute on function public.list_hand_comments(text) from public, anon, authenticated;
grant execute on function public.create_shared_hand(jsonb, text, boolean, jsonb, boolean, text) to service_role;
grant execute on function public.get_shared_hand(text) to service_role;
grant execute on function public.list_hand_comments(text) to service_role;
