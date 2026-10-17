-- Run as service_role: since 20261017090000 the web server is the only client.
\set ON_ERROR_STOP on
set role service_role;

select id as share_id, edit_token as share_token
  from create_shared_hand('{"version":1,"game":"NLHE"}'::jsonb, 'AQ vs KK', false, '{"street":"turn","actionIndex":1}'::jsonb) \gset

select count(*) = 1 as can_read_share from get_shared_hand(:'share_id');

select count(*) = 1 as comment_added from add_hand_comment(:'share_id', ' Tiago ', 'Fold no turn', 17);
select author_name = 'Tiago' as name_trimmed from list_hand_comments(:'share_id');

\set ON_ERROR_STOP off
select add_hand_comment(:'share_id', '', 'sem nome');
\set ON_ERROR_STOP on

select cast_hand_vote(:'share_id', gen_random_uuid(), 'fold', 'ipA');
select cast_hand_vote(:'share_id', '00000000-0000-0000-0000-000000000001', 'call', 'ipA');
select cast_hand_vote(:'share_id', '00000000-0000-0000-0000-000000000001', 'raise', 'ipA');
select string_agg(choice || '=' || votes, ',' order by choice) = 'fold=1,raise=1' as votes_counted from hand_vote_counts(:'share_id');
-- One IP counts as at most 5 voters per hand
select count(*) from (select cast_hand_vote(:'share_id', gen_random_uuid(), 'call', 'ipB') from generate_series(1, 8)) x;
select votes = 5 as ip_capped_at_5 from hand_vote_counts(:'share_id') where choice = 'call';

select id as comment_id from add_hand_comment(:'share_id', 'Troll', 'spam', null) \gset
select report_hand_comment(:'comment_id', gen_random_uuid()) = 'ok' as first_report;
select report_hand_comment(:'comment_id', '00000000-0000-0000-0000-000000000009');
select report_hand_comment(:'comment_id', '00000000-0000-0000-0000-000000000009');
select count(*) = 1 as visible_after_two_reporters from list_hand_comments(:'share_id') where id = :'comment_id';
select report_hand_comment(:'comment_id', gen_random_uuid()) = 'hidden' as third_reporter_hides;
select count(*) = 0 as hidden_after_three_reports from list_hand_comments(:'share_id') where id = :'comment_id';
select report_hand_comment(gen_random_uuid(), gen_random_uuid()) = 'missing' as missing_comment;

select report_shared_hand(:'share_id', gen_random_uuid(), 'spam') = 'ok' as hand_reported;
select count(*) = 1 as hand_live_after_one_report from get_shared_hand(:'share_id');

select record_hand_view(:'share_id');
select view_count = 1 as view_counted from get_shared_hand(:'share_id');

-- Five reporters hide the hand for review; it can be restored
select id as hand2 from create_shared_hand('{"version":1}'::jsonb) \gset
select string_agg(report_shared_hand(:'hand2', gen_random_uuid()), ',') = 'ok,ok,ok,ok,hidden' as fifth_reporter_hides from generate_series(1, 5);
select count(*) = 0 as hidden_hand_unreadable from get_shared_hand(:'hand2');
select count(*) = 1 as hidden_hand_kept_for_review from shared_hands where id = :'hand2';
select restore_shared_hand(:'hand2') as restored;
select count(*) = 1 as restored_hand_readable from get_shared_hand(:'hand2');
-- Taken down 31 days ago: purged
update shared_hands set deleted_at = now() - interval '31 days' where id = :'hand2';
select purge_moderation() = 1 as old_takedown_purged;

select delete_shared_hand(:'share_id', 'wrong') = false as wrong_token_rejected;
select delete_shared_hand(:'share_id', :'share_token') as deleted;
select count(*) = 0 as row_gone_after_delete from shared_hands where id = :'share_id';
select count(*) = 0 as comments_gone_after_delete from hand_comments where hand_id = :'share_id';
select count(*) = 0 as votes_gone_after_delete from hand_votes where hand_id = :'share_id';

\set ON_ERROR_STOP off
select create_shared_hand('{"version":2}'::jsonb);

-- Database rate limit: 3 per window, the 4th is over
\set ON_ERROR_STOP on
select string_agg(hit_rate_limit('t', 'ipC', 3, 3600)::text, ',') = 'false,false,false,true' as rate_limit_holds from generate_series(1, 4);
reset role;

