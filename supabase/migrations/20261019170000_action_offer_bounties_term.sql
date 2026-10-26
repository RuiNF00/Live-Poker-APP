-- 1st update. PKO packages (Bankroll): "Bounties ficam comigo" is a term of the agreement, so a
-- change of it clears the backer's confirmation and moves the version, like markup or events.
-- An absent bountiesKept is the same as false (older apps never send it).
create or replace function public.update_action_offer(p_id text, p_edit_token text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare changed boolean;
begin
  select (o.payload->'markup') is distinct from (p_payload->'markup')
      or (o.payload->'events') is distinct from (p_payload->'events')
      or (o.payload->'cur') is distinct from (p_payload->'cur')
      or (o.payload->'backer') is distinct from (p_payload->'backer')
      or (coalesce(o.payload->'bountiesKept', 'false') = 'true') is distinct from (coalesce(p_payload->'bountiesKept', 'false') = 'true')
    into changed
    from public.action_offers o
   where o.id = p_id
     and o.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex')
     for update;
  if not found then return false; end if;
  update public.action_offers o
     set confirmed_at = case when changed then null else o.confirmed_at end,
         payload = p_payload,
         updated_at = case when changed then now() else o.updated_at end,
         last_event_at = public.action_offer_last_event(p_payload)
   where o.id = p_id;
  return true;
end $$;

-- The confirm without a version stayed after 20261019060000 only for the web from before it. Only the
-- web server calls it (service_role); apps, v1 included, confirm through the site, which since v1 calls the 2-argument one.
drop function if exists public.confirm_action_offer(text);
