-- 1st update (Replayer QA P3, 19 Oct): an inviter with no RevenueCat user when the friend saved a first
-- hand (invited from the web, or RevenueCat not started yet) never got their part. The friend's
-- reward is booked as before; the inviter's now waits on the referral, as the hash of the friend's
-- RevenueCat id (to keep refusing a self-invite), and is booked the next time this inviter reports a
-- RevenueCat user, under the same rules: once per friend account, 10 a year per inviter account.
-- It waits 30 days; after that nothing is booked. Erasing either side deletes the referral, and the wait with it.
alter table public.referrals add column referrer_pending_hash text check (char_length(referrer_pending_hash) = 64);
create index referrals_pending_idx on public.referrals (referrer_install_id) where referrer_pending_hash is not null;

create or replace function public.activate_referral_discount(p_friend uuid, p_hours integer default 72)
returns void language plpgsql security definer set search_path = public as $$
declare r referrals%rowtype; friend_rc text; ref_rc text; earned integer;
begin
  select * into r from referrals where friend_install_id = p_friend for update;
  if not found or r.activated_at is not null then return; end if;
  select c.rc_user_id into friend_rc from referral_codes c where c.install_id = p_friend;
  if friend_rc is null then return; end if;
  select c.rc_user_id into ref_rc from referral_codes c where c.install_id = r.referrer_install_id;
  -- One at a time per RevenueCat user, always in the same order (see 20261019050000).
  perform pg_advisory_xact_lock(hashtext('referral_rc:' || least(friend_rc, coalesce(ref_rc, friend_rc))));
  if ref_rc is not null and ref_rc <> friend_rc then
    perform pg_advisory_xact_lock(hashtext('referral_rc:' || greatest(friend_rc, ref_rc)));
  end if;
  update referrals set activated_at = now() where friend_install_id = p_friend;
  if ref_rc is not null and ref_rc = friend_rc then return; end if;

  -- A friend's store account counts once, for both sides (Swaps QA P2-A).
  if exists (select 1 from referral_rc_tally t where t.rc_hash = referral_rc_hash(friend_rc) and t.role = 'friend') then return; end if;
  insert into referral_rewards (install_id, friend_install_id, role, kind, offer_until)
  values (p_friend, p_friend, 'friend', 'discount', now() + make_interval(hours => p_hours));
  insert into referral_rc_tally (rc_hash, role) values (referral_rc_hash(friend_rc), 'friend');

  if ref_rc is null then
    update referrals set referrer_pending_hash = referral_rc_hash(friend_rc) where friend_install_id = p_friend;
    return;
  end if;
  select count(*) into earned from referral_rc_tally t
  where t.rc_hash = referral_rc_hash(ref_rc) and t.role = 'referrer' and t.created_at > now() - interval '365 days';
  if earned < 10 then
    insert into referral_rewards (install_id, friend_install_id, role, kind, offer_until)
    values (r.referrer_install_id, p_friend, 'referrer', 'discount', now() + make_interval(hours => p_hours));
    insert into referral_rc_tally (rc_hash, role) values (referral_rc_hash(ref_rc), 'referrer');
  end if;
end $$;

-- Books the inviter's waiting parts once their RevenueCat user is known. Called from referral_code_for.
create or replace function public.settle_referrer_pending(p_referrer uuid, p_hours integer default 72)
returns void language plpgsql security definer set search_path = public as $$
declare ref_rc text; ref_hash text; r referrals%rowtype; earned integer;
begin
  select c.rc_user_id into ref_rc from referral_codes c where c.install_id = p_referrer;
  if ref_rc is null then return; end if;
  ref_hash := referral_rc_hash(ref_rc);
  -- Rows first, then the RevenueCat lock: the same order as activate_referral_discount.
  perform 1 from referrals where referrer_install_id = p_referrer and referrer_pending_hash is not null for update;
  perform pg_advisory_xact_lock(hashtext('referral_rc:' || ref_rc));
  for r in
    select * from referrals
    where referrer_install_id = p_referrer and referrer_pending_hash is not null
    order by activated_at
  loop
    update referrals set referrer_pending_hash = null where friend_install_id = r.friend_install_id;
    -- Too late, or the friend turns out to be the inviter's own store account: nothing.
    continue when r.activated_at < now() - interval '30 days' or r.referrer_pending_hash = ref_hash;
    select count(*) into earned from referral_rc_tally t
    where t.rc_hash = ref_hash and t.role = 'referrer' and t.created_at > now() - interval '365 days';
    exit when earned >= 10;
    insert into referral_rewards (install_id, friend_install_id, role, kind, offer_until)
    values (p_referrer, r.friend_install_id, 'referrer', 'discount', now() + make_interval(hours => p_hours))
    on conflict (friend_install_id, role) do nothing;
    if found then insert into referral_rc_tally (rc_hash, role) values (ref_hash, 'referrer'); end if;
  end loop;
  -- Past the cap the rest can never be booked this year: let them go.
  update referrals set referrer_pending_hash = null where referrer_install_id = p_referrer and referrer_pending_hash is not null;
end $$;
revoke all on function public.settle_referrer_pending(uuid, integer) from public, anon, authenticated;
grant execute on function public.settle_referrer_pending(uuid, integer) to service_role;

create or replace function public.referral_code_for(p_install_id uuid, p_code text, p_rc_user_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  insert into referral_codes (install_id, code, rc_user_id)
  values (p_install_id, p_code, nullif(p_rc_user_id, ''))
  on conflict (install_id) do update set rc_user_id = coalesce(referral_codes.rc_user_id, excluded.rc_user_id)
  returning coalesce(app_code, code) into c;
  if p_code ~ '^[0-9a-f]{10}$' and c <> p_code and c !~ '^[0-9a-f]{10}$'
     and not exists (select 1 from referral_codes where code = p_code or app_code = p_code) then
    update referral_codes set app_code = p_code where install_id = p_install_id;
    c := p_code;
  end if;
  if exists (select 1 from referrals where referrer_install_id = p_install_id and referrer_pending_hash is not null) then
    perform settle_referrer_pending(p_install_id);
  end if;
  return c;
end $$;
