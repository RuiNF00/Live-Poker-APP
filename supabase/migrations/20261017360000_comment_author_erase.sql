-- "Delete all my data" also deletes the comments the player wrote on other players' shared hands.
-- The app sends its random commenter id (rl.commentAuthor.v1) before forgetting it; the web server
-- hashes it the same way as when commenting (author_key) and deletes every comment with that key.
-- Reports on the comments go with them (on delete cascade). Blocks on the key stay (only a hash):
-- otherwise someone blocked could erase with their own id and comment again with it.

create or replace function public.delete_comments_by_author(p_author_key text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_author_key is null or p_author_key !~ '^[a-f0-9]{64}$' then return 0; end if;
  delete from hand_comments where author_key = p_author_key;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.delete_comments_by_author(text) from public, anon, authenticated;
grant execute on function public.delete_comments_by_author(text) to service_role;
