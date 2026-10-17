\set ON_ERROR_STOP on
set role service_role;
\set h1 '''aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'''
\set h2 '''bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'''
select put_app_backup('0123456789', :h1, encode('{"hands":[]}'::bytea, 'base64'), 'application/json') as created;
select put_app_backup('0123456789', :h2, encode('{"evil":1}'::bytea, 'base64'), 'application/json') = false as other_secret_rejected;
select put_app_backup('0123456789', :h1, encode('{"hands":[1]}'::bytea, 'base64'), 'application/json') as updated;
select convert_from(decode(data_b64, 'base64'), 'utf8') = '{"hands":[1]}' as read_back from get_app_backup('0123456789', :h1);
select count(*) = 0 as wrong_secret_reads_nothing from get_app_backup('0123456789', :h2);
select delete_app_backup('0123456789', :h2) = false as wrong_secret_cannot_delete;
reset role;
insert into app_backups (id, key_hash, data, content_type, bytes, updated_at) values ('ZZZZZZZZZZ', :h1, 'x', 'application/json', 1, now() - interval '19 months');
set role service_role;
select purge_old_app_backups() = 1 as stale_backup_purged;
select delete_app_backup('0123456789', :h1) as deleted;
\set ON_ERROR_STOP off
select put_app_backup('ILOU000000', :h1, 'eA==', 'application/json');
-- Over 2 MB is refused (20261017090000)
select put_app_backup('0123456789', :h1, encode(convert_to(repeat('a', 2200000), 'utf8'), 'base64'), 'application/json');
set role anon;
select * from app_backups;
select get_app_backup('0123456789', :h1);
reset role;
