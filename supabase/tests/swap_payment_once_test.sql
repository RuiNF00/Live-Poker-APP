-- The same money marked by both players (a "payment" by the payer and a "received" by whoever got
-- it) counts once: the second is refused with what was still owed. Run as service_role.
\set ON_ERROR_STOP on
set role service_role;

\set kb 'abababababababababababababababababababababababababababababababab'
select id as sid, token as ta from create_swap('{"v":1,"title":"Main","a":{"name":"Ana","pct":10},"b":{"name":"Bruno","pct":7.5}}'::jsonb) \gset
select confirm_swap(:'sid', 'Bruno', :'kb') = :'kb' as confirmed;
-- Bruno (b, 7,5%) wins 1234,50 twice: owes Ana 92,59 + 92,59 = 185,18 (each share to the cent).
select add_swap_entry_checked(:'sid', :'kb', '{"cid":"r1","kind":"result","amount":1234.5,"event":"","finish":null}') = '{"ok":true}' as prize_one;
select add_swap_entry_checked(:'sid', :'kb', '{"cid":"r2","kind":"result","amount":1234.5,"event":"","finish":null}') = '{"ok":true}' as prize_two;
select add_swap_entry_checked(:'sid', :'kb', '{"cid":"p1","kind":"payment","amount":185.18,"event":"","finish":null}') = '{"ok":true}' as bruno_pays_all;
select add_swap_entry_checked(:'sid', :'ta', '{"cid":"x1","kind":"received","amount":185.18,"event":"","finish":null}') = '{"left":0}' as anas_received_refused;
select add_swap_entry_checked(:'sid', :'kb', '{"cid":"p1","kind":"payment","amount":185.18,"event":"","finish":null}') = '{"ok":true}' as same_cid_again_ok;
select jsonb_array_length(entries) = 3 as counted_once from swaps where id = :'sid';
-- Ana wins 500 (owes Bruno 50): she pays 30, then Bruno marks 50 received: only 20 was left.
select add_swap_entry_checked(:'sid', :'ta', '{"cid":"r3","kind":"result","amount":500,"event":"","finish":null}') = '{"ok":true}' as ana_prize;
select add_swap_entry_checked(:'sid', :'ta', '{"cid":"p2","kind":"payment","amount":30,"event":"","finish":null}') = '{"ok":true}' as ana_pays_part;
select add_swap_entry_checked(:'sid', :'kb', '{"cid":"x2","kind":"received","amount":50,"event":"","finish":null}') = '{"left":20}' as bruno_received_too_much;
select add_swap_entry_checked(:'sid', :'kb', '{"cid":"x3","kind":"received","amount":20,"event":"","finish":null}') = '{"ok":true}' as bruno_received_the_rest;
select add_swap_entry_checked(:'sid', :'ta', '{"cid":"p3","kind":"payment","amount":0.01,"event":"","finish":null}') = '{"ok":true}' as a_cent_of_slack;
select add_swap_entry_checked(:'sid', 'nope', '{"cid":"p4","kind":"payment","amount":1,"event":"","finish":null}') = '{"ok":false}' as strangers_refused;
reset role;

\set ON_ERROR_STOP off
select add_swap_entry_checked('x', 'y', '{}'::jsonb);
