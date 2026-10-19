-- Swap settlement follows the creator's Pro: when whoever created a swap or a group has Pro,
-- everyone in it sees who pays whom (app and web page); otherwise only the results. The web
-- server checks Pro with RevenueCat, so it needs the creator's RevenueCat app user id.
--
-- Kept apart from the swap rows so no read of a swap can ever return it: only the web server
-- (service_role) sets or reads it, through the functions below. It goes with the swap (cascade)
-- and as soon as the creator leaves ("Delete all my data").

create table public.swap_owner_rc (
  swap_id text primary key references public.swaps (id) on delete cascade,
  rc_user_id text not null check (char_length(rc_user_id) between 1 and 100)
);

create table public.swap_group_owner_rc (
  group_id text primary key references public.swap_groups (id) on delete cascade,
  rc_user_id text not null check (char_length(rc_user_id) between 1 and 100)
);

alter table public.swap_owner_rc enable row level security;
alter table public.swap_group_owner_rc enable row level security;
revoke all on public.swap_owner_rc from anon, authenticated;
revoke all on public.swap_group_owner_rc from anon, authenticated;

-- Only the creator's token (side a, seat 0) sets it; a reinstall gets a new anonymous id, so
-- it can be replaced.
create or replace function public.set_swap_owner_rc(p_id text, p_token text, p_rc text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.swap_side(p_id, p_token) is distinct from 'a' or p_rc is null or char_length(p_rc) not between 1 and 100 then
    return false;
  end if;
  if exists (select 1 from public.swaps s where s.id = p_id and s.left_side = 'a') then return false; end if;
  insert into public.swap_owner_rc (swap_id, rc_user_id) values (p_id, p_rc)
  on conflict (swap_id) do update set rc_user_id = excluded.rc_user_id;
  return true;
end $$;

create or replace function public.set_swap_group_owner_rc(p_id text, p_token text, p_rc text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.swap_group_seat(p_id, p_token) is distinct from 0 or p_rc is null or char_length(p_rc) not between 1 and 100 then
    return false;
  end if;
  insert into public.swap_group_owner_rc (group_id, rc_user_id) values (p_id, p_rc)
  on conflict (group_id) do update set rc_user_id = excluded.rc_user_id;
  return true;
end $$;

create or replace function public.swap_owner_rc_of(p_id text) returns text
language sql stable security definer set search_path = public as $$
  select o.rc_user_id from swap_owner_rc o where o.swap_id = p_id;
$$;

create or replace function public.swap_group_owner_rc_of(p_id text) returns text
language sql stable security definer set search_path = public as $$
  select o.rc_user_id from swap_group_owner_rc o where o.group_id = p_id;
$$;

-- The creator leaving drops their id at once (a group is deleted then, so the cascade does it).
create or replace function public.leave_swap(p_id text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_side text := public.swap_side(p_id, p_token);
begin
  if v_side is null then return false; end if;
  if exists (select 1 from public.swaps s where s.id = p_id and (s.confirmed_at is null or s.left_side is not null)) then
    delete from public.swaps s where s.id = p_id;
    return true;
  end if;
  if v_side = 'a' then
    delete from public.swap_owner_rc o where o.swap_id = p_id;
  end if;
  update public.swaps s
     set left_side = v_side,
         left_at = now(),
         terms = case when v_side = 'a' then jsonb_set(s.terms, '{a,name}', '"-"') else jsonb_set(s.terms, '{b,name}', '"-"') end,
         confirmed_name = case when v_side = 'b' then '-' else s.confirmed_name end,
         token_a_hash = case when v_side = 'a' then public.swap_hash(public.swap_new_token()) else s.token_a_hash end,
         token_b_hash = case when v_side = 'b' then public.swap_hash(public.swap_new_token()) else s.token_b_hash end,
         updated_at = now()
   where s.id = p_id;
  return true;
end $$;

revoke execute on function public.set_swap_owner_rc(text, text, text) from public, anon, authenticated;
revoke execute on function public.set_swap_group_owner_rc(text, text, text) from public, anon, authenticated;
revoke execute on function public.swap_owner_rc_of(text) from public, anon, authenticated;
revoke execute on function public.swap_group_owner_rc_of(text) from public, anon, authenticated;
revoke execute on function public.leave_swap(text, text) from public, anon, authenticated;
grant execute on function public.set_swap_owner_rc(text, text, text) to service_role;
grant execute on function public.set_swap_group_owner_rc(text, text, text) to service_role;
grant execute on function public.swap_owner_rc_of(text) to service_role;
grant execute on function public.swap_group_owner_rc_of(text) to service_role;
grant execute on function public.leave_swap(text, text) to service_role;
grant select, insert, update, delete on public.swap_owner_rc to service_role;
grant select, insert, update, delete on public.swap_group_owner_rc to service_role;
