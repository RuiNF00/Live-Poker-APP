-- Invites: how long the server keeps them, and "Delete all my data".
-- Until now referral_codes, referrals and referral_rewards were kept forever. Now:
-- - a referral (with its rewards) goes 400 days after its last event: the claim, the
--   activation or the end of the Pro it gave. 400 days covers the 10-friends-per-365-days cap;
-- - a code with no referral goes 400 days after the app last used it;
-- - erase_referrals deletes everything of one install at once.

alter table public.referral_codes add column if not exists last_seen_at timestamptz not null default now();

-- referral_code_for runs on every invite call (an insert ... on conflict do update), so
-- this keeps last_seen_at current without touching that function.
create or replace function public.referral_code_seen() returns trigger language plpgsql as $$
begin
  new.last_seen_at := now();
  return new;
end $$;
drop trigger if exists referral_code_seen on public.referral_codes;
create trigger referral_code_seen before update on public.referral_codes
  for each row execute function public.referral_code_seen();

create or replace function public.purge_referrals() returns void
language sql security definer set search_path = public as $$
  delete from referrals r
  where greatest(
          r.claimed_at,
          coalesce(r.activated_at, r.claimed_at),
          coalesce((select max(w.pro_until) from referral_rewards w where w.friend_install_id = r.friend_install_id), r.claimed_at)
        ) < now() - interval '400 days';
  delete from referral_codes c
  where c.last_seen_at < now() - interval '400 days'
    and not exists (select 1 from referrals r where r.referrer_install_id = c.install_id or r.friend_install_id = c.install_id);
$$;

-- "Delete all my data": this install's code and RevenueCat id, the invite it accepted, and
-- the invites it sent (rewards go with them). The app keeps its own claim state, so it
-- doesn't claim again; using invites later registers the code anew.
create or replace function public.erase_referrals(p_install_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from referrals where friend_install_id = p_install_id;
  delete from referral_codes where install_id = p_install_id;
$$;

revoke execute on function public.referral_code_seen() from public, anon, authenticated;
revoke execute on function public.purge_referrals() from public, anon, authenticated;
revoke execute on function public.erase_referrals(uuid) from public, anon, authenticated;
grant execute on function public.purge_referrals() to service_role;
grant execute on function public.erase_referrals(uuid) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-referrals';
    perform cron.schedule('purge-referrals', '57 4 * * *', 'select public.purge_referrals()');
  end if;
end $$;
