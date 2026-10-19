-- The app mints its own referral code (10 hex chars, sent as ?r= on share links) so links
-- work offline; accept that format next to the server-minted one. Also the two new link events.

alter table public.referral_codes drop constraint if exists referral_codes_code_check;
alter table public.referral_codes add constraint referral_codes_code_check
  check (code ~ '^[A-HJ-NP-Z2-9]{6,10}$' or code ~ '^[0-9a-f]{10}$');

create or replace function public.claim_referral(p_friend uuid, p_code text, p_source text, p_share_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare ref uuid; first_open timestamptz;
begin
  if exists (select 1 from referrals where friend_install_id = p_friend) then return 'already'; end if;
  select install_id into ref from referral_codes where code in (upper(p_code), lower(p_code));
  if ref is null then return 'unknown_code'; end if;
  if ref = p_friend then return 'self'; end if;
  select min(created_at) into first_open from app_events where install_id = p_friend and event = 'app_open';
  if first_open is not null and first_open < now() - interval '7 days' then return 'too_late'; end if;
  insert into referrals (friend_install_id, referrer_install_id, source, share_id)
  values (p_friend, ref, coalesce(p_source, 'link'), left(p_share_id, 20))
  on conflict do nothing;
  return 'ok';
end $$;
revoke all on function public.claim_referral(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_referral(uuid, text, text, text) to service_role;

alter table public.app_events drop constraint if exists app_events_event_check;
alter table public.app_events add constraint app_events_event_check check (event in (
  'app_open', 'hand_saved', 'limit_hit', 'paywall_shown', 'purchase', 'share_created', 'story_shared',
  'share_viewed', 'store_click', 'landing_view', 'link_shared', 'link_opened'
));
