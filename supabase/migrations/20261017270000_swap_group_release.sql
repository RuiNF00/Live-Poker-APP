-- The creator of a group swap can take a player out (a wrong person claimed the seat, or someone
-- who won't play): the seat goes back to "not joined yet", its token stops working and anyone
-- with the group link can take it. Only while that seat has nothing in the accounts (no prize or
-- payment of theirs, no payment to them), so nobody's numbers change.

create or replace function public.release_swap_group_seat(p_id text, p_token text, p_seat integer) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.swap_group_seat(p_id, p_token) is distinct from 0 or p_seat is null or p_seat < 1 then return false; end if;
  -- Lock the group first: a new entry from that seat waits for this, so the check below holds.
  perform 1 from public.swap_groups g where g.id = p_id for update;
  if exists (select 1 from public.swap_groups g where g.id = p_id and g.left_at is not null) then return false; end if;
  if exists (
    select 1 from public.swap_groups g, jsonb_array_elements(g.entries) e
     where g.id = p_id and (e->>'seat' = p_seat::text or e->>'to' = p_seat::text)
  ) then return false; end if;
  update public.swap_group_seats s
     set token_hash = null, confirmed_at = null
   where s.group_id = p_id and s.seat = p_seat and s.confirmed_at is not null;
  if not found then return false; end if;
  update public.swap_groups g set updated_at = now() where g.id = p_id;
  return true;
end $$;

revoke execute on function public.release_swap_group_seat(text, text, integer) from public, anon, authenticated;
grant execute on function public.release_swap_group_seat(text, text, integer) to service_role;
