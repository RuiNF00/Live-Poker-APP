-- "Delete all my data": the comments one app install wrote on other people's hands go, nobody else's.
\set ON_ERROR_STOP on
set role service_role;
\set ka 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
\set kb 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
select id as e1 from create_shared_hand('{"v":1}'::jsonb) \gset
select id as e2 from create_shared_hand('{"v":1}'::jsonb) \gset
select id as ca1 from add_hand_comment(:'e1', 'Ana', 'Fold.', null, :'ka') \gset
select id as ca2 from add_hand_comment(:'e2', 'Ana', 'Call.', null, :'ka') \gset
select id as cb1 from add_hand_comment(:'e1', 'Rui', 'Shove.', null, :'kb') \gset
select count(*) = 1 as comment_without_key from add_hand_comment(:'e1', 'Zé', 'Sem id.', null, null);
-- A block on that author elsewhere (set up as the table owner; the app makes it through block_hand_commenter).
reset role;
insert into hand_comment_blocks (hand_id, author_key) values (:'e2', :'ka');
set role service_role;
select delete_comments_by_author(:'ka') = 2 as erase_counts_two;
select count(*) = 0 as author_comments_gone from hand_comments where author_key = :'ka';
select count(*) = 1 as other_author_stays from hand_comments where id = :'cb1';
select count(*) = 1 as keyless_stays from hand_comments where hand_id = :'e1' and author_key is null;
reset role;
select count(*) = 0 as blocks_gone from hand_comment_blocks where author_key = :'ka';
set role service_role;
select delete_comments_by_author(:'ka') = 0 as erase_again_is_zero;
select delete_comments_by_author('nope') = 0 as bad_key_is_zero;
select delete_comments_by_author(null) = 0 as null_key_is_zero;
reset role;
\set ON_ERROR_STOP off
set role anon;
select delete_comments_by_author(:'kb');
reset role;
