-- "Delete all my data" also deletes the comments the player wrote on other players' shared hands.
-- The app sends its random commenter id (rl.commentAuthor.v1) before forgetting it; the web server
-- hashes it the same way as when commenting (author_key) and deletes every comment with that key.
-- Blocks that point at the key go too: the next comment comes from a new id anyway. Reports on the
-- comments go with them (on delete cascade).

create or replace function public.delete_comments_by_author(p_author_key text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_author_key is null or p_author_key !~ '^[a-f0-9]{64}$' then return 0; end if;
  delete from hand_comments where author_key = p_author_key;
  get diagnostics n = row_count;
  delete from hand_comment_blocks where author_key = p_author_key;
  return n;
end $$;

revoke execute on function public.delete_comments_by_author(text) from public, anon, authenticated;
grant execute on function public.delete_comments_by_author(text) to service_role;
