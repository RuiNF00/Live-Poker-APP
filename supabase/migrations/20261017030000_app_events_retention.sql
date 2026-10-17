-- Retention for usage events: the privacy policy promises at most 12 months.
-- purge_old_app_events() deletes older rows. It runs daily through pg_cron when the
-- extension is available (Supabase: Database > Extensions), and the /api/events handler
-- also calls it now and then, so retention holds either way. Safe to run more than once.

create or replace function public.purge_old_app_events() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.app_events where created_at < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.purge_old_app_events() from public;
grant execute on function public.purge_old_app_events() to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-old-app-events';
    perform cron.schedule('purge-old-app-events', '17 3 * * *', 'select public.purge_old_app_events()');
  else
    raise notice 'pg_cron not available: app_events retention relies on /api/events calling purge_old_app_events()';
  end if;
end $$;
