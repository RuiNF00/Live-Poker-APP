-- Swaps between players. Run as service_role, like the web server.
\set ON_ERROR_STOP on
set role service_role;

select id as swap_id, token as token_a from create_swap('{"v":1,"title":"WSOP Paradise","a":{"name":"Rui","pct":5},"b":{"name":"João","pct":5}}'::jsonb) \gset
select confirmed_at is null and jsonb_array_length(entries) = 0 as swap_pending from get_swap(:'swap_id');
select swap_side(:'swap_id', :'token_a') = 'a' as side_a_known;
select swap_side(:'swap_id', 'wrong') is null as wrong_token_no_side;
select swap_side(:'swap_id', '') is null as empty_token_no_side;
-- Nothing can be added before the other player confirms.
select add_swap_entry(:'swap_id', :'token_a', '{"kind":"result","prize":1000,"cid":"c1"}'::jsonb) = false as no_entries_before_confirm;

select confirm_swap(:'swap_id', 'João Silva') as token_b \gset
select :'token_b' <> '' as confirmed;
select confirm_swap(:'swap_id', 'Intruso') is null as confirms_only_once;
select confirmed_name = 'João Silva' and confirmed_at is not null as confirmation_fixed from get_swap(:'swap_id');
select swap_side(:'swap_id', :'token_b') = 'b' as side_b_known;

-- Each side adds its own; the side comes from the token, not from the entry.
select add_swap_entry(:'swap_id', :'token_a', '{"kind":"result","prize":1000,"cid":"c1","side":"b"}'::jsonb) as a_added;
select add_swap_entry(:'swap_id', :'token_a', '{"kind":"result","prize":1000,"cid":"c1"}'::jsonb) as retry_ok;
select add_swap_entry(:'swap_id', :'token_b', '{"kind":"payment","amount":50,"cid":"c1"}'::jsonb) as b_added;
select jsonb_array_length(entries) = 2 as retry_not_duplicated from get_swap(:'swap_id');
select entries->0->>'side' = 'a' and entries->1->>'side' = 'b' as sides_from_tokens from get_swap(:'swap_id');
select add_swap_entry(:'swap_id', 'wrong', '{"kind":"result","prize":5}'::jsonb) = false as wrong_token_cannot_add;

-- Nobody removes the other side's entries.
select entries->0->>'id' as a_entry from get_swap(:'swap_id') \gset
select remove_swap_entry(:'swap_id', :'token_b', :'a_entry') = false as b_cannot_remove_a;
select jsonb_array_length(entries) = 2 as still_two from get_swap(:'swap_id');
select remove_swap_entry(:'swap_id', :'token_a', :'a_entry') as a_removed_own;
select jsonb_array_length(entries) = 1 and entries->0->>'side' = 'b' as only_b_left from get_swap(:'swap_id');

\set ON_ERROR_STOP off
-- Wrong version is refused; the token hashes never come back.
select create_swap('{"v":2}'::jsonb);
select token_a_hash from get_swap(:'swap_id');
\set ON_ERROR_STOP on

-- Unconfirmed for 31 days: purged. Confirmed ones stay.
select id as old_swap from create_swap('{"v":1}'::jsonb) \gset
update swaps set created_at = now() - interval '31 days' where id = :'old_swap';
select purge_swaps() = 1 as stale_swap_purged;
select count(*) = 1 as confirmed_swap_kept from swaps where id = :'swap_id';

select delete_swap(:'swap_id', 'wrong') = false as delete_needs_token;
select delete_swap(:'swap_id', :'token_b') as b_can_delete;
select count(*) = 0 as swap_gone from swaps where id = :'swap_id';

reset role;
