#!/usr/bin/env bash
# The same entry sent twice at the same moment (a retry while the first is still in flight) is
# saved once, for a pair swap and for a group. Two sessions run add_*_entry at once; the first
# holds its transaction open so the second has to wait for it. Prints t when it holds.
set -euo pipefail
DB=${DB:-sharetest}
q() { psql -q -At -d "$DB" -c "set role service_role; $1"; }
IFS='|' read -r sid ta < <(q "select id, token from create_swap('{\"v\":1,\"title\":\"Main\",\"a\":{\"name\":\"Rui\",\"pct\":5},\"b\":{\"name\":\"Ana\",\"pct\":5}}'::jsonb)")
q "select confirm_swap('$sid', 'Ana')" >/dev/null
e='{"kind":"result","amount":1000,"cid":"same","event":"","finish":null}'
psql -q -At -d "$DB" -c "set role service_role; begin; select add_swap_entry('$sid', '$ta', '$e'::jsonb); select pg_sleep(1); commit;" >/dev/null &
sleep 0.3
q "select add_swap_entry('$sid', '$ta', '$e'::jsonb)" >/dev/null
wait
echo "pair_same_cid_saved_once: $(q "select jsonb_array_length(entries) = 1 from swaps where id = '$sid'")"

IFS='|' read -r gid gt invite < <(q "select id, token, invite from create_swap_group('{\"v\":1,\"title\":\"G\",\"pct\":2}'::jsonb, array['Rui','Ana','Eva'])")
q "select claim_swap_group_seat('$gid', '$invite', 1)" >/dev/null
q "select claim_swap_group_seat('$gid', '$invite', 2)" >/dev/null
psql -q -At -d "$DB" -c "set role service_role; begin; select add_swap_group_entry('$gid', '$gt', '$e'::jsonb); select pg_sleep(1); commit;" >/dev/null &
sleep 0.3
q "select add_swap_group_entry('$gid', '$gt', '$e'::jsonb)" >/dev/null
wait
echo "group_same_cid_saved_once: $(q "select jsonb_array_length(entries) = 1 from swap_groups where id = '$gid'")"

# Copies saved twice before the lock: the cleanup keeps the first of each, and the other side's same cid.
q "update swaps set entries = entries || jsonb_build_array(entries->0 || '{\"id\":\"dup\"}'::jsonb, jsonb_set(entries->0, '{side}', '\"b\"')) where id = '$sid'" >/dev/null
q "update swap_groups set entries = entries || jsonb_build_array(entries->0 || '{\"id\":\"dup\"}'::jsonb) where id = '$gid'" >/dev/null
echo "dedupe_touched_two_rows: $(q "select swap_dedupe_entries() = 2")"
echo "pair_keeps_first_and_other_side: $(q "select jsonb_array_length(entries) = 2 and entries->0->>'id' <> 'dup' and entries->1->>'side' = 'b' from swaps where id = '$sid'")"
echo "group_keeps_first: $(q "select jsonb_array_length(entries) = 1 and entries->0->>'id' <> 'dup' from swap_groups where id = '$gid'")"
echo "dedupe_again_changes_nothing: $(q "select swap_dedupe_entries() = 0")"
