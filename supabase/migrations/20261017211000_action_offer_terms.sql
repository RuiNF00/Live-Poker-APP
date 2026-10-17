-- Festival action agreements (20261017180000), after the security review:
-- - a new currency or backer name also clears the backer's confirmation, like markup and events;
-- - an event dated far ahead can't keep a link from the purge: last_event_at is capped at two years out.

create or replace function public.action_offer_last_event(p_payload jsonb) returns timestamptz
language sql stable set search_path = public as $$
  select least(
    coalesce(
      (select to_timestamp(max((e->>'d')::double precision) / 1000)
         from jsonb_array_elements(case when jsonb_typeof(p_payload->'events') = 'array' then p_payload->'events' else '[]'::jsonb end) e
        where jsonb_typeof(e->'d') = 'number'),
      now()),
    now() + interval '2 years');
$$;

-- The player changes the record. New terms (markup, events, currency, or who the
-- backer is) clear the backer's confirmation: they have to confirm what they now agree to.
create or replace function public.update_action_offer(p_id text, p_edit_token text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.action_offers o
     set confirmed_at = case
           when (o.payload->'markup') is distinct from (p_payload->'markup')
             or (o.payload->'events') is distinct from (p_payload->'events')
             or (o.payload->'cur') is distinct from (p_payload->'cur')
             or (o.payload->'backer') is distinct from (p_payload->'backer') then null
           else o.confirmed_at end,
         payload = p_payload,
         updated_at = now(),
         last_event_at = public.action_offer_last_event(p_payload)
   where o.id = p_id
     and o.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex');
  return found;
end $$;
