-- Ecrã QA P3 (19 Oct): the once-per-RevenueCat-user checks in 20261019050000 count rewards joined
-- through referral_codes, and «Apagar todos os dados» (erase_referrals) deletes those rows, so an
-- erase reset the friend's once and the referrer's 10 a year. The count now lives in its own table,
-- which erase leaves alone: only a hash of the RevenueCat id, the role and the time, nothing that
-- leads back to an install. Purged after 400 days, like the rest of the referral data.
create table public.referral_rc_tally (
  id bigint generated always as identity primary key,
  rc_hash text not null,
  role text not null check (role in ('referrer', 'friend')),
  created_at timestamptz not null default now()
);
create index referral_rc_tally_idx on public.referral_rc_tally (rc_hash, role, created_at);
alter table public.referral_rc_tally enable row level security;
revoke all on public.referral_rc_tally from public, anon, authenticated;

create or replace function public.referral_rc_hash(p_rc text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to('sweatbook-referral:' || p_rc, 'UTF8')), 'hex');
$$;
revoke all on function public.referral_rc_hash(text) from public, anon, authenticated;

-- What has already been booked counts from day one.
insert into public.referral_rc_tally (rc_hash, role, created_at)
select public.referral_rc_hash(c.rc_user_id), w.role, w.created_at
from public.referral_rewards w join public.referral_codes c on c.install_id = w.install_id
where w.kind = 'discount' and c.rc_user_id is not null;

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

  -- A friend's store account counts once, for both sides: a second install of the same friend
  -- (or the same one after «Apagar todos os dados») books nothing, for the referrer either (Swaps QA P2-A).
  if exists (select 1 from referral_rc_tally t where t.rc_hash = referral_rc_hash(friend_rc) and t.role = 'friend') then return; end if;
  insert into referral_rewards (install_id, friend_install_id, role, kind, offer_until)
  values (p_friend, p_friend, 'friend', 'discount', now() + make_interval(hours => p_hours));
  insert into referral_rc_tally (rc_hash, role) values (referral_rc_hash(friend_rc), 'friend');

  if ref_rc is not null then
    select count(*) into earned from referral_rc_tally t
    where t.rc_hash = referral_rc_hash(ref_rc) and t.role = 'referrer' and t.created_at > now() - interval '365 days';
    if earned < 10 then
      insert into referral_rewards (install_id, friend_install_id, role, kind, offer_until)
      values (r.referrer_install_id, p_friend, 'referrer', 'discount', now() + make_interval(hours => p_hours));
      insert into referral_rc_tally (rc_hash, role) values (referral_rc_hash(ref_rc), 'referrer');
    end if;
  end if;
end $$;

revoke all on function public.activate_referral_discount(uuid, integer) from public, anon, authenticated;
grant execute on function public.activate_referral_discount(uuid, integer) to service_role;

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
  delete from referral_rc_tally where created_at < now() - interval '400 days';
$$;
