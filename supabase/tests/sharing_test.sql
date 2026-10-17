-- Run as anon, the role the share page and the app use before sign-in.
\set ON_ERROR_STOP on
set role anon;

select id as share_id, edit_token as share_token
  from create_shared_hand('{"version":1,"game":"NLHE"}'::jsonb, 'AQ vs KK', false, '{"street":"turn","actionIndex":1}'::jsonb) \gset

select count(*) = 1 as can_read_share from shared_hands where id = :'share_id';

-- Secret columns are not readable
\set ON_ERROR_STOP off
select edit_token_hash from shared_hands;
\set ON_ERROR_STOP on

select count(*) = 1 as comment_added from add_hand_comment(:'share_id', ' Tiago ', 'Fold no turn', 17);
select author_name = 'Tiago' as name_trimmed from hand_comments where hand_id = :'share_id';

\set ON_ERROR_STOP off
select add_hand_comment(:'share_id', '', 'sem nome');
\set ON_ERROR_STOP on

select cast_hand_vote(:'share_id', gen_random_uuid(), 'fold');
select cast_hand_vote(:'share_id', '00000000-0000-0000-0000-000000000001', 'call');
select cast_hand_vote(:'share_id', '00000000-0000-0000-0000-000000000001', 'raise');
select string_agg(choice || '=' || votes, ',' order by choice) as votes from hand_vote_counts(:'share_id');

\set ON_ERROR_STOP off
select * from hand_votes;
\set ON_ERROR_STOP on

select id as comment_id from add_hand_comment(:'share_id', 'Troll', 'spam', null) \gset
select report_hand_comment(:'comment_id', gen_random_uuid());
select report_hand_comment(:'comment_id', '00000000-0000-0000-0000-000000000009');
select report_hand_comment(:'comment_id', '00000000-0000-0000-0000-000000000009');
select count(*) = 1 as visible_after_two_reports from hand_comments where id = :'comment_id';
select report_hand_comment(:'comment_id', gen_random_uuid());
select count(*) = 0 as hidden_after_three_reports from hand_comments where id = :'comment_id';

select record_hand_view(:'share_id');
select view_count = 1 as view_counted from shared_hands where id = :'share_id';

select delete_shared_hand(:'share_id', 'wrong') = false as wrong_token_rejected;
select delete_shared_hand(:'share_id', :'share_token') as deleted;
select count(*) = 0 as hidden_after_delete from shared_hands where id = :'share_id';
select count(*) = 0 as comments_hidden_after_delete from hand_comments where hand_id = :'share_id';

\set ON_ERROR_STOP off
select create_shared_hand('{"version":2}'::jsonb);
