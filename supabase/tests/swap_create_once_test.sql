-- A create sent twice (an automatic retry after a lost answer) makes one swap. Run as service_role.
\set ON_ERROR_STOP on
set role service_role;

\set k1 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
\set k2 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
\set k3 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
select count(*) as before from swaps \gset
select id as s1, token as tk1 from create_swap('{"v":1,"title":"Main"}'::jsonb, :'k1') \gset
select id as s2 from create_swap('{"v":1,"title":"Main"}'::jsonb, :'k1') \gset
select :'s1' = :'s2' as same_swap_on_retry;
select :'tk1' = :'k1' as token_is_the_apps;
select count(*) = :before + 1 as one_row from swaps;
select swap_side(:'s1', :'k1') = 'a' as creator_side;
select id <> :'s1' as new_token_new_swap from create_swap('{"v":1,"title":"Main"}'::jsonb, :'k2');
select token <> '' as old_callers_still_work from create_swap('{"v":1,"title":"Main"}'::jsonb);

select id as g1, invite as inv1 from create_swap_group('{"v":1,"title":"Bahamas","pct":2}'::jsonb, array['Rui','Ana','João'], :'k3', :'k2') \gset
select id as g2 from create_swap_group('{"v":1,"title":"Bahamas","pct":2}'::jsonb, array['Rui','Ana','João'], :'k3', :'k2') \gset
select :'g1' = :'g2' as same_group_on_retry;
select count(*) = 1 as one_group from swap_groups where id in (select group_id from swap_group_seats where seat = 0 and token_hash = swap_hash(:'k3'));
select swap_group_seat(:'g1', :'k3') = 0 as creator_seat;
select claim_swap_group_seat(:'g1', :'k2', 1) is not null as invite_is_the_apps;
reset role;

\set ON_ERROR_STOP off
set role service_role;
-- Bad tokens are refused (each prints an ERROR).
select create_swap('{"v":1}'::jsonb, 'short');
select create_swap_group('{"v":1}'::jsonb, array['a','b','c'], :'k1', null);
reset role;
set role anon;
select create_swap('{"v":1}'::jsonb, :'k1');
reset role;
