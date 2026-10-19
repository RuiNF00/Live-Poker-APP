-- "Delete all my data" on the phone: the coaching link goes now, with its hands and comments,
-- instead of waiting 30 days after a revoke. Only with the player's owner token.
create or replace function public.delete_coach_link(p_token text, p_owner_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from coach_links where id = coach_link_owned(p_token, p_owner_token);
  return found;
end $$;

revoke execute on function public.delete_coach_link(text, text) from public, anon, authenticated;
grant execute on function public.delete_coach_link(text, text) to service_role;

-- Links with no end date don't live forever: gone after 400 days without a new comment (like swaps).
create or replace function public.purge_coach_links() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from coach_links l
   where l.revoked_at < now() - interval '30 days'
      or l.expires_at < now() - interval '30 days'
      or (l.expires_at is null and l.created_at < now() - interval '400 days'
          and not exists (select 1 from coach_comments c where c.link_id = l.id and c.created_at > now() - interval '400 days'));
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.purge_coach_links() from public, anon, authenticated;
grant execute on function public.purge_coach_links() to service_role;
