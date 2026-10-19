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
