-- Referral loop: a player's invite code travels on shared hands, Stories and invite links.
-- When a friend installs, claims the code and starts using the app (saves a first hand),
-- both get 7 days of Pro, granted as a RevenueCat promotional entitlement by the web server.
--
-- Store rules: the reward is for the friend *using* the app, never for installing, rating
-- or reviewing it; nothing is locked behind inviting; rewards are Pro time, not money.
--
-- Only the server (service_role) touches these tables and functions: rewards are granted
-- from the server, so clients must not be able to mark referrals themselves.

create table public.referral_codes (
  install_id uuid primary key,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6,10}$'),
  rc_user_id text check (char_length(rc_user_id) <= 100),
  created_at timestamptz not null default now()
);

create table public.referrals (
  friend_install_id uuid primary key,
  referrer_install_id uuid not null references public.referral_codes (install_id) on delete cascade,
  source text not null default 'link' check (source in ('share', 'story', 'link', 'manual', 'play_referrer')),
  share_id text check (char_length(share_id) <= 20),
  claimed_at timestamptz not null default now(),
  activated_at timestamptz,
  check (friend_install_id <> referrer_install_id)
);
create index referrals_referrer_idx on public.referrals (referrer_install_id, activated_at);

-- One row per reward. pro_until is the end of the promotional entitlement after this grant;
-- granted_at stays null until RevenueCat accepted it, so failed grants can be retried.
create table public.referral_rewards (
  id bigint generated always as identity primary key,
  install_id uuid not null,
  friend_install_id uuid not null references public.referrals (friend_install_id) on delete cascade,
  role text not null check (role in ('referrer', 'friend')),
  days integer not null check (days between 1 and 31),
  pro_until timestamptz not null,
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (friend_install_id, role)
);
create index referral_rewards_install_idx on public.referral_rewards (install_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;
revoke all on public.referral_codes, public.referrals, public.referral_rewards from anon, authenticated;
grant all on public.referral_codes, public.referrals, public.referral_rewards to service_role;

-- Existing code for this install, or a new one. Also remembers the RevenueCat app user id.
create or replace function public.referral_code_for(p_install_id uuid, p_code text, p_rc_user_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  insert into referral_codes (install_id, code, rc_user_id)
  values (p_install_id, p_code, nullif(p_rc_user_id, ''))
  on conflict (install_id) do update set rc_user_id = coalesce(excluded.rc_user_id, referral_codes.rc_user_id)
  returning code into c;
  return c;
end $$;

-- Friend claims a code. Returns 'ok', 'already', 'unknown_code', 'self' or 'too_late'.
-- A claim is only accepted within 7 days of the friend's first app_open.
create or replace function public.claim_referral(p_friend uuid, p_code text, p_source text, p_share_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare ref uuid; first_open timestamptz;
begin
  if exists (select 1 from referrals where friend_install_id = p_friend) then return 'already'; end if;
  select install_id into ref from referral_codes where code = upper(p_code);
  if ref is null then return 'unknown_code'; end if;
  if ref = p_friend then return 'self'; end if;
  select min(created_at) into first_open from app_events where install_id = p_friend and event = 'app_open';
  if first_open is not null and first_open < now() - interval '7 days' then return 'too_late'; end if;
  insert into referrals (friend_install_id, referrer_install_id, source, share_id)
  values (p_friend, ref, coalesce(p_source, 'link'), left(p_share_id, 20))
  on conflict do nothing;
  return 'ok';
end $$;

-- Friend started using the app: marks the referral active and books the rewards.
-- Referrers earn for at most 10 friends per 365 days. Returns what to grant to both installs.
create or replace function public.activate_referral(p_friend uuid, p_days integer default 7)
returns table (install_id uuid, rc_user_id text, pro_until timestamptz)
language plpgsql security definer set search_path = public as $$
declare r referrals%rowtype; earned integer;
begin
  select * into r from referrals where friend_install_id = p_friend for update;
  if not found or r.activated_at is not null then return; end if;
  update referrals set activated_at = now() where friend_install_id = p_friend;

  insert into referral_rewards (install_id, friend_install_id, role, days, pro_until)
  values (p_friend, p_friend, 'friend', p_days, now() + make_interval(days => p_days));

  select count(*) into earned from referral_rewards w
  where w.install_id = r.referrer_install_id and w.role = 'referrer' and w.created_at > now() - interval '365 days';
  if earned < 10 then
    insert into referral_rewards (install_id, friend_install_id, role, days, pro_until)
    values (
      r.referrer_install_id, p_friend, 'referrer', p_days,
      greatest(now(), coalesce((select max(w.pro_until) from referral_rewards w where w.install_id = r.referrer_install_id), now()))
        + make_interval(days => p_days)
    );
  end if;

  return query
    select * from pending_referral_grants(p_friend)
    union all
    select * from pending_referral_grants(r.referrer_install_id);
end $$;

-- Rewards not yet accepted by RevenueCat (all installs, or one), with the RevenueCat user to grant.
create or replace function public.pending_referral_grants(p_install_id uuid)
returns table (install_id uuid, rc_user_id text, pro_until timestamptz)
language sql security definer set search_path = public as $$
  select w.install_id, c.rc_user_id, max(w.pro_until)
  from referral_rewards w
  left join referral_codes c on c.install_id = w.install_id
  where w.granted_at is null and w.pro_until > now() and (p_install_id is null or w.install_id = p_install_id)
  group by w.install_id, c.rc_user_id;
$$;

create or replace function public.mark_referral_granted(p_install_id uuid, p_until timestamptz)
returns void language sql security definer set search_path = public as $$
  update referral_rewards set granted_at = now()
  where install_id = p_install_id and granted_at is null and pro_until <= p_until;
$$;

-- What the app shows on the invite screen.
create or replace function public.referral_status(p_install_id uuid)
returns table (code text, invited integer, activated integer, days_earned integer, pro_until timestamptz)
language sql security definer set search_path = public as $$
  select c.code,
         (select count(*)::int from referrals r where r.referrer_install_id = p_install_id),
         (select count(*)::int from referrals r where r.referrer_install_id = p_install_id and r.activated_at is not null),
         (select coalesce(sum(w.days), 0)::int from referral_rewards w where w.install_id = p_install_id),
         (select max(w.pro_until) from referral_rewards w where w.install_id = p_install_id)
  from referral_codes c where c.install_id = p_install_id;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'referral_code_for(uuid, text, text)', 'claim_referral(uuid, text, text, text)', 'activate_referral(uuid, integer)',
    'pending_referral_grants(uuid)', 'mark_referral_granted(uuid, timestamptz)', 'referral_status(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
