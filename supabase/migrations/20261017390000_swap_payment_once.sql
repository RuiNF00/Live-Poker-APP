-- A transfer between the two players can be recorded by whoever paid ("payment") or by whoever got
-- it ("received"). When both mark the same money, the second one would count it twice. This adds
-- an entry like add_swap_entry, under a row lock, and refuses a payment larger than what the payer
-- still owes (a cent and a half of slack for rounding), answering with what was still owed.
-- Shares are rounded to the cent per prize, as the app and the web page do.
--
-- Returns {"ok": true} (added, or the same cid already there), {"ok": false} (not this swap's
-- player, not confirmed, or read-only) or {"left": n} (refused: n was still owed).

create or replace function public.add_swap_entry_checked(p_id text, p_token text, p_entry jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_side text := public.swap_side(p_id, p_token);
  v_swap public.swaps%rowtype;
  v_kind text;
  v_amount numeric;
  v_net numeric := 0;
  v_payer text;
  v_room numeric;
  e jsonb;
begin
  if v_side is null or jsonb_typeof(p_entry) <> 'object' then return jsonb_build_object('ok', false); end if;
  select * into v_swap from public.swaps s where s.id = p_id for update;
  if not found or v_swap.left_side is not null or v_swap.confirmed_at is null then return jsonb_build_object('ok', false); end if;
  if exists (select 1 from jsonb_array_elements(v_swap.entries) x where x->>'side' = v_side and x->>'cid' = p_entry->>'cid') then
    return jsonb_build_object('ok', true);
  end if;

  v_kind := p_entry->>'kind';
  if v_kind in ('payment', 'received') then
    -- Positive: b owes a.
    for e in select * from jsonb_array_elements(v_swap.entries) loop
      if e->>'kind' = 'result' then
        if e->>'side' = 'a' then v_net := v_net - round((v_swap.terms->'a'->>'pct')::numeric / 100 * (e->>'amount')::numeric, 2);
        else v_net := v_net + round((v_swap.terms->'b'->>'pct')::numeric / 100 * (e->>'amount')::numeric, 2);
        end if;
      elsif (e->>'side' = 'a') = (e->>'kind' = 'payment') then v_net := v_net + (e->>'amount')::numeric;
      else v_net := v_net - (e->>'amount')::numeric;
      end if;
    end loop;
    v_payer := case when v_kind = 'payment' then v_side when v_side = 'a' then 'b' else 'a' end;
    v_room := greatest(0, case when v_payer = 'b' then v_net else -v_net end);
    v_amount := (p_entry->>'amount')::numeric;
    if v_amount > v_room + 0.015 then return jsonb_build_object('left', round(v_room, 2)); end if;
  end if;

  update public.swaps s
     set entries = s.entries || jsonb_build_array(p_entry || jsonb_build_object(
           'id', substr(public.swap_new_token(), 1, 12),
           'side', v_side,
           'at', (extract(epoch from now()) * 1000)::bigint)),
         updated_at = now()
   where s.id = p_id;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.add_swap_entry_checked(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.add_swap_entry_checked(text, text, jsonb) to service_role;
