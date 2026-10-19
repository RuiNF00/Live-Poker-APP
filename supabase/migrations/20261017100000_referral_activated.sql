-- Whether this install's referral is activated, so /api/referrals/activate can tell the app
-- to stop retrying (also after a lost response, when the referral is no longer awaiting).
create or replace function public.referral_activated(p_friend uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from referrals where friend_install_id = p_friend and activated_at is not null);
$$;
revoke execute on function public.referral_activated(uuid) from public, anon, authenticated;
grant execute on function public.referral_activated(uuid) to service_role;
