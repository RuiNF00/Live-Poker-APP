-- A swap made without signal can be shared at once: the app picks the id too (10 letters and
-- digits, like short_id()), so the link exists on the phone before the create reaches us. The
-- same token again still returns the swap it made; an id another swap already has is refused
-- ('id_taken') and the app sends the create again with a new one. Ids stay random: the app
-- draws them from 62 characters, as short_id() does.

drop function if exists public.create_swap(jsonb, text);

create or replace function public.create_swap(p_terms jsonb, p_token text default null, p_id text default null) returns table (id text, token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token text := coalesce(p_token, public.swap_new_token());
begin
  if p_token is not null and p_token !~ '^[a-f0-9]{64}$' then raise exception 'token'; end if;
  if p_id is not null and (p_token is null or p_id !~ '^[A-Za-z0-9]{10}$') then raise exception 'id'; end if;
  -- Same token again: the swap made the first time.
  select s.id into v_id from public.swaps s where s.token_a_hash = public.swap_hash(v_token);
  if v_id is not null then
    return query select v_id, v_token;
    return;
  end if;
  if p_id is not null then
    if exists (select 1 from public.swaps s where s.id = p_id) then raise exception 'id_taken'; end if;
    v_id := p_id;
  else
    loop
      v_id := public.short_id();
      exit when not exists (select 1 from public.swaps s where s.id = v_id);
    end loop;
  end if;
  begin
    insert into public.swaps (id, token_a_hash, terms) values (v_id, public.swap_hash(v_token), p_terms);
  exception when unique_violation then
    -- Two copies of the same create at once: the other one won. Else the id went to another swap.
    select s.id into v_id from public.swaps s where s.token_a_hash = public.swap_hash(v_token);
    if v_id is null and p_id is not null then raise exception 'id_taken'; end if;
    if v_id is null then raise; end if;
  end;
  return query select v_id, v_token;
end $$;

revoke all on function public.create_swap(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.create_swap(jsonb, text, text) to service_role;

drop function if exists public.create_swap_group(jsonb, text[], text, text);

create or replace function public.create_swap_group(p_terms jsonb, p_names text[], p_token text default null, p_invite text default null, p_id text default null)
returns table (id text, token text, invite text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token text := coalesce(p_token, public.swap_new_token());
  v_invite text := coalesce(p_invite, public.swap_new_token());
  n integer := coalesce(array_length(p_names, 1), 0);
begin
  if (p_token is null) <> (p_invite is null) then raise exception 'token'; end if;
  if p_token is not null and (p_token !~ '^[a-f0-9]{64}$' or p_invite !~ '^[a-f0-9]{64}$') then raise exception 'token'; end if;
  if p_id is not null and (p_token is null or p_id !~ '^[A-Za-z0-9]{10}$') then raise exception 'id'; end if;
  if n < 3 or n > 8 then raise exception 'group size'; end if;
  -- Same token again: the group made the first time (its invite has to match too).
  select g.id into v_id
    from public.swap_group_seats s join public.swap_groups g on g.id = s.group_id
   where s.seat = 0 and s.token_hash = public.swap_hash(v_token) and g.invite_hash = public.swap_hash(v_invite);
  if v_id is not null then
    return query select v_id, v_token, v_invite;
    return;
  end if;
  if p_id is not null then
    if exists (select 1 from public.swap_groups g where g.id = p_id) then raise exception 'id_taken'; end if;
    v_id := p_id;
  else
    loop
      v_id := public.short_id();
      exit when not exists (select 1 from public.swap_groups g where g.id = v_id);
    end loop;
  end if;
  begin
    insert into public.swap_groups (id, invite_hash, terms) values (v_id, public.swap_hash(v_invite), p_terms);
    insert into public.swap_group_seats (group_id, seat, name, token_hash, confirmed_at)
      select v_id, (i - 1)::smallint, p_names[i],
             case when i = 1 then public.swap_hash(v_token) end,
             case when i = 1 then now() end
        from generate_series(1, n) i;
  exception when unique_violation then
    select g.id into v_id
      from public.swap_group_seats s join public.swap_groups g on g.id = s.group_id
     where s.seat = 0 and s.token_hash = public.swap_hash(v_token) and g.invite_hash = public.swap_hash(v_invite);
    if v_id is null and p_id is not null then raise exception 'id_taken'; end if;
    if v_id is null then raise; end if;
  end;
  return query select v_id, v_token, v_invite;
end $$;

revoke all on function public.create_swap_group(jsonb, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.create_swap_group(jsonb, text[], text, text, text) to service_role;
