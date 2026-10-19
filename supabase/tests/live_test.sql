-- Backer live links. Run as service_role, like the web server.
\set ON_ERROR_STOP on
set role service_role;

select id as live_id, edit_token as live_token from create_live_session('{"v":1,"stack":30000}'::jsonb) \gset
select (payload->>'stack')::int = 30000 as live_readable from get_live_session(:'live_id');
select update_live_session(:'live_id', 'wrong', '{"v":1,"stack":1}'::jsonb) = false as live_wrong_token_rejected;
select (payload->>'stack')::int = 30000 as live_unchanged_by_wrong_token from get_live_session(:'live_id');
select update_live_session(:'live_id', :'live_token', '{"v":1,"stack":45000}'::jsonb) as live_updated;
select (payload->>'stack')::int = 45000 as live_update_visible from get_live_session(:'live_id');
select record_live_view(:'live_id');
select view_count = 1 as live_view_counted from get_live_session(:'live_id');

\set ON_ERROR_STOP off
-- Wrong version and the token hash are both refused.
select create_live_session('{"v":2}'::jsonb);
select edit_token_hash from get_live_session(:'live_id');
\set ON_ERROR_STOP on

-- Not updated for 31 days: purged.
select id as old_id from create_live_session('{"v":1}'::jsonb) \gset
update live_sessions set updated_at = now() - interval '31 days' where id = :'old_id';
select purge_live_sessions() = 1 as stale_live_purged;
select count(*) = 1 as fresh_live_kept from live_sessions where id = :'live_id';

select delete_live_session(:'live_id', 'wrong') = false as live_delete_wrong_token;
select delete_live_session(:'live_id', :'live_token') as live_deleted;
select count(*) = 0 as live_gone from live_sessions where id = :'live_id';

reset role;
-- Nothing for the public keys.
set role anon;
\set ON_ERROR_STOP off
select * from live_sessions;
select * from get_live_session('x');
select create_live_session('{"v":1}'::jsonb);
\set ON_ERROR_STOP on
reset role;
