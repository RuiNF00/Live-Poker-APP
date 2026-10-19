-- Invite reward changes from 7 days of Pro to 50% off the first month of Pro, for both
-- players, usable for 72 hours (Rui, 17 Oct: live festivals last 1-2 weeks, so 7 free days
-- covered the trip and nobody paid). Same rules otherwise: the friend's first saved hand
-- books it, the referrer earns for at most 10 friends a year, nothing is money.
--
-- Google Play: the app applies a developer-determined offer on the monthly base plan.
-- App Store: each reward hands out one one-time offer code from invite_offer_codes
-- (generated in App Store Connect and loaded by the server); the player redeems it in
-- the App Store. Rows booked before this migration keep their Pro days.

alter table public.referral_rewards
  add column if not exists kind text not null default 'pro_days' check (kind in ('pro_days', 'discount')),
  add column if not exists offer_until timestamptz,
  add column if not exists ios_code text;
alter table public.referral_rewards alter column days drop not null, alter column pro_until drop not null;
alter table public.referral_rewards add constraint referral_rewards_kind_shape check (
  (kind = 'pro_days' and days is not null and pro_until is not null) or (kind = 'discount' and offer_until is not null)
);

-- One-time App Store offer codes, each given to one reward at most.
create table public.invite_offer_codes (
  code text primary key check (code ~ '^[A-Z0-9]{6,20}$'),
  reward_id bigint unique references public.referral_rewards (id) on delete set null,
  taken_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.invite_offer_codes enable row level security;
revoke all on public.invite_offer_codes from anon, authenticated;
grant all on public.invite_offer_codes to service_role;

-- Friend's first saved hand: marks the referral active and books a discount for both.
create or replace function public.activate_referral_discount(p_friend uuid, p_hours integer default 72)
returns void language plpgsql security definer set search_path = public as $$
declare r referrals%rowtype; earned integer;
begin
  select * into r from referrals where friend_install_id = p_friend for update;
  if not found or r.activated_at is not null then return; end if;
  update referrals set activated_at = now() where friend_install_id = p_friend;

  insert into referral_rewards (install_id, friend_install_id, role, kind, offer_until)
  values (p_friend, p_friend, 'friend', 'discount', now() + make_interval(hours => p_hours));

  select count(*) into earned from referral_rewards w
  where w.install_id = r.referrer_install_id and w.role = 'referrer' and w.created_at > now() - interval '365 days';
  if earned < 10 then
    insert into referral_rewards (install_id, friend_install_id, role, kind, offer_until)
    values (r.referrer_install_id, p_friend, 'referrer', 'discount', now() + make_interval(hours => p_hours));
  end if;
end $$;

-- The discount this install can use now (the latest one still open), with its App Store
-- code when p_platform is 'ios' (taken from the pool the first time it is asked for).
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
    select o.code into c from invite_offer_codes o where o.reward_id is null order by o.created_at, o.code limit 1 for update skip locked;
    if c is not null then
      update invite_offer_codes set reward_id = w.id, taken_at = now() where code = c;
      update referral_rewards set ios_code = c where id = w.id;
      w.ios_code := c;
    end if;
  end if;
  return query select w.offer_until, case when p_platform = 'ios' then w.ios_code end;
end $$;

-- Offers count as one each on the invite screen; old Pro days stay in days_earned.
drop function if exists public.referral_status(uuid);
create function public.referral_status(p_install_id uuid)
returns table (code text, invited integer, activated integer, days_earned integer, pro_until timestamptz, discounts integer)
language sql security definer set search_path = public as $$
  select coalesce(c.app_code, c.code),
         (select count(*)::int from referrals r where r.referrer_install_id = p_install_id),
         (select count(*)::int from referrals r where r.referrer_install_id = p_install_id and r.activated_at is not null),
         (select coalesce(sum(w.days), 0)::int from referral_rewards w where w.install_id = p_install_id and w.kind = 'pro_days'),
         (select max(w.pro_until) from referral_rewards w where w.install_id = p_install_id and w.kind = 'pro_days'),
         (select count(*)::int from referral_rewards w where w.install_id = p_install_id and w.kind = 'discount')
  from referral_codes c where c.install_id = p_install_id;
$$;

-- A referral (with its rewards) still goes 400 days after its last event; a discount's last
-- event is its end.
create or replace function public.purge_referrals() returns void
language sql security definer set search_path = public as $$
  delete from referrals r
  where greatest(
          r.claimed_at,
          coalesce(r.activated_at, r.claimed_at),
          coalesce((select max(coalesce(w.pro_until, w.offer_until)) from referral_rewards w where w.friend_install_id = r.friend_install_id), r.claimed_at)
        ) < now() - interval '400 days';
  delete from referral_codes c
  where c.last_seen_at < now() - interval '400 days'
    and not exists (select 1 from referrals r where r.referrer_install_id = c.install_id or r.friend_install_id = c.install_id);
$$;

do $$
declare f text;
begin
  foreach f in array array['activate_referral_discount(uuid, integer)', 'referral_offer(uuid, text)', 'referral_status(uuid)', 'purge_referrals()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
