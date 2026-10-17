-- Security follow-up to 310000: a push token nobody used for 180 days goes. The app sends it
-- again (set_comment_push, an upsert) whenever "Mãos partilhadas" opens, so updated_at tracks use.
create or replace function public.purge_comment_push() returns integer
language sql security definer set search_path = public as $$
  with gone as (delete from comment_push where updated_at < now() - interval '180 days' returning 1)
  select count(*)::integer from gone;
$$;

revoke all on function public.purge_comment_push() from public, anon, authenticated;
grant execute on function public.purge_comment_push() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-comment-push';
    perform cron.schedule('purge-comment-push', '47 3 * * *', 'select public.purge_comment_push()');
  end if;
end $$;
