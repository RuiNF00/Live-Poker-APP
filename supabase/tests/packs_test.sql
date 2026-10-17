-- Hand packs (/p/<id>). Run as service_role, like the web server.
\set ON_ERROR_STOP on
set role service_role;

select id as h1, edit_token as k1 from create_shared_hand('{"v":1}'::jsonb, null, false, null, true) \gset
select id as h2, edit_token as k2 from create_shared_hand('{"v":1}'::jsonb, null, false, null, true) \gset

select id as p, owner_token as o from create_hand_pack('Dia 2', jsonb_build_array(jsonb_build_object('id', :'h2', 'token', :'k2'), jsonb_build_object('id', :'h1', 'token', :'k1')), true) \gset
select length(:'p') = 12 and length(:'o') = 64 as pack_created;
select (select hand_ids from get_hand_pack(:'p')) = array[:'h2', :'h1'] as order_kept;
select count(*) = 0 as owner_token_not_stored_in_clear from hand_packs where owner_token_hash = :'o';
select count(*) = 0 as others_hand_refused from create_hand_pack('x', jsonb_build_array(jsonb_build_object('id', :'h1', 'token', 'wrong')), true);
select delete_hand_pack(:'p', 'nope') = false as delete_needs_owner;
select delete_hand_pack(:'p', :'o') as deleted;
select count(*) = 0 as pack_gone from get_hand_pack(:'p');

-- Every hand unshared: the pack goes with the purge.
select id as p2, owner_token as o2 from create_hand_pack('', jsonb_build_array(jsonb_build_object('id', :'h1', 'token', :'k1')), true) \gset
update shared_hands set deleted_at = now() where id = :'h1';
select purge_hand_packs() = 1 as empty_pack_purged;

\set ON_ERROR_STOP off
select create_hand_pack('', '[]'::jsonb, true);
reset role;
set role anon;
select * from hand_packs;
select get_hand_pack('x');
