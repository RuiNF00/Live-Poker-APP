-- A swap made without signal keeps the id the phone worked out from its token, so the link
-- shared at once works when the create lands. Run as service_role.
\set ON_ERROR_STOP on
set role service_role;

\set k1 'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4'
\set k2 'e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5'
\set k3 'f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6'
\set k4 '0707070707070707070707070707070707070707070707070707070707070707'
select swap_own_id(:'k1') as sid \gset
select swap_own_id(:'k3') as gid \gset
select :'sid' ~ '^[a-f0-9]{16}$' as own_id_shape;
select id = :'sid' as own_id_kept from create_swap('{"v":1,"title":"Main"}'::jsonb, :'k1', :'sid');
select id = :'sid' as own_id_same_on_retry from create_swap('{"v":1,"title":"Main"}'::jsonb, :'k1', :'sid');
select count(*) = 1 as own_id_one_row from swaps where id = :'sid';
select swap_side(:'sid', :'k1') = 'a' as own_id_creator_side;
select id <> :'sid' as no_id_still_random from create_swap('{"v":1}'::jsonb, :'k2');

select id = :'gid' as group_own_id_kept from create_swap_group('{"v":1,"title":"Bahamas","pct":2}'::jsonb, array['Rui','Ana','João'], :'k3', :'k4', :'gid');
select id = :'gid' as group_own_id_same_on_retry from create_swap_group('{"v":1,"title":"Bahamas","pct":2}'::jsonb, array['Rui','Ana','João'], :'k3', :'k4', :'gid');
select swap_group_seat(:'gid', :'k3') = 0 as group_own_id_creator_seat;
reset role;

\set ON_ERROR_STOP off
set role service_role;
-- Each prints an ERROR: another token's id (someone who saw the link early), a made-up id, an id
-- without a token.
select create_swap('{"v":1}'::jsonb, 'abababababababababababababababababababababababababababababababab', :'sid');
select create_swap('{"v":1}'::jsonb, 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd', 'Ph0neId001');
select create_swap('{"v":1}'::jsonb, null, :'sid');
select create_swap_group('{"v":1,"pct":2}'::jsonb, array['a','b','c'], 'abababababababababababababababababababababababababababababababab', 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd', :'gid');
select create_swap_group('{"v":1,"pct":2}'::jsonb, array['a','b','c'], 'abababababababababababababababababababababababababababababababab', 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd', 'bad-id!!!!');
reset role;
\set ON_ERROR_STOP on
set role service_role;
select count(*) = 0 as refused_left_nothing from swaps where token_a_hash = swap_hash('abababababababababababababababababababababababababababababababab') or token_a_hash = swap_hash('cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd');
reset role;
-- Nobody but the server can call them.
select not has_function_privilege('anon', 'public.create_swap(jsonb, text, text)', 'execute') as anon_cannot_create;
select not has_function_privilege('authenticated', 'public.create_swap_group(jsonb, text[], text, text, text)', 'execute') as auth_cannot_create_group;
