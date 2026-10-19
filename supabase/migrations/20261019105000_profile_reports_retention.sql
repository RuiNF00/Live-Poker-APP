-- Profile reports keep the reporter's daily IP hash (reporter_id) no longer than the privacy
-- policy says: 30 days, as hand and comment reports already do (20261017090000). Three reports
-- within 30 days still hide a profile; older ones stop counting.
create or replace function public.purge_moderation() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from shared_hands where deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  delete from hand_comments where hidden and hidden_at < now() - interval '30 days';
  delete from hand_reports where created_at < now() - interval '30 days';
  delete from hand_comment_reports where created_at < now() - interval '30 days';
  delete from profile_reports where created_at < now() - interval '30 days';
  update hand_votes set ip_hash = null where ip_hash is not null and created_at < now() - interval '2 days';
  delete from rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;

revoke execute on function public.purge_moderation() from public, anon, authenticated;

create index if not exists profile_reports_created_at on public.profile_reports (created_at);
