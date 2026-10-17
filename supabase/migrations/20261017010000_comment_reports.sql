-- Report abusive comments (App Store guideline 1.2). A comment is hidden once
-- three different people report it; the hand owner can also hide it directly.

create table public.hand_comment_reports (
  comment_id uuid not null references public.hand_comments (id) on delete cascade,
  reporter_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, reporter_id)
);

alter table public.hand_comment_reports enable row level security;
revoke all on public.hand_comment_reports from anon, authenticated;

create or replace function public.report_hand_comment(p_comment_id uuid, p_reporter_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into public.hand_comment_reports (comment_id, reporter_id)
  values (p_comment_id, p_reporter_id)
  on conflict do nothing;
  if (select count(*) from public.hand_comment_reports r where r.comment_id = p_comment_id) >= 3 then
    update public.hand_comments set hidden = true where id = p_comment_id;
  end if;
  return exists (select 1 from public.hand_comments c where c.id = p_comment_id);
end $$;

revoke all on function public.report_hand_comment(uuid, uuid) from public;
grant execute on function public.report_hand_comment(uuid, uuid) to anon, authenticated;
