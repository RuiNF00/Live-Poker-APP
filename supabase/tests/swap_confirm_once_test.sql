-- A confirm or a seat claim sent twice (an automatic retry after a lost answer) lets the player
-- in, with the same token. Run as service_role.
\set ON_ERROR_STOP on
set role service_role;

\set kb 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
\set kx 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
\set ks 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
select id as sid from create_swap('{"v":1,"title":"Main"}'::jsonb) \gset
select confirm_swap(:'sid', 'Ana', :'kb') = :'kb' as confirm_takes_the_apps_token;
select confirm_swap(:'sid', 'Ana', :'kb') = :'kb' as same_token_again_gets_in;
select swap_side(:'sid', :'kb') = 'b' as other_side;
select confirm_swap(:'sid', 'Eva', :'kx') is null as another_token_still_locked_out;
select confirm_swap(:'sid', 'Eva') is null as no_token_still_locked_out;
select confirmed_name = 'Ana' as first_name_kept from swaps where id = :'sid';
select id as sid2, token as ta2 from create_swap('{"v":1,"title":"Main"}'::jsonb) \gset
select confirm_swap(:'sid2', 'Ana', :'ta2') is null as creators_token_refused;
select confirm_swap(:'sid2', 'Ana') ~ '^[a-f0-9]{64}$' as old_callers_still_work;

select id as gid, invite from create_swap_group('{"v":1,"title":"Bahamas","pct":2}'::jsonb, array['Rui','Ana','João']) \gset
select claim_swap_group_seat(:'gid', :'invite', 1, :'ks') = :'ks' as claim_takes_the_apps_token;
select claim_swap_group_seat(:'gid', :'invite', 1, :'ks') = :'ks' as same_seat_again_gets_in;
select swap_group_seat(:'gid', :'ks') = 1 as seat_one;
select claim_swap_group_seat(:'gid', :'invite', 2, :'ks') is null as same_token_other_seat_refused;
select claim_swap_group_seat(:'gid', :'invite', 1, :'kx') is null as seat_taken_for_others;
select claim_swap_group_seat(:'gid', :'kx', 1, :'ks') is null as wrong_invite_refused;
select claim_swap_group_seat(:'gid', :'invite', 2) ~ '^[a-f0-9]{64}$' as old_claims_still_work;
reset role;

\set ON_ERROR_STOP off
set role service_role;
-- Bad tokens are refused (each prints an ERROR).
select confirm_swap(:'sid2', 'Ana', 'short');
select claim_swap_group_seat(:'gid', :'invite', 1, 'ABC');
reset role;
set role anon;
select confirm_swap(:'sid', 'Ana', :'kb');
reset role;
