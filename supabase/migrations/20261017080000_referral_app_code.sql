-- If /status (or /claim, /activate) ran before /code, the install got a server-minted code and
-- the app's own hex code (the ?r= on its links) was never registered, so friends got
-- unknown_code. Keep the old code working and attach the app's code as an alias: claims match
-- either, and the install reports the app's code from now on.

alter table public.referral_codes add column if not exists app_code text unique
  check (app_code ~ '^[0-9a-f]{10}$');

create or replace function public.referral_code_for(p_install_id uuid, p_code text, p_rc_user_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  insert into referral_codes (install_id, code, rc_user_id)
  values (p_install_id, p_code, nullif(p_rc_user_id, ''))
  on conflict (install_id) do update set rc_user_id = coalesce(excluded.rc_user_id, referral_codes.rc_user_id)
  returning coalesce(app_code, code) into c;
  -- An app code that lost the race to a server-minted one: attach it, unless another install has it.
  if p_code ~ '^[0-9a-f]{10}$' and c <> p_code and c !~ '^[0-9a-f]{10}$'
     and not exists (select 1 from referral_codes where code = p_code or app_code = p_code) then
    update referral_codes set app_code = p_code where install_id = p_install_id;
    c := p_code;
  end if;
  return c;
end $$;

create or replace function public.claim_referral(p_friend uuid, p_code text, p_source text, p_share_id text default null)
returns text language plpgsql security definer set search_path = public as $$
declare ref uuid; first_open timestamptz;
begin
  if exists (select 1 from referrals where friend_install_id = p_friend) then return 'already'; end if;
  select install_id into ref from referral_codes
  where code in (upper(p_code), lower(p_code)) or app_code = lower(p_code) limit 1;
  if ref is null then return 'unknown_code'; end if;
  if ref = p_friend then return 'self'; end if;
  select min(created_at) into first_open from app_events where install_id = p_friend and event = 'app_open';
  if first_open is not null and first_open < now() - interval '7 days' then return 'too_late'; end if;
  insert into referrals (friend_install_id, referrer_install_id, source, share_id)
  values (p_friend, ref, coalesce(p_source, 'link'), left(p_share_id, 20))
  on conflict do nothing;
  return 'ok';
end $$;

create or replace function public.referral_status(p_install_id uuid)
returns table (code text, invited integer, activated integer, days_earned integer, pro_until timestamptz)
language sql security definer set search_path = public as $$
  select coalesce(c.app_code, c.code),
         (select count(*)::int from referrals r where r.referrer_install_id = p_install_id),
         (select count(*)::int from referrals r where r.referrer_install_id = p_install_id and r.activated_at is not null),
         (select coalesce(sum(w.days), 0)::int from referral_rewards w where w.install_id = p_install_id),
         (select max(w.pro_until) from referral_rewards w where w.install_id = p_install_id)
  from referral_codes c where c.install_id = p_install_id;
$$;

do $$
declare f text;
begin
  foreach f in array array['referral_code_for(uuid, text, text)', 'claim_referral(uuid, text, text, text)', 'referral_status(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
