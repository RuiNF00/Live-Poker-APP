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
  select referral_code_for(('44444444-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'CAP' || substr('ABCDEFGHJKLM', i, 1) || '2345', 'rc_cap_' || i),
         claim_referral(('44444444-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'ABCD2345', 'link'),
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
set role service_role;
select log_app_event('link_opened', gen_random_uuid(), 'ios', '{"ref":"a1b2c3d4e5"}') is null as link_event_ok;
reset role;
set role service_role;
select log_app_event('invite_claimed', gen_random_uuid(), 'android', '{"source":"play_referrer","result":"ok"}') is null as invite_claimed_event_ok;
reset role;

-- Server code minted first (status before code): the app's code becomes an alias (20261017080000)
set role service_role;
select referral_code_for('77777777-7777-7777-7777-777777777777', 'QRST2345', null) = 'QRST2345' as server_code_first;
select referral_code_for('77777777-7777-7777-7777-777777777777', 'b1b2c3d4e5', 'rc7') = 'b1b2c3d4e5' as app_code_wins;
select referral_code_for('77777777-7777-7777-7777-777777777777', 'ZZZZ2345', null) = 'b1b2c3d4e5' as app_code_sticks;
select (select code from referral_status('77777777-7777-7777-7777-777777777777')) = 'b1b2c3d4e5' as status_reports_app_code;
select claim_referral('88888888-8888-8888-8888-888888888888', 'b1b2c3d4e5', 'share') = 'ok' as alias_claimed;
select claim_referral('99999999-9999-9999-9999-999999999999', 'qrst2345', 'manual') = 'ok' as old_code_still_works;
-- Someone else's app code is never stolen as an alias
select referral_code_for('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'WXYZ2345', null) = 'WXYZ2345' as other_server_code;
select referral_code_for('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1b2c3d4e5', null) = 'WXYZ2345' as taken_alias_refused;
reset role;

-- Security review fixes (20261017090000)
set role service_role;
-- The RevenueCat user of an install is never replaced (no reward hijack)
select referral_code_for(:referrer, 'ZZZZ9999', 'rc_attacker') = 'ABCD2345' and
       (select rc_user_id from referral_codes where install_id = :referrer) = 'rc_referrer' as rc_not_overwritten;
-- Farming: many fresh installs with one RevenueCat user get the friend reward once
select referral_code_for('bbbbbbbb-0000-0000-0000-000000000000', 'FARM2345', 'rc_farm_ref') as farm_ref_code;
select count(*) from (
  select referral_code_for(('bbbbbbbb-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'FRM' || chr(64 + i) || '2345', '$RCAnonymousID:attacker'),
         claim_referral(('bbbbbbbb-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'FARM2345', 'link'),
         activate_referral(('bbbbbbbb-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid)
  from generate_series(1, 6) i) x;
select count(*) = 1 as one_friend_reward_per_rc_user from referral_rewards w join referral_codes c on c.install_id = w.install_id
  where w.role = 'friend' and c.rc_user_id = '$RCAnonymousID:attacker';
-- Referrer cap counts every install of the same RevenueCat user
select referral_code_for('cccccccc-0000-0000-0000-000000000000', 'SAME2345', 'rc_referrer') as second_install_of_referrer;
select referral_code_for('cccccccc-0000-0000-0000-000000000001', 'NEWF2345', 'rc_new_friend'),
       claim_referral('cccccccc-0000-0000-0000-000000000001', 'SAME2345', 'link');
select count(*) = 0 as referrer_cap_spans_installs from referral_rewards
  where install_id = 'cccccccc-0000-0000-0000-000000000000' and role = 'referrer'
  and exists (select activate_referral('cccccccc-0000-0000-0000-000000000001'));
select count(*) = 1 as but_friend_still_rewarded from referral_rewards
  where install_id = 'cccccccc-0000-0000-0000-000000000001' and role = 'friend';
-- No RevenueCat user: nothing booked, and the referral stays open for a retry
select referral_code_for('dddddddd-0000-0000-0000-000000000001', 'NRCC2345', null),
       claim_referral('dddddddd-0000-0000-0000-000000000001', 'FARM2345', 'link');
select count(*) = 0 as no_rc_no_reward from activate_referral('dddddddd-0000-0000-0000-000000000001');
select referral_awaiting_rc('dddddddd-0000-0000-0000-000000000001') is null and
       exists (select 1 from referrals where friend_install_id = 'dddddddd-0000-0000-0000-000000000001' and activated_at is null) as still_awaiting;
select referral_awaiting_rc('cccccccc-0000-0000-0000-000000000001') is null as activated_not_awaiting;
-- Same RevenueCat user on both sides earns nothing
select referral_code_for('eeeeeeee-0000-0000-0000-000000000001', 'SELF2345', 'rc_farm_ref'),
       claim_referral('eeeeeeee-0000-0000-0000-000000000001', 'FARM2345', 'link');
select count(*) = 0 as same_rc_user_earns_nothing from activate_referral('eeeeeeee-0000-0000-0000-000000000001');
reset role;
