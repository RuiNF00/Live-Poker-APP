-- Security P2 (19 Oct): the backer's confirm carried no version, so a page opened before the
-- player changed the markup or the events stamped the new terms. The confirm now carries the
-- updated_at the page showed and only counts while it still matches. updated_at now moves
-- only when the terms do (QA P2: sharing the link again with the same terms made the page stale).
drop function if exists public.confirm_action_offer(text);

-- Null when the link is gone; {"stale": true} when the terms changed since p_seen (nothing
-- stamped); else {"confirmed_at": …}, idempotent (a second call keeps the first time).
create or replace function public.confirm_action_offer(p_id text, p_seen timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cur timestamptz; done timestamptz;
begin
  select o.updated_at into cur from public.action_offers o where o.id = p_id for update;
  if not found then return null; end if;
  -- To the millisecond: a version that went through a JS Date (which drops the µs) still matches.
  if p_seen is null or date_trunc('milliseconds', cur) <> date_trunc('milliseconds', p_seen) then return jsonb_build_object('stale', true); end if;
  update public.action_offers o set confirmed_at = coalesce(o.confirmed_at, now()) where o.id = p_id
  returning o.confirmed_at into done;
  return jsonb_build_object('confirmed_at', done);
end $$;

revoke execute on function public.confirm_action_offer(text, timestamptz) from public, anon, authenticated;
grant execute on function public.confirm_action_offer(text, timestamptz) to service_role;

-- The player changes the record (20261017211000). New terms (markup, events, currency, or who
-- the backer is) clear the confirmation and move updated_at, the version the backer's page
-- confirms against; a new title or the same terms sent again keep both.
create or replace function public.update_action_offer(p_id text, p_edit_token text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare changed boolean;
begin
  select (o.payload->'markup') is distinct from (p_payload->'markup')
      or (o.payload->'events') is distinct from (p_payload->'events')
      or (o.payload->'cur') is distinct from (p_payload->'cur')
      or (o.payload->'backer') is distinct from (p_payload->'backer')
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
