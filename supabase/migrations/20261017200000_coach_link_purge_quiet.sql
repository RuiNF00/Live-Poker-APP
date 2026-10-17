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