-- anon / authenticated can do nothing at all
\set ON_ERROR_STOP off
set role anon;
select * from shared_hands;
select * from hand_comments;
select create_shared_hand('{"version":1}'::jsonb);
select get_shared_hand('x');
select cast_hand_vote('x', gen_random_uuid(), 'fold', 'x');
select report_shared_hand('x', gen_random_uuid());
select log_app_event('app_open', gen_random_uuid(), 'ios', '{}');
select purge_old_app_events();
reset role;
set role authenticated;
select * from shared_hands;
select delete_shared_hand('x', 'y');
reset role;
\set ON_ERROR_STOP on
select count(*) = 0 as anon_has_no_grants from information_schema.role_table_grants where grantee in ('anon', 'authenticated') and table_schema = 'public';
select count(*) = 0 as anon_executes_nothing from information_schema.role_routine_grants where grantee in ('anon', 'authenticated', 'PUBLIC') and routine_schema = 'public';

-- Funnel events (server role)
set role service_role;
select log_app_event('app_open', gen_random_uuid(), 'ios', '{"v":"1.0.0"}');
select log_app_event('store_click', '00000000-0000-0000-0000-000000000001', 'web', '{"store":"ios","utm_source":"share"}');
\set ON_ERROR_STOP off
select log_app_event('drop_table', gen_random_uuid(), 'ios', '{}');
select log_app_event('app_open', gen_random_uuid(), 'windows', '{}');
\set ON_ERROR_STOP on
reset role;
select count(*) = 2 as only_valid_events_stored from app_events;
select sum(events) = 2 and sum(installs) = 2 as daily_view_counts from app_event_daily;

-- Retention: events older than 12 months are purged
insert into app_events (event, install_id, platform, created_at) values ('app_open', gen_random_uuid(), 'ios', now() - interval '13 months');
set role service_role;
select purge_old_app_events() = 1 as purged_old_event;
reset role;
select count(*) = 2 as recent_events_kept from app_events;

-- The owner removes a comment and blocks its author on that hand; counts for the app's list.
set role service_role;
select id as bshare, edit_token as btoken from create_shared_hand('{"version":1,"game":"NLHE"}'::jsonb, 'Bloqueio', false, null) \gset
select id as troll_c from add_hand_comment(:'bshare', 'Troll', 'lixo', null, 'keyT') \gset
select count(*) = 1 from add_hand_comment(:'bshare', 'Troll', 'mais lixo', null, 'keyT');
select count(*) = 1 from add_hand_comment(:'bshare', 'Ana', 'Bom fold', null, 'keyA');
select comments = 3 as counted_before_block from hand_comment_counts(array[:'bshare', 'nope']);
select block_hand_commenter(:'troll_c', 'wrong-token') = false as block_needs_token;
select block_hand_commenter(:'troll_c', :'btoken') as owner_blocks;
select count(*) = 1 and min(author_name) = 'Ana' as blocked_author_hidden from list_hand_comments(:'bshare');
select comments = 1 as counted_after_block from hand_comment_counts(array[:'bshare']);
\set ON_ERROR_STOP off
select add_hand_comment(:'bshare', 'Troll', 'voltei', null, 'keyT');
\set ON_ERROR_STOP on
select count(*) = 1 as blocked_author_refused from list_hand_comments(:'bshare');
select count(*) = 1 as others_still_comment from add_hand_comment(:'bshare', 'Rui', 'Obrigado', null, 'keyR');
reset role;

-- Reader-side blocks: the server keeps the sender's and commenters' keys (the web server turns
-- them into opaque ids); nobody else can call these.
set role service_role;
select id as sshare from create_shared_hand('{"version":1,"game":"NLHE"}'::jsonb, 'De um amigo', false, null, true, 'senderK') \gset
select sender_key = 'senderK' as sender_key_kept from get_shared_hand(:'sshare');
select count(*) = 1 from add_hand_comment(:'sshare', 'Zé', 'Call', null, 'keyZ');
select author_key = 'keyZ' as author_key_listed from list_hand_comments(:'sshare');
select sender_key is null as sender_optional from get_shared_hand(:'bshare');
reset role;
set role anon;
\set ON_ERROR_STOP off
select * from get_shared_hand(:'sshare');
select * from list_hand_comments(:'sshare');
\set ON_ERROR_STOP on
reset role;
