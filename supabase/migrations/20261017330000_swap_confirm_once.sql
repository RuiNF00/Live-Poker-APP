-- Confirming a swap or taking a seat in a group is safe to repeat. At a card room the answer
-- often gets lost: the confirm reached the server, the phone never heard back, and the retry
-- got "already confirmed", leaving the player locked out of their own swap. Now the app picks
-- the player's token itself (random, 64 hex characters, one per screen), the same way a
-- create does (20261017300000). The same token sent again gets the same answer back instead
-- of a 409. Only its hash is stored, as before; nobody else knows it.

drop function if exists public.confirm_swap(text, text);

create or replace function public.confirm_swap(p_id text, p_name text, p_token text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text := coalesce(p_token, public.swap_new_token());
begin
  if p_token is not null and p_token !~ '^[a-f0-9]{64}$' then raise exception 'token'; end if;
  -- One token per side: never the creator's.
  if exists (select 1 from public.swaps s where s.id = p_id and s.token_a_hash = public.swap_hash(v_token)) then return null; end if;
  update public.swaps s
     set token_b_hash = public.swap_hash(v_token), confirmed_at = now(), confirmed_name = p_name, updated_at = now()
   where s.id = p_id and s.confirmed_at is null;
  if found then return v_token; end if;
  -- Already confirmed with this same token: the answer of the first time was lost.
  if p_token is not null and exists (
    select 1 from public.swaps s where s.id = p_id and s.confirmed_at is not null and s.left_side is null and s.token_b_hash = public.swap_hash(p_token)
  ) then
    return p_token;
  end if;
  return null;
end $$;

drop function if exists public.claim_swap_group_seat(text, text, integer);

create or replace function public.claim_swap_group_seat(p_id text, p_invite text, p_seat integer, p_token text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text := coalesce(p_token, public.swap_new_token());
begin
  if p_token is not null and p_token !~ '^[a-f0-9]{64}$' then raise exception 'token'; end if;
  if not exists (select 1 from public.swap_groups g where g.id = p_id and g.invite_hash = public.swap_hash(p_invite) and coalesce(p_invite, '') <> '') then
    return null;
  end if;
  -- One token per seat: never one another seat already holds.
  if exists (select 1 from public.swap_group_seats s where s.group_id = p_id and s.seat <> p_seat and s.token_hash = public.swap_hash(v_token)) then
    return null;
  end if;
  update public.swap_group_seats s
     set token_hash = public.swap_hash(v_token), confirmed_at = now()
   where s.group_id = p_id and s.seat = p_seat and s.confirmed_at is null;
  if found then
    update public.swap_groups g set updated_at = now() where g.id = p_id;
    return v_token;
  end if;
  -- This seat was already taken with this same token: the answer of the first time was lost.
  if p_token is not null and exists (
    select 1 from public.swap_group_seats s
     where s.group_id = p_id and s.seat = p_seat and s.confirmed_at is not null and s.token_hash = public.swap_hash(p_token)
  ) then
    return p_token;
  end if;
  return null;
end $$;

revoke execute on function public.confirm_swap(text, text, text) from public, anon, authenticated;
revoke execute on function public.claim_swap_group_seat(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.confirm_swap(text, text, text) to service_role;
grant execute on function public.claim_swap_group_seat(text, text, integer, text) to service_role;
