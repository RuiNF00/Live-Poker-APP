-- A create sent twice (an automatic retry after a lost answer) makes one row: hand links, backer
-- live links, coach comments and the player's replies. Run as service_role, like the web server.
\set ON_ERROR_STOP on
set role service_role;

\set k1 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1'
\set k2 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
\set k3 'c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3'

-- Hand links.
select count(*) as hands_before from shared_hands \gset
select id as h1, edit_token as ht1 from create_shared_hand('{"v":1}'::jsonb, null, false, null, true, :'k1') \gset
select id as h2 from create_shared_hand('{"v":1}'::jsonb, null, false, null, true, :'k1') \gset
select :'h1' = :'h2' as hand_same_link_on_retry;
select :'ht1' = :'k1' as hand_token_is_the_apps;
select count(*) = :hands_before + 1 as hand_one_row from shared_hands;
select count(*) = 0 as hand_token_not_stored_in_clear from shared_hands where edit_token_hash = :'k1';
select delete_shared_hand(:'h1', :'k1') as hand_token_deletes;
select id <> :'h1' as hand_after_delete_new_link from create_shared_hand('{"v":1}'::jsonb, null, false, null, true, :'k1');
select id <> :'h1' as hand_new_token_new_link from create_shared_hand('{"v":1}'::jsonb, null, false, null, true, :'k3');
select edit_token <> '' as hand_old_callers_still_work from create_shared_hand('{"v":1}'::jsonb);

-- Backer live links.
select count(*) as live_before from live_sessions \gset
select id as l1, edit_token as lt1 from create_live_session('{"v":1,"stack":1}'::jsonb, :'k3') \gset
select id as l2 from create_live_session('{"v":1,"stack":2}'::jsonb, :'k3') \gset
select :'l1' = :'l2' as live_same_link_on_retry;
select :'lt1' = :'k3' as live_token_is_the_apps;
select count(*) = :live_before + 1 as live_one_row from live_sessions;
select update_live_session(:'l1', :'k3', '{"v":1,"stack":3}'::jsonb) as live_token_updates;
select edit_token <> '' as live_old_callers_still_work from create_live_session('{"v":1}'::jsonb);

-- Coach comments and replies.
select token as ct, owner_token as co from create_coach_link('Rever', 'Rui', null, '[{"id":"h1","payload":{"v":1,"id":"h1"}}]'::jsonb) \gset
select add_coach_comment(:'ct', 'h1', 2, 'mistake', 'Ana', 'Fold.', 'coach-key-1')->>'id' as c1 \gset
select add_coach_comment(:'ct', 'h1', 2, 'mistake', 'Ana', 'Fold.', 'coach-key-1')->>'id' as c2 \gset
select :'c1' = :'c2' as coach_same_comment_on_retry;
select add_player_reply(:'ct', :'co', 'h1', 2, 'Rui', 'Porquê?', 'local-abc123')->>'id' as r1 \gset
select add_player_reply(:'ct', :'co', 'h1', 2, 'Rui', 'Porquê?', 'local-abc123')->>'id' as r2 \gset
select :'r1' = :'r2' as reply_same_on_retry;
select :'r1' <> :'c1' as reply_and_comment_keys_apart;
select count(*) = 2 as coach_two_rows from coach_comments_since(:'ct', :'co', null);
select (add_player_reply(:'ct', :'co', 'h1', 2, 'Rui', 'Outra', null)->>'id') <> :'r1' as reply_without_key_is_new;
select revoke_coach_link(:'ct', :'co') as revoked;
select (add_player_reply(:'ct', :'co', 'h1', 2, 'Rui', 'Porquê?', 'local-abc123')->>'id') = :'r1' as reply_retry_after_close_returns_it;
select add_player_reply(:'ct', 'nope', 'h1', 2, 'Rui', 'Porquê?', 'local-abc123') is null as reply_retry_needs_owner;
reset role;

\set ON_ERROR_STOP off
set role service_role;
-- Bad tokens and keys are refused (each prints an ERROR), and a hand taken down by reports is
-- not put back up by a retry with its token ("gone").
select create_shared_hand('{"v":1}'::jsonb, null, false, null, true, 'short');
select id as down from create_shared_hand('{"v":1}'::jsonb, null, false, null, true, :'k2') \gset
update shared_hands set deleted_at = now() where id = :'down';
select create_shared_hand('{"v":1}'::jsonb, null, false, null, true, :'k2');
select create_live_session('{"v":1}'::jsonb, 'ZZ');
select token as ct2, owner_token as co2 from create_coach_link('Outra', 'Rui', null, '[{"id":"h1","payload":{"v":1,"id":"h1"}}]'::jsonb) \gset
select add_coach_comment(:'ct2', 'h1', 2, null, 'Ana', 'x', 'bad key!');
reset role;
set role anon;
select create_shared_hand('{"v":1}'::jsonb, null, false, null, true, :'k2');
select create_live_session('{"v":1}'::jsonb, :'k2');
reset role;
