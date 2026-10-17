-- Private coaching links. Run as service_role, like the web server.
\set ON_ERROR_STOP on
set role service_role;

select token, owner_token from create_coach_link('Rever com coach', 'Rui', null,
  '[{"id":"h1","payload":{"v":1,"id":"h1"}},{"id":"h2","payload":{"v":1,"id":"h2"}}]'::jsonb) \gset
select length(:'token') = 32 and length(:'owner_token') = 64 as tokens_issued;
select count(*) = 0 as token_not_stored_in_clear from coach_links where token_hash = :'token' or owner_token_hash = :'owner_token';

select (open_coach_link(:'token')->>'player') = 'Rui' as coach_opens_link;
select jsonb_array_length(open_coach_link(:'token')->'hands') = 2 as hands_in_order_served;
select (open_coach_link(:'token')->'hands'->0->>'id') = 'h1' as first_hand_first;
select open_coach_link('nope') is null as wrong_token_gets_nothing;
select view_count = 3 as visits_counted from coach_links;

select (add_coach_comment(:'token', 'h1', 4, 'mistake', 'Coach Ana', 'Fold aqui.')->>'author') = 'coach' as coach_comment_added;
select add_coach_comment(:'token', 'zz', 4, null, 'Coach Ana', 'x') is null as unknown_hand_refused;
select add_coach_comment('nope', 'h1', 4, null, 'Coach Ana', 'x') is null as wrong_link_refused;
\set ON_ERROR_STOP off
select add_coach_comment(:'token', 'h1', 4, 'great', 'Coach Ana', 'x');
\set ON_ERROR_STOP on
select count(*) = 1 as bad_mark_rejected from coach_comments;

select count(*) = 1 as player_reads_comments from coach_comments_since(:'token', :'owner_token', null);
select count(*) = 0 as wrong_owner_reads_nothing from coach_comments_since(:'token', 'nope', null);
select count(*) = 0 as since_filters from coach_comments_since(:'token', :'owner_token', now() + interval '1 minute');
select (add_player_reply(:'token', :'owner_token', 'h1', 4, 'Rui', 'Porquê?')->>'author') = 'player' as player_reply_added;
select add_player_reply(:'token', 'nope', 'h1', 4, 'Rui', 'x') is null as reply_needs_owner;
select jsonb_array_length(open_coach_link(:'token')->'comments') = 2 as coach_sees_reply;

-- Revoked: the coach is out at once, the player keeps the comments.
select revoke_coach_link(:'token', 'nope') = false as revoke_needs_owner;
select revoke_coach_link(:'token', :'owner_token') as revoked;
select open_coach_link(:'token') is null as revoked_link_closed;
select add_coach_comment(:'token', 'h1', 1, null, 'Coach Ana', 'x') is null as revoked_link_takes_no_comments;
select count(*) = 2 as player_still_reads_after_revoke from coach_comments_since(:'token', :'owner_token', null);

-- Expired links close too.
select token as t2, owner_token as o2 from create_coach_link('', '', now() - interval '1 second', '[{"id":"x","payload":{}}]'::jsonb) \gset
select open_coach_link(:'t2') is null as expired_link_closed;
\set ON_ERROR_STOP off
select create_coach_link('', '', null, '[]'::jsonb);
\set ON_ERROR_STOP on

-- 30 days after revoking: gone, with its hands and comments.
update coach_links set revoked_at = now() - interval '31 days' where token_hash = encode(sha256(convert_to(:'token', 'utf8')), 'hex');
select purge_coach_links() = 1 as revoked_link_purged;
select count(*) = 0 as comments_purged from coach_comments;
select count(*) = 1 as other_link_kept from coach_links;

-- Erased from the phone: gone at once, only with the owner token.
select token as t3, owner_token as o3 from create_coach_link('', '', null, '[{"id":"y","payload":{}}]'::jsonb) \gset
select add_coach_comment(:'t3', 'y', null, null, 'Ana', 'ok') is not null as comment_on_third;
select delete_coach_link(:'t3', 'nope') = false as delete_needs_owner;
select delete_coach_link(:'t3', :'o3') as deleted;
select count(*) = 1 as deleted_link_gone from coach_links;
select count(*) = 0 as deleted_link_comments_gone from coach_comments;

reset role;
set role anon;
\set ON_ERROR_STOP off
select open_coach_link('x');
select * from coach_links;
