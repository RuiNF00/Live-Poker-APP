-- Backers' fixed links (sealed pages). Run as service_role, like the web server.
\set ON_ERROR_STOP on
set role service_role;

\set tok '''aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'''
select id as pg_id from create_backer_page(:tok) \gset
select sealed is null as page_starts_empty from get_backer_page(:'pg_id');
-- The same create again (a retry after a lost answer) returns the same page.
select id = :'pg_id' as page_create_once from create_backer_page(:tok);
select count(*) = 1 as one_page_per_token from backer_pages;
select update_backer_page(:'pg_id', 'wrong', '{"v":1,"n":"x","c":"y"}'::jsonb) = false as page_wrong_token_rejected;
select update_backer_page(:'pg_id', :tok, '{"v":1,"n":"x","c":"y"}'::jsonb) as page_updated;
select sealed->>'c' = 'y' as page_update_visible from get_backer_page(:'pg_id');

\set ON_ERROR_STOP off
-- No app token, the wrong version, and the token hash are all refused.
select create_backer_page(null);
select create_backer_page('short');
select update_backer_page(:'pg_id', :tok, '{"v":2}'::jsonb);
select edit_token_hash from get_backer_page(:'pg_id');
\set ON_ERROR_STOP on
select sealed->>'c' = 'y' as page_unchanged_by_bad_update from get_backer_page(:'pg_id');

-- Not updated for 181 days: purged.
select id as old_id from create_backer_page('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') \gset
update backer_pages set updated_at = now() - interval '181 days' where id = :'old_id';
select purge_backer_pages() = 1 as stale_page_purged;
select count(*) = 1 as fresh_page_kept from backer_pages where id = :'pg_id';

select delete_backer_page(:'pg_id', 'wrong') = false as page_delete_wrong_token;
select delete_backer_page(:'pg_id', :tok) as page_deleted;
select count(*) = 0 as page_gone from backer_pages where id = :'pg_id';

reset role;
-- Nothing for the public keys.
set role anon;
\set ON_ERROR_STOP off
select * from backer_pages;
select * from get_backer_page('x');
select create_backer_page('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');
\set ON_ERROR_STOP on
reset role;
