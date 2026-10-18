-- The creator taking a player out of a group swap. Run as service_role.
\set ON_ERROR_STOP on
set role service_role;

select id as gid, token as t0, invite from create_swap_group('{"v":1,"title":"Bahamas","pct":2}'::jsonb, array['Rui','Ana','João']) \gset
select claim_swap_group_seat(:'gid', :'invite', 1) as t1 \gset
select claim_swap_group_seat(:'gid', :'invite', 2) as t2 \gset

select release_swap_group_seat(:'gid', :'t1', 2) = false as only_creator_releases;
select release_swap_group_seat(:'gid', :'t0', 0) = false as creator_seat_stays;
select release_swap_group_seat(:'gid', :'t0', 9) = false as missing_seat_refused;

-- Ana has a prize in: her seat stays. João has nothing: his seat is freed.
select add_swap_group_entry(:'gid', :'t1', '{"kind":"result","amount":1000,"cid":"c1"}'::jsonb) as ana_prize;
select release_swap_group_seat(:'gid', :'t0', 1) = false as seat_with_entries_stays;
select add_swap_group_entry(:'gid', :'t1', '{"kind":"payment","amount":20,"cid":"p1","to":2}'::jsonb) as paid_joao;
select release_swap_group_seat(:'gid', :'t0', 2) = false as seat_paid_to_stays;
select entries->1->>'id' as pid from get_swap_group(:'gid') \gset
select remove_swap_group_entry(:'gid', :'t1', :'pid') as payment_removed;
select release_swap_group_seat(:'gid', :'t0', 2) as joao_released;
select swap_group_seat(:'gid', :'t2') is null as old_token_dead;
select seats->2->>'confirmedAt' is null and seats->2->>'name' = 'João' as seat_open_again from get_swap_group(:'gid');
select release_swap_group_seat(:'gid', :'t0', 2) = false as open_seat_not_released;
-- Nothing new counts until the seat is taken again, with the group's invite.
select add_swap_group_entry(:'gid', :'t1', '{"kind":"result","amount":5,"cid":"c2"}'::jsonb) = false as waits_for_seat;
select claim_swap_group_seat(:'gid', :'invite', 2) is not null as seat_reclaimed;
reset role;

set role anon;
\set ON_ERROR_STOP off
select release_swap_group_seat(:'gid', :'t0', 1);
\set ON_ERROR_STOP on
reset role;

-- Dropping a player who never joined: the group carries on with the others, from 3 up.
set role service_role;
select id as g2, token as g2t0, invite as g2inv from create_swap_group('{"v":1,"title":"Bahamas","pct":2}'::jsonb, array['Rui','Ana','João','Pedro']) \gset
select claim_swap_group_seat(:'g2', :'g2inv', 1) as g2t1 \gset
select claim_swap_group_seat(:'g2', :'g2inv', 3) as g2t3 \gset
select remove_swap_group_seat(:'g2', :'g2t1', 2) = false as only_creator_removes;
select remove_swap_group_seat(:'g2', :'g2t0', 1) = false as joined_seat_not_removed;
select remove_swap_group_seat(:'g2', :'g2t0', 2) as never_joined_removed;
select jsonb_array_length(seats) = 3 and seats->2->>'seat' = '3' as others_keep_their_seats from get_swap_group(:'g2');
select swap_group_seat(:'g2', :'g2t3') = 3 as token_still_seat_3;
select add_swap_group_entry(:'g2', :'g2t3', '{"kind":"payment","amount":5,"cid":"p1","to":1}'::jsonb) as group_ready_now;
select add_swap_group_entry(:'g2', :'g2t3', '{"kind":"payment","amount":5,"cid":"p2","to":2}'::jsonb) = false as no_payment_to_removed_seat;
select id as g3, token as g3t0 from create_swap_group('{"v":1,"pct":2}'::jsonb, array['Rui','Ana','João']) \gset
select remove_swap_group_seat(:'g3', :'g3t0', 2) = false as three_is_the_minimum;
reset role;
set role anon;
\set ON_ERROR_STOP off
select remove_swap_group_seat(:'g3', :'g3t0', 2);
\set ON_ERROR_STOP on
reset role;
