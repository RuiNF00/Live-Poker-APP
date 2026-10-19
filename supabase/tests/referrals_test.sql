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
set role service_role;
select referral_activated(:friend) and not referral_activated('dddddddd-0000-0000-0000-000000000001') as activated_flag;
reset role;

-- Retention (migration 20261017250000): old referrals and unused codes go, recent ones stay
reset role;
insert into referral_codes (install_id, code, rc_user_id, created_at) values
  ('f0000000-0000-0000-0000-000000000001', 'XLDR2345', 'rc_old_ref', now() - interval '900 days'),
  ('f0000000-0000-0000-0000-000000000002', 'XLDF2345', 'rc_old_friend', now() - interval '900 days'),
  ('f0000000-0000-0000-0000-000000000003', 'XDLE2345', null, now() - interval '900 days');
insert into referrals (friend_install_id, referrer_install_id, claimed_at, activated_at) values
  ('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', now() - interval '800 days', now() - interval '799 days');
insert into referral_rewards (install_id, friend_install_id, role, days, pro_until, created_at) values
  ('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'friend', 7, now() - interval '792 days', now() - interval '799 days');
update referral_codes set last_seen_at = now() - interval '500 days' where install_id::text like 'f0000000%';
select count(*) = 3 as trigger_marks_seen from referral_codes where install_id::text like 'f0000000%' and last_seen_at > now() - interval '1 minute';
alter table referral_codes disable trigger referral_code_seen;
update referral_codes set last_seen_at = now() - interval '500 days' where install_id::text like 'f0000000%';
alter table referral_codes enable trigger referral_code_seen;
set role service_role;
select referral_code_for(:referrer, 'ABCD2345') = 'ABCD2345' as seen_again;
select purge_referrals();
reset role;
select not exists (select 1 from referrals where friend_install_id = 'f0000000-0000-0000-0000-000000000002') as old_referral_purged;
select not exists (select 1 from referral_rewards where friend_install_id = 'f0000000-0000-0000-0000-000000000002') as old_rewards_purged;
select not exists (select 1 from referral_codes where install_id::text like 'f0000000%') as unused_old_codes_purged;
select exists (select 1 from referrals where friend_install_id = :friend) as recent_referral_kept;
select exists (select 1 from referral_codes where install_id = :referrer) as active_code_kept;

-- "Delete all my data": the friend's side, then the referrer's side
set role service_role;
select erase_referrals(:friend);
reset role;
select not exists (select 1 from referrals where friend_install_id = :friend)
   and not exists (select 1 from referral_codes where install_id = :friend)
   and not exists (select 1 from referral_rewards where friend_install_id = :friend) as friend_erased;
set role service_role;
select erase_referrals(:referrer);
reset role;
select not exists (select 1 from referral_codes where install_id = :referrer)
   and not exists (select 1 from referrals where referrer_install_id = :referrer)
   and not exists (select 1 from referral_rewards where install_id = :referrer) as referrer_erased;
\set ON_ERROR_STOP off
set role anon;
select erase_referrals('22222222-2222-2222-2222-222222222222');
select purge_referrals();
reset role;
\set ON_ERROR_STOP on

-- Discount reward (20261017370000): 50% off the first month for 72 h instead of Pro days
set role service_role;
\set dref '''a1111111-1111-1111-1111-111111111111'''
\set dfriend '''a2222222-2222-2222-2222-222222222222'''
select referral_code_for(:dref, 'DREF2345', 'rc_dref') = 'DREF2345' as discount_code_created;
select claim_referral(:dfriend, 'DREF2345', 'link') = 'ok' as discount_claimed;
-- Without the friend's RevenueCat user nothing is booked and the referral stays open (P1, 19 Oct).
select count(*) = 1 as discount_needs_friend_rc from (select activate_referral_discount(:dfriend)) x;
select activated_at is null as discount_waits_for_rc from referrals where friend_install_id = :dfriend;
select referral_code_for(:dfriend, 'DFRE2345', 'rc_dfriend') = 'DFRE2345' as discount_friend_rc_set;
reset role;
select count(*) = 0 as no_reward_without_rc from referral_rewards where friend_install_id = :dfriend;
insert into invite_offer_codes (code) values ('INVITEAAA111'), ('INVITEBBB222');
set role service_role;
select count(*) = 1 as discount_booked from (select activate_referral_discount(:dfriend)) x;
select count(*) = 1 as discount_once from (select activate_referral_discount(:dfriend)) x;
reset role;
select count(*) = 2 and bool_and(kind = 'discount' and offer_until > now() + interval '71 hours' and pro_until is null) as both_get_discount
  from referral_rewards where friend_install_id = :dfriend;
set role service_role;
select count(*) = 0 as discount_not_granted_on_rc from pending_referral_grants(:dref);
select (select ios_code from referral_offer(:dfriend, 'android')) is null as android_needs_no_code;
select (select ios_code from referral_offer(:dfriend, 'ios')) = 'INVITEAAA111' as ios_gets_a_code;
select (select ios_code from referral_offer(:dfriend, 'ios')) = 'INVITEAAA111' as ios_code_is_stable;
select (select ios_code from referral_offer(:dref, 'ios')) = 'INVITEBBB222' as each_reward_own_code;
select discounts = 1 and days_earned = 0 as discount_status_ok from referral_status(:dref);
reset role;
update referral_rewards set offer_until = now() - interval '1 minute' where friend_install_id = :dfriend;
set role service_role;
select count(*) = 0 as expired_offer_gone from referral_offer(:dfriend, 'ios');
reset role;

-- P1 (19 Oct): same RevenueCat user on both sides books nothing; a second install of the same
-- friend gets no second friend reward; the referrer's 10 a year count per RevenueCat user.
set role service_role;
\set dself '''a3333333-3333-3333-3333-333333333333'''
select referral_code_for(:dself, 'DSEL2345', 'rc_dref') = 'DSEL2345' as self_code;
select claim_referral(:dself, 'DREF2345', 'link') = 'ok' as self_claimed;
select count(*) = 1 from (select activate_referral_discount(:dself)) x;
reset role;
select count(*) = 0 as self_referral_books_nothing from referral_rewards where friend_install_id = :dself;
set role service_role;
\set dagain '''a4444444-4444-4444-4444-444444444444'''
select referral_code_for(:dagain, 'DAGA2345', 'rc_dfriend') = 'DAGA2345' as again_code;
select claim_referral(:dagain, 'DREF2345', 'link') = 'ok' as again_claimed;
select count(*) = 1 from (select activate_referral_discount(:dagain)) x;
reset role;
select count(*) filter (where role = 'friend') = 0 and count(*) filter (where role = 'referrer') = 1 as friend_reward_once_per_rc
  from referral_rewards where friend_install_id = :dagain;
-- Ten more friends (fresh RevenueCat users) for a second install of the same referrer: the cap is per RevenueCat user.
set role service_role;
\set dref2 '''a5555555-5555-5555-5555-555555555555'''
select referral_code_for(:dref2, 'DRFB2345', 'rc_dref') = 'DRFB2345' as referrer_second_install;
select count(*) = 10 from (
  select referral_code_for(('b0000000-0000-0000-0000-00000000000' || to_hex(i))::uuid, 'DCAP' || substr('ABCDEFGHJK', i, 1) || 'ZZ', 'rc_cap_' || i),
         claim_referral(('b0000000-0000-0000-0000-00000000000' || to_hex(i))::uuid, 'DRFB2345', 'link'),
         activate_referral_discount(('b0000000-0000-0000-0000-00000000000' || to_hex(i))::uuid)
  from generate_series(1, 10) i
) x;
reset role;
select count(*) = 10 as referrer_cap_per_rc
  from referral_rewards w join referral_codes c on c.install_id = w.install_id
  where w.role = 'referrer' and c.rc_user_id = 'rc_dref';
\set ON_ERROR_STOP off
set role anon;
select * from invite_offer_codes;
select referral_offer(:dfriend, 'ios');
reset role;
\set ON_ERROR_STOP on

-- Security 05:05: at most 40 App Store codes leave the pool in 24 hours, whoever asks.
insert into invite_offer_codes (code, taken_at) select 'CAPTAKEN' || lpad(i::text, 4, '0'), now() from generate_series(1, 40) i;
insert into invite_offer_codes (code) values ('INVITECCC333');
set role service_role;
select count(*) = 1 and bool_and(ios_code is null) as daily_cap_holds_codes
  from referral_offer(('b0000000-0000-0000-0000-000000000001')::uuid, 'ios');
reset role;
-- Older than a day: they no longer count (and leave the pool, as if handed out).
delete from invite_offer_codes where code like 'CAPTAKEN%';
insert into invite_offer_codes (code, taken_at) select 'CAPOLD' || lpad(i::text, 4, '0'), now() - interval '25 hours' from generate_series(1, 40) i;
update invite_offer_codes set created_at = now() + interval '1 hour' where code like 'CAPOLD%';
set role service_role;
select (select ios_code from referral_offer(('b0000000-0000-0000-0000-000000000001')::uuid, 'ios')) = 'INVITECCC333' as cap_frees_after_a_day;
reset role;
