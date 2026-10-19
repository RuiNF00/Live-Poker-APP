-- Blocking from the reader's side (Play "block users", Apple 1.2): whoever reads a friend's hand can
-- stop seeing one commenter there. The block lives on the reader's phone; the web server turns the
-- author key into an opaque per-hand id (HMAC with a server secret), so the key never leaves the server.

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

revoke execute on function public.list_hand_comments(text) from public, anon, authenticated;
grant execute on function public.list_hand_comments(text) to service_role;
