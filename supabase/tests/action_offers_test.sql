-- Festival action packages, v2 (20261017180000). Run as service_role, like the web server.
\set ON_ERROR_STOP on
set role service_role;

select id as oid, edit_token as otok from create_action_offer('{"v":1,"player":"Rui","backer":"Ana","title":"Festival","cur":"€","markup":1.1,"at":1,"events":[{"id":"e1","n":"A","d":1790000000000,"b":1000,"p":5},{"id":"e2","n":"B","d":1790100000000,"b":2000,"p":2.5}]}'::jsonb) \gset
select last_event_at = to_timestamp(1790100000) as last_event_set from action_offers where id = :'oid';
select payload->>'backer' = 'Ana' and confirmed_at is null as readable_unconfirmed from get_action_offer(:'oid');

-- Confirming is idempotent: the first time stays.
select confirm_action_offer(:'oid') is not null as confirmed;
select confirmed_at as first_at from get_action_offer(:'oid') \gset
select confirm_action_offer(:'oid') = :'first_at'::timestamptz as confirm_idempotent;
select confirm_action_offer('nope') is null as confirm_unknown_null;

-- A new title keeps the confirmation; new markup or events clear it.
select update_action_offer(:'oid', :'otok', jsonb_set(payload, '{title}', '"Outro"')) as title_updated from action_offers where id = :'oid';
select confirmed_at = :'first_at'::timestamptz as title_keeps_confirmation from get_action_offer(:'oid');
select update_action_offer(:'oid', :'otok', jsonb_set(payload, '{markup}', '1.2')) as markup_updated from action_offers where id = :'oid';
select confirmed_at is null as markup_clears_confirmation from get_action_offer(:'oid');
select confirm_action_offer(:'oid') is not null as reconfirmed;
select update_action_offer(:'oid', :'otok', jsonb_set(payload, '{events,0,p}', '6')) as events_updated from action_offers where id = :'oid';
select confirmed_at is null as events_clear_confirmation from get_action_offer(:'oid');
-- So do a new currency or backer name (20261017211000).
select confirm_action_offer(:'oid') is not null as reconfirmed_2;
select update_action_offer(:'oid', :'otok', jsonb_set(payload, '{cur}', '"$"')) as cur_updated from action_offers where id = :'oid';
select confirmed_at is null as cur_clears_confirmation from get_action_offer(:'oid');
select confirm_action_offer(:'oid') is not null as reconfirmed_3;
select update_action_offer(:'oid', :'otok', jsonb_set(payload, '{backer}', '"Bea"')) as backer_updated from action_offers where id = :'oid';
select confirmed_at is null as backer_clears_confirmation from get_action_offer(:'oid');
select update_action_offer(:'oid', 'wrong', '{"v":1,"events":[]}') = false as update_wrong_token;
select (payload->'events'->0->>'p')::numeric = 6 as unchanged_by_wrong_token from get_action_offer(:'oid');

-- Purge 60 days after the last event.
select id as old_id from create_action_offer('{"v":1,"events":[{"id":"a","d":1,"b":1,"p":1}]}'::jsonb) \gset
select last_event_at < now() - interval '60 days' as old_event_dated from action_offers where id = :'old_id';
-- An event dated in 2200 can't keep a link from the purge.
select id as far_id from create_action_offer('{"v":1,"events":[{"id":"a","d":7258118400000,"b":1,"p":1}]}'::jsonb) \gset
select last_event_at <= now() + interval '2 years' as far_event_capped from action_offers where id = :'far_id';
select purge_action_offers() = 1 as purged;
select count(*) = 1 as current_kept from action_offers where id = :'oid';

select delete_action_offer(:'oid', 'wrong') = false as delete_wrong_token;
select delete_action_offer(:'oid', :'otok') as deleted;
select count(*) = 0 as gone from action_offers where id = :'oid';

\set ON_ERROR_STOP off
-- Wrong version and the token hash are both refused.
select create_action_offer('{"v":2,"events":[]}'::jsonb);
select edit_token_hash from get_action_offer('x');
\set ON_ERROR_STOP on
reset role;

-- Nothing for the public keys.
set role anon;
\set ON_ERROR_STOP off
select * from action_offers;
select * from get_action_offer('x');
select confirm_action_offer('x');
\set ON_ERROR_STOP on
reset role;
