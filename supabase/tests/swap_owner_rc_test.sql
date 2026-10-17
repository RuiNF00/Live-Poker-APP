-- The creator's RevenueCat id (settlement follows the creator's Pro). Run as service_role.
\set ON_ERROR_STOP on
set role service_role;

select id as sid, token as ta from create_swap('{"v":1,"title":"Bahamas","a":{"name":"Rui","pct":5},"b":{"name":"Ana","pct":5}}'::jsonb) \gset
select confirm_swap(:'sid', 'Ana') as tb \gset

-- Only the creator's token sets it, and a new id replaces the old one.
select set_swap_owner_rc(:'sid', :'tb', 'rc-ana') = false as other_side_cannot_set;
select set_swap_owner_rc(:'sid', 'wrong', 'rc-x') = false as wrong_token_cannot_set;
select set_swap_owner_rc(:'sid', :'ta', '') = false as empty_id_refused;
select set_swap_owner_rc(:'sid', :'ta', repeat('x', 101)) = false as long_id_refused;
select set_swap_owner_rc(:'sid', :'ta', 'rc-rui-1') as creator_sets;
select set_swap_owner_rc(:'sid', :'ta', 'rc-rui-2') as creator_overwrites;
select swap_owner_rc_of(:'sid') = 'rc-rui-2' as latest_id_read;
select swap_owner_rc_of('nope') is null as unknown_swap_null;
-- It never comes back with the swap.
select not (to_jsonb(s) ? 'rc_user_id') as not_in_swap_read from get_swap(:'sid') s;

-- The other player leaving keeps it; the creator leaving drops it at once.
select leave_swap(:'sid', :'tb') as other_left;
select swap_owner_rc_of(:'sid') = 'rc-rui-2' as kept_after_other_leaves;

select id as sid2, token as ta2 from create_swap('{"v":1,"a":{"name":"Rui","pct":5},"b":{"name":"Ana","pct":5}}'::jsonb) \gset
select confirm_swap(:'sid2', 'Ana') as tb2 \gset
select set_swap_owner_rc(:'sid2', :'ta2', 'rc-rui') as set2;
select leave_swap(:'sid2', :'ta2') as creator_left;
select swap_owner_rc_of(:'sid2') is null as dropped_when_creator_leaves;

-- Deleting the swap deletes it (cascade).
select id as sid3, token as ta3 from create_swap('{"v":1,"a":{"name":"Rui","pct":5},"b":{"name":"Ana","pct":5}}'::jsonb) \gset
select set_swap_owner_rc(:'sid3', :'ta3', 'rc-rui') as set3;
delete from swaps where id = :'sid3';
select count(*) = 0 as cascade_on_delete from swap_owner_rc where swap_id = :'sid3';

-- Groups: seat 0 only, overwrite, gone with the group.
select id as gid, token as t0, invite from create_swap_group('{"v":1,"title":"Bahamas","pct":2}'::jsonb, array['Rui','Ana','João']) \gset
select claim_swap_group_seat(:'gid', :'invite', 1) as t1 \gset
select set_swap_group_owner_rc(:'gid', :'t1', 'rc-ana') = false as seat_1_cannot_set;
select set_swap_group_owner_rc(:'gid', :'t0', 'rc-rui-1') and set_swap_group_owner_rc(:'gid', :'t0', 'rc-rui-2') as group_creator_overwrites;
select swap_group_owner_rc_of(:'gid') = 'rc-rui-2' as group_id_read;
select leave_swap_group(:'gid', :'t0') as group_creator_left;
select count(*) = 0 as group_rc_gone from swap_group_owner_rc where group_id = :'gid';
reset role;

-- Nobody but the server reads or sets it.
set role anon;
\set ON_ERROR_STOP off
select * from swap_owner_rc;
select * from swap_group_owner_rc;
select swap_owner_rc_of(:'sid');
select set_swap_owner_rc(:'sid', :'ta', 'rc-evil');
\set ON_ERROR_STOP on
reset role;
set role authenticated;
\set ON_ERROR_STOP off
select * from swap_owner_rc;
select swap_group_owner_rc_of(:'gid');
\set ON_ERROR_STOP on
reset role;
