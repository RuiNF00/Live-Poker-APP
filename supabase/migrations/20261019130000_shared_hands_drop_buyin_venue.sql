-- 1st update (draft, Replayer + Bankroll; the number is a proposal, Main confirms the order).
-- Shared hands and coach links stored before #330 8f0da7cd may still carry the tournament
-- buy-in and the venue in payload.game. The site stopped serving them in #330 (loadShare and
-- the coach page drop them on read); this takes them out of the stored rows, so they are gone
-- from the database too. Only the app's format has a game object (the HandRecord format's
-- game is a string), so other rows are left alone. Idempotent: a second run changes nothing.

update public.shared_hands
set payload = jsonb_set(payload, '{game}', (payload->'game') - 'buyIn' - 'venue')
where jsonb_typeof(payload->'game') = 'object'
  and ((payload->'game') ? 'buyIn' or (payload->'game') ? 'venue');

update public.coach_hands
set payload = jsonb_set(payload, '{game}', (payload->'game') - 'buyIn' - 'venue')
where jsonb_typeof(payload->'game') = 'object'
  and ((payload->'game') ? 'buyIn' or (payload->'game') ? 'venue');
