-- The creator of a group swap can drop a player who never joined (someone who won't play after
-- all): the seat goes and the group carries on with the others, from 3 players up. Nothing counts
-- until every seat is taken, so no prize or payment can point at that seat; it is checked anyway.
-- Seat numbers are not renumbered: the players already in keep theirs.

create or replace function public.remove_swap_group_seat(p_id text, p_token text, p_seat integer) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.swap_group_seat(p_id, p_token) is distinct from 0 or p_seat is null or p_seat < 1 then return false; end if;
  perform 1 from public.swap_groups g where g.id = p_id for update;
  if exists (select 1 from public.swap_groups g where g.id = p_id and g.left_at is not null) then return false; end if;
  if (select count(*) from public.swap_group_seats s where s.group_id = p_id) <= 3 then return false; end if;
  if exists (
    select 1 from public.swap_groups g, jsonb_array_elements(g.entries) e
     where g.id = p_id and (e->>'seat' = p_seat::text or e->>'to' = p_seat::text)
  ) then return false; end if;
  delete from public.swap_group_seats s where s.group_id = p_id and s.seat = p_seat and s.confirmed_at is null;
  if not found then return false; end if;
  update public.swap_groups g set updated_at = now() where g.id = p_id;
  return true;
end $$;

revoke execute on function public.remove_swap_group_seat(text, text, integer) from public, anon, authenticated;
grant execute on function public.remove_swap_group_seat(text, text, integer) to service_role;
