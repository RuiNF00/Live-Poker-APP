-- Festival action packages (20261017180000). Run as service_role, like the web server.
\set ON_ERROR_STOP on
set role service_role;

select id as oid, edit_token as otok from create_action_offer('{"v":1,"player":"Rui","title":"Festival","cur":"€","markup":1.1,"cap":10,"min":1,"whole":false,"closed":false,"at":1,"events":[{"id":"e1","n":"A","d":1790000000000,"b":1000,"s":30},{"id":"e2","n":"B","d":1790100000000,"b":2000,"s":12}]}'::jsonb) \gset
select last_event_at = to_timestamp(1790100000) as last_event_set from action_offers where id = :'oid';
select taken = '{}'::jsonb and count = 0 as empty_taken from get_action_offer(:'oid');

select rid as r1 from reserve_action(:'oid', 'Ana', '@ana', '[{"e":"e1","p":10},{"e":"e2","p":5}]') where result = 'ok' \gset
select (taken->>'e1')::numeric = 10 and (taken->>'e2')::numeric = 5 and count = 1 as taken_counts from get_action_offer(:'oid');
select result = 'over_cap' as over_cap from reserve_action(:'oid', 'B', '', '[{"e":"e1","p":10.5}]');
select result = 'invalid' as below_min from reserve_action(:'oid', 'B', '', '[{"e":"e1","p":0.5}]');
select result = 'invalid' as unknown_event from reserve_action(:'oid', 'B', '', '[{"e":"zz","p":1}]');
select result = 'invalid' as dup_event from reserve_action(:'oid', 'B', '', '[{"e":"e1","p":1},{"e":"e1","p":1}]');
select result = 'invalid' as bad_p from reserve_action(:'oid', 'B', '', '[{"e":"e1","p":"3"}]');
select result = 'invalid' as no_name from reserve_action(:'oid', '  ', '', '[{"e":"e1","p":1}]');
select result = 'ok' as second_ok from reserve_action(:'oid', 'C', '', '[{"e":"e2","p":7}]');
select result = 'sold_out' as sold_out from reserve_action(:'oid', 'D', '', '[{"e":"e1","p":1},{"e":"e2","p":1}]');
select result = 'invalid' as half_ok_min from reserve_action(:'oid', 'D', '', '[{"e":"e2","p":0.25}]');
select (taken->>'e2')::numeric = 12 as e2_full from get_action_offer(:'oid');

-- Lowering s below what is held is a conflict; wrong token is not_found.
select update_action_offer(:'oid', :'otok', '{"v":1,"cap":10,"min":1,"whole":false,"closed":false,"events":[{"id":"e1","d":1,"b":1,"s":9},{"id":"e2","d":1,"b":1,"s":12}]}') = 'conflict' as update_conflict;
select update_action_offer(:'oid', :'otok', '{"v":1,"cap":10,"min":1,"whole":false,"closed":false,"events":[{"id":"e1","d":1,"b":1,"s":30}]}') = 'conflict' as removed_event_conflict;
select update_action_offer(:'oid', 'nope', '{"v":1,"events":[]}') = 'not_found' as update_wrong_token;

-- Declining frees; re-confirming checks room again.
select set_reservation_status(:'oid', :'otok', :'r1', 'declined') = 'ok' as declined;
select (taken->>'e2')::numeric = 7 and count = 1 as declined_frees from get_action_offer(:'oid');
select result = 'ok' as takes_freed from reserve_action(:'oid', 'E', '', '[{"e":"e2","p":5}]');
select set_reservation_status(:'oid', :'otok', :'r1', 'confirmed') = 'sold_out' as reconfirm_blocked;
select set_reservation_status(:'oid', 'bad', :'r1', 'confirmed') = 'not_found' as status_wrong_token;
select set_reservation_status(:'oid', :'otok', :'r1', 'weird') = 'invalid' as status_invalid;
select jsonb_array_length(l) = 3 and l->0->>'name' = 'Ana' and l->0->>'contact' = '@ana' as owner_list from list_action_reservations(:'oid', :'otok') l;
select list_action_reservations(:'oid', 'bad') is null as list_wrong_token;
select id as eid, edit_token as etok from create_action_offer('{"v":1,"events":[]}'::jsonb) \gset
select list_action_reservations(:'eid', :'etok') = '[]'::jsonb as list_empty_owner;
select update_action_offer(:'oid', :'otok', '{"v":1,"cap":10,"min":1,"whole":false,"closed":true,"events":[{"id":"e1","d":1790000000000,"b":1,"s":30},{"id":"e2","d":1790000000000,"b":1,"s":12}]}') = 'ok' as update_ok;
select result = 'closed' as closed from reserve_action(:'oid', 'F', '', '[{"e":"e1","p":1}]');

-- Whole package: same p for every event.
select id as wid from create_action_offer('{"v":1,"cap":5,"min":0.5,"whole":true,"closed":false,"events":[{"id":"a","d":1,"b":1,"s":10},{"id":"b","d":2,"b":1,"s":10}]}'::jsonb) \gset
select result = 'invalid' as whole_uneven from reserve_action(:'wid', 'G', '', '[{"e":"a","p":2},{"e":"b","p":3}]');
select result = 'invalid' as whole_missing from reserve_action(:'wid', 'G', '', '[{"e":"a","p":2}]');
select result = 'ok' as whole_ok from reserve_action(:'wid', 'G', '', '[{"e":"a","p":2.5},{"e":"b","p":2.5}]');

-- 200 reservations per offer.
insert into action_reservations (id, offer_id, name, shares, status)
  select 'x' || g, :'wid', 'n', '[]', 'declined' from generate_series(1, 199) g;
select result = 'full' as full_offer from reserve_action(:'wid', 'H', '', '[{"e":"a","p":1},{"e":"b","p":1}]');

-- Purge 60 days after the last event, reservations with it.
update action_offers set last_event_at = now() - interval '61 days' where id = :'wid';
select purge_action_offers() = 1 as purged;
select count(*) = 0 as reservations_cascade from action_reservations where offer_id = :'wid';
select delete_action_offer(:'oid', 'bad') = false as delete_wrong_token;
select delete_action_offer(:'oid', :'otok') as deleted;

\set ON_ERROR_STOP off
select create_action_offer('{"v":2,"events":[]}'::jsonb);
select edit_token_hash from get_action_offer('x');
reset role;
set role anon;
select * from action_offers;
select * from action_reservations;
select * from get_action_offer('x');
select reserve_action('x', 'a', '', '[]');
reset role;
