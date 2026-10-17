-- Reports (App Store guideline 1.2). A comment is hidden once three different
-- people report it; a shared hand is taken down after five. The hand owner can
-- also hide comments or delete the share directly.

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

create table public.hand_reports (
  hand_id text not null references public.shared_hands (id) on delete cascade,
  reporter_id uuid not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (hand_id, reporter_id)
);

alter table public.hand_reports enable row level security;
revoke all on public.hand_reports from anon, authenticated;

create or replace function public.report_shared_hand(p_hand_id text, p_reporter_id uuid, p_reason text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.shared_hands h where h.id = p_hand_id and h.deleted_at is null) then
    return false;
  end if;
  insert into public.hand_reports (hand_id, reporter_id, reason)
  values (p_hand_id, p_reporter_id, left(p_reason, 200))
  on conflict do nothing;
  if (select count(*) from public.hand_reports r where r.hand_id = p_hand_id) >= 5 then
    update public.shared_hands set deleted_at = now() where id = p_hand_id;
  end if;
  return true;
end $$;

revoke all on function public.report_shared_hand(text, uuid, text) from public;
grant execute on function public.report_shared_hand(text, uuid, text) to anon, authenticated;
