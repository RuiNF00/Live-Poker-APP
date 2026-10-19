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
  -- Two installs on one RevenueCat user activating at once would both pass the checks below
  -- (the row lock is per install): one at a time per RevenueCat user, always in the same order.
  perform pg_advisory_xact_lock(hashtext('referral_rc:' || least(friend_rc, coalesce(ref_rc, friend_rc))));
  if ref_rc is not null and ref_rc <> friend_rc then
    perform pg_advisory_xact_lock(hashtext('referral_rc:' || greatest(friend_rc, ref_rc)));
  end if;
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

-- Security, 05:05: the RevenueCat id comes from the client and RevenueCat creates a customer on
-- first lookup, so the checks above can be met with made-up ids. The one brake that doesn't trust
-- the client: at most 40 App Store codes leave the pool in any 24 hours (well above real use).
-- Past that, the offer still shows its end date but no code; the server logs it as an alert.
create or replace function public.referral_offer(p_install_id uuid, p_platform text)
returns table (offer_until timestamptz, ios_code text)
language plpgsql security definer set search_path = public as $$
declare w referral_rewards%rowtype; c text;
begin
  select * into w from referral_rewards x
  where x.install_id = p_install_id and x.kind = 'discount' and x.offer_until > now()
  order by x.offer_until desc limit 1 for update;
  if not found then return; end if;
  if p_platform = 'ios' and w.ios_code is null then
    -- One taker at a time, so two requests can't both see room under the cap.
    perform pg_advisory_xact_lock(hashtext('invite_offer_codes'));
    if (select count(*) from invite_offer_codes o where o.taken_at > now() - interval '24 hours') < 40 then
      select o.code into c from invite_offer_codes o where o.reward_id is null order by o.created_at, o.code limit 1 for update skip locked;
      if c is not null then
        update invite_offer_codes set reward_id = w.id, taken_at = now() where code = c;
        update referral_rewards set ios_code = c where id = w.id;
        w.ios_code := c;
      end if;
    end if;
  end if;
  return query select w.offer_until, case when p_platform = 'ios' then w.ios_code end;
end $$;

revoke all on function public.referral_offer(uuid, text) from public, anon, authenticated;
grant execute on function public.referral_offer(uuid, text) to service_role;
