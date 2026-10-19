-- App Store 1.2: the team ejects an abusive commenter on every hand, not just the one reported.
\set ON_ERROR_STOP on
set role service_role;
\set ka 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
\set kb 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
select id as b1 from create_shared_hand('{"v":1}'::jsonb) \gset
select id as b2 from create_shared_hand('{"v":1}'::jsonb) \gset
select id as a1 from add_hand_comment(:'b1', 'Ana', 'Insulto.', null, :'ka') \gset
select id as a2 from add_hand_comment(:'b2', 'Ana', 'Outro.', null, :'ka') \gset
select id as rb from add_hand_comment(:'b1', 'Rui', 'Call.', null, :'kb') \gset
select id as nokey from add_hand_comment(:'b2', 'Zé', 'Sem id.', null, null) \gset
select ban_comment_author(:'a1') = 2 as ban_hides_both;
select bool_and(hidden and hidden_at is not null) as author_hidden_everywhere from hand_comments where author_key = :'ka';
select not hidden as other_author_untouched from hand_comments where id = :'rb';
select ban_comment_author(:'a1') = 0 as ban_again_is_zero;
select ban_comment_author('00000000-0000-0000-0000-000000000000') is null as missing_comment_is_null;
select ban_comment_author(:'nokey') = 1 as keyless_hidden_alone;
-- The banned author can't comment on any hand; others still can.
\set ON_ERROR_STOP off
select add_hand_comment(:'b2', 'Ana', 'De volta.', null, :'ka');
\set ON_ERROR_STOP on
select count(*) = 1 as others_still_comment from add_hand_comment(:'b2', 'Rui', 'Fold.', null, :'kb');
select count(*) = 2 as no_new_comment_from_banned from hand_comments where author_key = :'ka';
-- Restoring one comment shows it and clears its reports, but the ban stays.
reset role;
insert into hand_comment_reports (comment_id, reporter_id) values (:'a2', gen_random_uuid());
set role service_role;
select restore_hand_comment(:'a2') as restored;
select not hidden as shown_again from hand_comments where id = :'a2';
select count(*) = 0 as reports_cleared from hand_comment_reports where comment_id = :'a2';
select restore_hand_comment(:'a2') = false as restore_again_false;
reset role;
select count(*) = 1 as ban_stays from banned_comment_authors where author_key = :'ka';
select count(*) = 0 as only_hashes_kept from banned_comment_authors where author_key !~ '^[0-9a-f]{64}$';
-- Lifting a ban by mistake lets the author comment again; lifting it twice says false.
set role service_role;
select unban_comment_author(:'a1') as unbanned;
select unban_comment_author(:'a1') = false as unban_again_false;
select count(*) = 1 as comments_again from add_hand_comment(:'b1', 'Ana', 'Desculpa.', null, :'ka');
select ban_comment_author(:'a1') >= 1 as banned_again;
reset role;
-- Kept one year.
update banned_comment_authors set banned_at = now() - interval '366 days';
select purge_moderation() >= 0 as purged;
select count(*) = 0 as ban_purged_after_a_year from banned_comment_authors;
-- Only the server reaches them.
\set ON_ERROR_STOP off
set role anon;
select ban_comment_author(:'rb');
select restore_hand_comment(:'rb');
select unban_comment_author(:'rb');
select * from banned_comment_authors;
reset role;
set role authenticated;
select ban_comment_author(:'rb');
select restore_hand_comment(:'rb');
select unban_comment_author(:'rb');
select * from banned_comment_authors;
reset role;
