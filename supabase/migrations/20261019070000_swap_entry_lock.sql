-- The same entry sent twice at once (a retry on a weak signal while the first is still in flight)
-- was saved twice: both calls checked the cid before either had written, so the prize or payment
-- counted twice. Each call now locks the swap's row first, so the second waits, then finds the cid
-- and answers true without adding it. Same bodies otherwise.

create or replace function public.add_swap_entry(p_id text, p_token text, p_entry jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_side text := public.swap_side(p_id, p_token);
  v_entry jsonb;
begin
  if v_side is null or jsonb_typeof(p_entry) <> 'object' then return false; end if;
  perform 1 from public.swaps s where s.id = p_id for update;
  if exists (select 1 from public.swaps s where s.id = p_id and s.left_side is not null) then return false; end if;
  if exists (
    select 1 from public.swaps s, jsonb_array_elements(s.entries) e
     where s.id = p_id and e->>'side' = v_side and e->>'cid' = p_entry->>'cid'
  ) then return true; end if;
  v_entry := p_entry || jsonb_build_object(
    'id', substr(public.swap_new_token(), 1, 12),
    'side', v_side,
    'at', (extract(epoch from now()) * 1000)::bigint
  );
  update public.swaps s
     set entries = s.entries || jsonb_build_array(v_entry), updated_at = now()
   where s.id = p_id and s.confirmed_at is not null;
  return found;
end $$;

create or replace function public.add_swap_group_entry(p_id text, p_token text, p_entry jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_seat smallint := public.swap_group_seat(p_id, p_token);
  v_entry jsonb;
begin
  if v_seat is null or jsonb_typeof(p_entry) <> 'object' then return false; end if;
  perform 1 from public.swap_groups g where g.id = p_id for update;
  if exists (select 1 from public.swap_group_seats s where s.group_id = p_id and (s.confirmed_at is null or s.name = '-')) then return false; end if;
  if p_entry->>'kind' = 'payment' and not exists (
    select 1 from public.swap_group_seats s where s.group_id = p_id and s.seat::text = p_entry->>'to' and s.seat <> v_seat
  ) then return false; end if;
  if exists (
    select 1 from public.swap_groups g, jsonb_array_elements(g.entries) e
     where g.id = p_id and e->>'seat' = v_seat::text and e->>'cid' = p_entry->>'cid'
  ) then return true; end if;
  v_entry := p_entry || jsonb_build_object(
    'id', substr(public.swap_new_token(), 1, 12),
    'seat', v_seat,
    'at', (extract(epoch from now()) * 1000)::bigint
  );
  update public.swap_groups g
     set entries = g.entries || jsonb_build_array(v_entry), updated_at = now()
   where g.id = p_id;
  return found;
end $$;

revoke execute on function public.add_swap_entry(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.add_swap_group_entry(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.add_swap_entry(text, text, jsonb) to service_role;
grant execute on function public.add_swap_group_entry(text, text, jsonb) to service_role;
