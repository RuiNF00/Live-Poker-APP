-- Security P1 (19 Oct): activate_referral_discount (20261017370000) dropped the checks the Pro-days
-- version had (20261017090000), so a script with made-up installIds booked a 50% App Store code for
-- each one. Back, per RevenueCat user, exactly as before:
--   * the friend must have a RevenueCat user (the app retries until it has one);
--   * friend and referrer on the same RevenueCat user book nothing;
--   * the friend's reward once per RevenueCat user, however many installs claim;
--   * the referrer's 10 a year counted per RevenueCat user, and nothing without one.
create or replace function public.activate_referral_discount(p_friend uuid, p_hours integer default 72)
returns void language plpgsql security definer set search_path = public as $$
declare r referrals%rowtype; friend_rc text; ref_rc text; earned integer;
begin
  select * into r from referrals where friend_install_id = p_friend for update;
  if not found or r.activated_at is not null then return; end if;
  select c.rc_user_id into friend_rc from referral_codes c where c.install_id = p_friend;
  if friend_rc is null then return; end if;
  select c.rc_user_id into ref_rc from referral_codes c where c.install_id = r.referrer_install_id;
  update referrals set activated_at = now() where friend_install_id = p_friend;
  if ref_rc is not null and ref_rc = friend_rc then return; end if;

  if not exists (
    select 1 from referral_rewards w join referral_codes c on c.install_id = w.install_id
    where w.role = 'friend' and c.rc_user_id = friend_rc
  ) then
    insert into referral_rewards (install_id, friend_install_id, role, kind, offer_until)
    values (p_friend, p_friend, 'friend', 'discount', now() + make_interval(hours => p_hours));
  end if;

  if ref_rc is not null then
    select count(*) into earned from referral_rewards w join referral_codes c on c.install_id = w.install_id
    where w.role = 'referrer' and c.rc_user_id = ref_rc and w.created_at > now() - interval '365 days';
    if earned < 10 then
      insert into referral_rewards (install_id, friend_install_id, role, kind, offer_until)
      values (r.referrer_install_id, p_friend, 'referrer', 'discount', now() + make_interval(hours => p_hours));
    end if;
  end if;
end $$;

revoke all on function public.activate_referral_discount(uuid, integer) from public, anon, authenticated;
grant execute on function public.activate_referral_discount(uuid, integer) to service_role;
