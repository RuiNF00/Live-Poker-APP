-- Referral loop, run as the server role.
\set ON_ERROR_STOP on
grant select on public.app_events to service_role;
set role service_role;
\set referrer '''11111111-1111-1111-1111-111111111111'''
\set friend '''22222222-2222-2222-2222-222222222222'''
select referral_code_for(:referrer, 'ABCD2345', 'rc_referrer') = 'ABCD2345' as code_created;
select referral_code_for(:referrer, 'ZZZZ9999') = 'ABCD2345' as code_is_stable;
select referral_code_for(:friend, 'FRND2345', '$RCAnonymousID:friend') as friend_code;
select claim_referral(:friend, 'nope99', 'link') = 'unknown_code' as unknown_rejected;
select claim_referral(:referrer, 'ABCD2345', 'link') = 'self' as self_rejected;
select claim_referral(:friend, 'abcd2345', 'share', 'demo') = 'ok' as claimed;
select claim_referral(:friend, 'ABCD2345', 'share') = 'already' as claim_once;
select count(*) = 2 as both_rewarded from activate_referral(:friend);
select count(*) = 0 as activate_once from activate_referral(:friend);
select string_agg(rc_user_id, ',' order by rc_user_id) as to_grant from pending_referral_grants(null);
select mark_referral_granted(:referrer, now() + interval '8 days');
select count(*) = 1 as one_left from pending_referral_grants(null);
select invited = 1 and activated = 1 and days_earned = 7 as status_ok from referral_status(:referrer);
-- Late claim: friend first opened the app 10 days ago
reset role;
insert into app_events (event, install_id, platform, created_at) values ('app_open', '33333333-3333-3333-3333-333333333333', 'ios', now() - interval '10 days');
set role service_role;
select claim_referral('33333333-3333-3333-3333-333333333333', 'ABCD2345', 'manual') = 'too_late' as late_claim_rejected;
-- Cap: the 11th activated friend in a year gives the referrer nothing
select count(*) from (
  select claim_referral(('44444444-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'ABCD2345', 'link'),
         activate_referral(('44444444-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid)
  from generate_series(1, 12) i) x;
reset role;
select count(*) = 10 as referrer_capped_at_10 from referral_rewards where install_id = :referrer and role = 'referrer';
select max(pro_until) > now() + interval '69 days' as referrer_days_stack from referral_rewards where install_id = :referrer;
-- Clients cannot touch any of it
\set ON_ERROR_STOP off
set role anon;
select * from referrals;
select claim_referral(gen_random_uuid(), 'ABCD2345', 'link');
select activate_referral(:friend);
reset role;

-- App-minted hex codes (migration 20261017060000)
set role service_role;
select referral_code_for('55555555-5555-5555-5555-555555555555', 'a1b2c3d4e5', 'rc5') = 'a1b2c3d4e5' as hex_code_kept;
select claim_referral('66666666-6666-6666-6666-666666666666', 'A1B2C3D4E5', 'share', 'demo') = 'ok' as hex_code_claimed;
reset role;
set role anon;
select log_app_event('link_opened', gen_random_uuid(), 'ios', '{"ref":"a1b2c3d4e5"}') is null as link_event_ok;
reset role;
set role anon;
select log_app_event('invite_claimed', gen_random_uuid(), 'android', '{"source":"play_referrer","result":"ok"}') is null as invite_claimed_event_ok;
reset role;
