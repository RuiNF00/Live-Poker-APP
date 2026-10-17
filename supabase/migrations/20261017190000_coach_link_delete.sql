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
