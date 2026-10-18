-- "Novo comentário na tua mão": one notice per hand until it's opened, held in the quiet hours,
-- gone with the hand. Run as service_role.
\set ON_ERROR_STOP on
set role service_role;

\set tok 'ExponentPushToken[abcdefghij123456]'
select id as h1, edit_token as t1 from create_shared_hand('{"version":1}'::jsonb) \gset
select id as h2, edit_token as t2 from create_shared_hand('{"version":1}'::jsonb) \gset
-- A zone where it is 15:00 now and one where it is 03:00.
select name as awake from pg_timezone_names where name like 'Etc/GMT%' and extract(hour from now() at time zone name) = 15 limit 1 \gset
select name as asleep from pg_timezone_names where name like 'Etc/GMT%' and extract(hour from now() at time zone name) = 3 limit 1 \gset

select not set_comment_push(:'h1', 'wrong-token', :'tok', 'pt-PT', :'awake') as wrong_owner_refused;
select count(*) = 0 as nothing_stored_for_wrong_owner from comment_push;
select set_comment_push(:'h1', :'t1', :'tok', 'pt-PT', :'awake') as owner_turns_it_on;
select set_comment_push(:'h2', :'t2', :'tok', 'es', :'asleep') as second_hand_on;
select set_comment_push(:'h2', :'t2', :'tok', 'es', 'Mars/Olympus');
select tz = 'UTC' as unknown_zone_is_utc from comment_push where hand_id = :'h2';
select set_comment_push(:'h2', :'t2', :'tok', 'es', :'asleep');

select count(*) = 0 as no_comment_no_notice from take_comment_pushes(null);
select queue_comment_push(:'h1', 'turn');
select message->>'title' = 'Novo comentário na tua mão: turn' as says_only_the_street,
       message->>'body' = 'Toca para abrir a mão nesse comentário.' as body_has_no_details,
       message->'data'->>'url' = 'sweatbook://shared-hands?open=' || :'h1' as opens_the_hand,
       message->>'to' = :'tok' as to_the_owner
  from take_comment_pushes(:'h1');
select queue_comment_push(:'h1', 'river');
select count(*) = 0 as one_notice_until_opened from take_comment_pushes(null);
select seen_comment_push(:'h1', :'t1') as opened;
select count(*) = 0 as opening_clears_what_was_waiting from take_comment_pushes(null);
select queue_comment_push(:'h1', null);
select message->>'title' = 'Novo comentário na tua mão' as whole_hand_comment from take_comment_pushes(null);

select queue_comment_push(:'h2', 'preflop');
select count(*) = 0 as held_in_quiet_hours from take_comment_pushes(null);
select due as still_waiting from comment_push where hand_id = :'h2';
update comment_push set tz = :'awake' where hand_id = :'h2';
select message->>'title' = 'Nuevo comentario en tu mano: preflop' as sent_after_quiet_hours from take_comment_pushes(null);
select flush_comment_pushes() = 0 as flush_without_pg_net_sends_nothing;

update comment_push set updated_at = now() - interval '181 days' where hand_id = :'h2';
select purge_comment_push() = 1 as unused_for_180_days_purged;
select count(*) = 1 as recent_token_stays from comment_push where hand_id = :'h1';
select set_comment_push(:'h2', :'t2', :'tok', 'es', :'awake');
select set_comment_push(:'h2', :'t2', null) as owner_turns_it_off;
select count(*) = 0 as token_deleted from comment_push where hand_id = :'h2';
select delete_shared_hand(:'h1', :'t1');
select count(*) = 0 as token_goes_with_the_hand from comment_push;
reset role;

\set ON_ERROR_STOP off
set role service_role;
-- Not a push token (prints an ERROR).
select set_comment_push(:'h2', :'t2', 'https://evil.example/hook');
reset role;
set role anon;
-- No access for the public keys (each prints an ERROR).
select * from comment_push;
select take_comment_pushes(null);
select set_comment_push(:'h2', :'t2', :'tok');
reset role;
