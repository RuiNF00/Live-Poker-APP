-- Push-to-end (first update): tokens are scoped to the backup id and key hash, taken once.
\set ON_ERROR_STOP on
set role service_role;
select put_live_end('0123456789', repeat('a',64), repeat('b',32), repeat('c',64)) as live_end_put;
select put_live_end('0123456789', repeat('a',64), repeat('b',32), repeat('d',64)) as live_end_put_second_phone;
select count(*) = 0 as live_end_other_key_gets_nothing from take_live_end('0123456789', repeat('e',64), repeat('b',32));
select count(*) = 2 as live_end_take_all from take_live_end('0123456789', repeat('a',64), repeat('b',32));
select count(*) = 0 as live_end_taken_once from take_live_end('0123456789', repeat('a',64), repeat('b',32));
reset role;
\set ON_ERROR_STOP off
set role anon;
select * from live_end;
reset role;
