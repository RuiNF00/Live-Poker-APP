-- Group swaps. Run as service_role, like the web server.
\set ON_ERROR_STOP on
set role service_role;

select id as gid, token as t0, invite from create_swap_group('{"v":1,"title":"Bahamas","pct":2}'::jsonb, array['Rui','Ana','João']) \gset
select jsonb_array_length(seats) = 3 and seats->0->>'confirmedAt' is not null and seats->1->>'confirmedAt' is null as creator_seated from get_swap_group(:'gid');
select swap_group_seat(:'gid', :'t0') = 0 as creator_seat_known;
select swap_group_seat(:'gid', 'wrong') is null as wrong_token_no_seat;

-- Seats are claimed only with the invite, once each.
select claim_swap_group_seat(:'gid', 'wrong', 1) is null as wrong_invite_refused;
select claim_swap_group_seat(:'gid', '', 1) is null as empty_invite_refused;
select claim_swap_group_seat(:'gid', :'invite', 1) as t1 \gset
select claim_swap_group_seat(:'gid', :'invite', 1) is null as seat_claimed_once;
select claim_swap_group_seat(:'gid', :'invite', 0) is null as creator_seat_not_claimable;
select claim_swap_group_seat(:'gid', :'invite', 7) is null as missing_seat_refused;
select swap_group_seat(:'gid', :'t1') = 1 as seat_1_known;

-- Nothing is added until every seat is taken.
select add_swap_group_entry(:'gid', :'t1', '{"kind":"result","amount":1000,"cid":"c1"}'::jsonb) = false as waits_for_everyone;
select claim_swap_group_seat(:'gid', :'invite', 2) as t2 \gset

-- The seat comes from the token; retries don't duplicate; payments go to another seat.
select add_swap_group_entry(:'gid', :'t1', '{"kind":"result","amount":1000,"cid":"c1","seat":0}'::jsonb) as added;
select add_swap_group_entry(:'gid', :'t1', '{"kind":"result","amount":1000,"cid":"c1"}'::jsonb) as retry_ok;
select add_swap_group_entry(:'gid', :'t2', '{"kind":"payment","amount":20,"cid":"c1","to":1}'::jsonb) as payment_added;
select add_swap_group_entry(:'gid', :'t2', '{"kind":"payment","amount":20,"cid":"c2","to":2}'::jsonb) = false as no_payment_to_self;
select add_swap_group_entry(:'gid', :'t2', '{"kind":"payment","amount":20,"cid":"c3","to":5}'::jsonb) = false as no_payment_to_nobody;
select jsonb_array_length(entries) = 2 and entries->0->>'seat' = '1' as seats_from_tokens from get_swap_group(:'gid');

-- Nobody removes another seat's entries.
select entries->0->>'id' as e1 from get_swap_group(:'gid') \gset
select remove_swap_group_entry(:'gid', :'t2', :'e1') = false as others_cannot_remove;
select remove_swap_group_entry(:'gid', :'t1', :'e1') as own_removed;

-- Someone leaving keeps the accounts for the others; their token stops working.
select leave_swap_group(:'gid', :'t2') as left_group;
select seats->2->>'name' = '-' and jsonb_array_length(entries) = 1 as accounts_kept from get_swap_group(:'gid');
select swap_group_seat(:'gid', :'t2') is null as left_token_dead;
-- The creator deleting removes it for everyone.
select leave_swap_group(:'gid', :'t1') and leave_swap_group(:'gid', :'t0') as creator_deleted;
select count(*) = 0 as group_gone from get_swap_group(:'gid');
select count(*) = 0 as seats_gone from swap_group_seats where group_id = :'gid';

\set ON_ERROR_STOP off
-- Too small or too big, wrong version: refused. Hashes never come back.
select create_swap_group('{"v":1}'::jsonb, array['a','b']);
select create_swap_group('{"v":1}'::jsonb, array['a','b','c','d','e','f','g','h','i']);
select create_swap_group('{"v":2}'::jsonb, array['a','b','c']);
select invite_hash from get_swap_group(:'gid');
\set ON_ERROR_STOP on

-- Not everyone in after 31 days: purged.
select id as old_gid from create_swap_group('{"v":1}'::jsonb, array['a','b','c']) \gset
update swap_groups set created_at = now() - interval '31 days' where id = :'old_gid';
select purge_swap_groups() >= 1 as purged;
select count(*) = 0 as old_gone from get_swap_group(:'old_gid');

reset role;
set role anon;
\set ON_ERROR_STOP off
select * from get_swap_group('x');
select * from swap_groups;
