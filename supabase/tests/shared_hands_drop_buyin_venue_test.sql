-- The buy-in and venue go from hands stored before #330; everything else stays.
\set ON_ERROR_STOP on

insert into shared_hands (id, payload, title, edit_token_hash) values
  ('pg_old', '{"v":1,"game":{"kind":"mtt","name":"Main","buyIn":1100,"venue":"Casino X","sb":100,"bb":200},"players":[{"name":"Hero"}]}', 'Antiga', 'pg_h1'),
  ('pg_new', '{"v":1,"game":{"kind":"cash","name":"1/2","sb":1,"bb":2},"board":["Ah"]}', 'Nova', 'pg_h2'),
  ('pg_odd', '{"v":1,"game":"texto","buyIn":5}', null, 'pg_h3');
insert into shared_hands (id, payload, title, edit_token_hash, deleted_at) values
  ('pg_del', '{"v":1,"game":{"venue":"Casino Y"}}', null, 'pg_h4', now());

select token as pg_t from create_coach_link('Coach', 'Rui', null,
  '[{"id":"c1","payload":{"v":1,"game":{"buyIn":250,"venue":"Casino Z","bb":50}}}]'::jsonb) \gset
-- What an old server stored, before it dropped them.
update coach_hands set payload = '{"v":1,"game":{"buyIn":250,"venue":"Casino Z","bb":50}}' where hand_id = 'c1';
select payload::text as pg_new_before from shared_hands where id = 'pg_new' \gset

\ir ../migrations/20261019130000_shared_hands_drop_buyin_venue.sql

select payload->'game' = '{"kind":"mtt","name":"Main","sb":100,"bb":200}'::jsonb as old_hand_loses_buyin_and_venue from shared_hands where id = 'pg_old';
select payload->'players' = '[{"name":"Hero"}]'::jsonb and title = 'Antiga' as rest_of_old_hand_kept from shared_hands where id = 'pg_old';
select payload::text = :'pg_new_before' as hand_without_them_untouched from shared_hands where id = 'pg_new';
select payload = '{"v":1,"game":"texto","buyIn":5}'::jsonb as payload_without_game_object_untouched from shared_hands where id = 'pg_odd';
select payload->'game' = '{}'::jsonb and deleted_at is not null as deleted_share_cleaned_too from shared_hands where id = 'pg_del';
select payload->'game' = '{"bb":50}'::jsonb as coach_hand_cleaned from coach_hands where hand_id = 'c1';
select count(*) = 0 as none_left_anywhere from (
  select payload from shared_hands union all select payload from coach_hands
) x where jsonb_typeof(payload->'game') = 'object' and (payload->'game' ? 'buyIn' or payload->'game' ? 'venue');

-- Running it again changes nothing.
\ir ../migrations/20261019130000_shared_hands_drop_buyin_venue.sql
select payload->'game' = '{"kind":"mtt","name":"Main","sb":100,"bb":200}'::jsonb as second_run_is_a_no_op from shared_hands where id = 'pg_old';
