-- Security P2 (19 Oct): the backer's confirm carried no version, so a page opened before the
-- player changed the markup or the events stamped the new terms. The confirm now carries the
-- updated_at the page showed and only counts while it still matches.
drop function if exists public.confirm_action_offer(text);

-- Null when the link is gone; {"stale": true} when the terms changed since p_seen (nothing
-- stamped); else {"confirmed_at": …}, idempotent (a second call keeps the first time).
create or replace function public.confirm_action_offer(p_id text, p_seen timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cur timestamptz; done timestamptz;
begin
  select o.updated_at into cur from public.action_offers o where o.id = p_id for update;
  if not found then return null; end if;
  if p_seen is null or cur <> p_seen then return jsonb_build_object('stale', true); end if;
  update public.action_offers o set confirmed_at = coalesce(o.confirmed_at, now()) where o.id = p_id
  returning o.confirmed_at into done;
  return jsonb_build_object('confirmed_at', done);
end $$;

revoke execute on function public.confirm_action_offer(text, timestamptz) from public, anon, authenticated;
grant execute on function public.confirm_action_offer(text, timestamptz) to service_role;
