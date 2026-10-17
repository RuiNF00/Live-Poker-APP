-- Creating a swap or a group swap is safe to repeat. The app retries a create by itself when the
-- signal comes back, and a create whose answer was lost on the way may already exist. So the app
-- now picks the creator's token (and the group's invite) itself: random, 64 hex characters, one
-- per draft. A second create with the same token returns the swap it already made instead of a
-- new one. Only hashes are stored, as before; a token nobody else knows is the only way in.

create unique index if not exists swaps_token_a_idx on public.swaps (token_a_hash);
create unique index if not exists swap_group_seats_owner_idx on public.swap_group_seats (token_hash) where seat = 0 and token_hash is not null;

drop function if exists public.create_swap(jsonb);

create or replace function public.create_swap(p_terms jsonb, p_token text default null) returns table (id text, token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_token text := coalesce(p_token, public.swap_new_token());
begin
  if p_token is not null and p_token !~ '^[a-f0-9]{64}$' then raise exception 'token'; end if;
  -- Same token again: the swap made the first time.
  select s.id into v_id from public.swaps s where s.token_a_hash = public.swap_hash(v_token);
  if v_id is not null then
    return query select v_id, v_token;
    return;
  end if;
  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.swaps s where s.id = v_id);
  end loop;
  begin
    insert into public.swaps (id, token_a_hash, terms) values (v_id, public.swap_hash(v_token), p_terms);
  exception when unique_violation then
    -- Two copies of the same create at once: the other one won.
    select s.id into v_id from public.swaps s where s.token_a_hash = public.swap_hash(v_token);
    if v_id is null then raise; end if;
  end;
  return query select v_id, v_token;
end $$;

drop function if exists public.create_swap_group(jsonb, text[]);

create or replace function public.create_swap_group(p_terms jsonb, p_names text[], p_token text default null, p_invite text default null)
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
  if n < 3 or n > 8 then raise exception 'group size'; end if;
  -- Same token again: the group made the first time (its invite has to match too).
  select g.id into v_id
    from public.swap_group_seats s join public.swap_groups g on g.id = s.group_id
   where s.seat = 0 and s.token_hash = public.swap_hash(v_token) and g.invite_hash = public.swap_hash(v_invite);
  if v_id is not null then
    return query select v_id, v_token, v_invite;
    return;
  end if;
  loop
    v_id := public.short_id();
    exit when not exists (select 1 from public.swap_groups g where g.id = v_id);
  end loop;
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
    if v_id is null then raise; end if;
  end;
  return query select v_id, v_token, v_invite;
end $$;

revoke execute on function public.create_swap(jsonb, text) from public, anon, authenticated;
revoke execute on function public.create_swap_group(jsonb, text[], text, text) from public, anon, authenticated;
grant execute on function public.create_swap(jsonb, text) to service_role;
grant execute on function public.create_swap_group(jsonb, text[], text, text) to service_role;
