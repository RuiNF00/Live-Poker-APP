-- Public player profiles. Run as service_role, like the web server.
\set ON_ERROR_STOP on
set role service_role;

select create_profile('rui.poker', '{"v":1,"name":"Rui","hands":[],"sessions":[]}'::jsonb) as prof_token \gset
select :'prof_token' <> '' as profile_created;
select create_profile('rui.poker', '{"v":1}'::jsonb) is null as handle_taken_refused;
select profile_handle_free('rui.poker') = false as handle_not_free;
select profile_handle_free('ana') as other_handle_free;
select payload->>'name' = 'Rui' as profile_readable from get_profile('rui.poker');

select update_profile('rui.poker', 'wrong', '{"v":1,"name":"X"}'::jsonb) = false as profile_wrong_token_rejected;
select payload->>'name' = 'Rui' as profile_unchanged from get_profile('rui.poker');
select update_profile('rui.poker', :'prof_token', '{"v":1,"name":"Rui F."}'::jsonb) as profile_updated;
select payload->>'name' = 'Rui F.' as profile_update_visible from get_profile('rui.poker');

-- Rename: the old handle stops working; a taken handle is refused.
select create_profile('ana', '{"v":1}'::jsonb) as ana_token \gset
select update_profile('rui.poker', :'prof_token', '{"v":1,"name":"Rui F."}'::jsonb, 'ana') = false as rename_to_taken_refused;
select update_profile('rui.poker', :'prof_token', '{"v":1,"name":"Rui F."}'::jsonb, 'rui') as renamed;
select count(*) = 0 as old_handle_gone from get_profile('rui.poker');
select count(*) = 1 as new_handle_live from get_profile('rui');

select record_profile_view('rui');
select view_count = 1 as profile_view_counted from get_profile('rui');

-- Three different reporters hide it for review (the same one twice counts once).
select report_profile('rui', '00000000-0000-4000-8000-000000000001') = 'ok' as report_1;
select report_profile('rui', '00000000-0000-4000-8000-000000000001') = 'ok' as report_1_again;
select report_profile('rui', '00000000-0000-4000-8000-000000000002') = 'ok' as report_2;
select report_profile('rui', '00000000-0000-4000-8000-000000000003') = 'hidden' as report_3_hides;
select count(*) = 0 as hidden_profile_not_served from get_profile('rui');
select report_profile('rui', '00000000-0000-4000-8000-000000000004') = 'missing' as hidden_not_reportable;
select restore_profile('rui') as profile_restored;
select count(*) = 1 as restored_profile_served from get_profile('rui');

-- Hidden for 31 days: purged; others kept.
update player_profiles set hidden_at = now() - interval '31 days' where handle = 'ana';
select purge_hidden_profiles() = 1 as hidden_profile_purged;
select count(*) = 1 as live_profile_kept from player_profiles where handle = 'rui';

-- Hand ownership: only the edit token of a live share passes.
select id as h_id, edit_token as h_token from create_shared_hand('{"v":1}'::jsonb, null, false, null, true) \gset
select shared_hand_token_ok(:'h_id', :'h_token') as own_hand_ok;
select shared_hand_token_ok(:'h_id', 'wrong') = false as other_hand_refused;

\set ON_ERROR_STOP off
-- Bad handles, wrong version, and the token hash are all refused.
select create_profile('Rui Ferreira', '{"v":1}'::jsonb);
select create_profile('ab', '{"v":1}'::jsonb);
select create_profile('zed', '{"v":2}'::jsonb);
select edit_token_hash from get_profile('rui');
\set ON_ERROR_STOP on

select delete_profile('rui', 'wrong') = false as profile_delete_wrong_token;
select delete_profile('rui', :'prof_token') as profile_deleted;
select count(*) = 0 as profile_gone from player_profiles where handle = 'rui';
select count(*) = 0 as reports_gone_with_it from profile_reports where handle = 'rui';

reset role;
-- Nothing for the public keys.
set role anon;
\set ON_ERROR_STOP off
select * from player_profiles;
select * from get_profile('x');
select create_profile('anon1', '{"v":1}'::jsonb);
select shared_hand_token_ok('x', 'y');
\set ON_ERROR_STOP on
reset role;
