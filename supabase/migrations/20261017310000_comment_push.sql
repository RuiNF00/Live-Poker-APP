-- "Novo comentário na tua mão": a push to the player who shared the hand (design/notificacoes.md).
--   - The Expo push token is stored only after the player allowed notifications, per shared
--     hand, and goes with the hand (on delete cascade): "Apagar partilha" and "Apagar tudo"
--     delete the link, so they delete the token too.
--   - One notice per hand at a time: after one goes out, nothing more until the player opens
--     the hand (seen_comment_push).
--   - Quiet hours 23:00-12:00 in the player's time zone: the notice waits and goes out after.
--   - The text says only the street: no name, no amounts, no venue, nothing about Pro.
-- Only the web server (service_role) reaches any of it.

create table public.comment_push (
  hand_id text primary key references public.shared_hands (id) on delete cascade,
  push_token text not null check (push_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,128}\]$'),
  lang text not null default 'pt-PT' check (lang in ('pt-PT', 'pt-BR', 'es', 'en')),
  tz text not null default 'UTC' check (char_length(tz) <= 64),
  street text check (street in ('preflop', 'flop', 'turn', 'river')),
  -- A comment came and the player hasn't been told yet.
  due boolean not null default false,
  -- Told and not opened yet: no second notice for this hand.
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index comment_push_due_idx on public.comment_push (due) where due;

alter table public.comment_push enable row level security;
revoke all on public.comment_push from public, anon, authenticated;

-- The owner (edit token) turns notices on for this hand (p_push_token) or off (null).
create or replace function public.set_comment_push(p_hand_id text, p_edit_token text, p_push_token text, p_lang text default 'pt-PT', p_tz text default 'UTC')
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not shared_hand_token_ok(p_hand_id, p_edit_token) then
    return false;
  end if;
  if p_push_token is null then
    delete from comment_push where hand_id = p_hand_id;
    return true;
  end if;
  insert into comment_push (hand_id, push_token, lang, tz)
  values (
    p_hand_id,
    p_push_token,
    case when p_lang in ('pt-PT', 'pt-BR', 'es', 'en') then p_lang else 'en' end,
    case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end
  )
  on conflict (hand_id) do update
    set push_token = excluded.push_token, lang = excluded.lang, tz = excluded.tz, updated_at = now();
  return true;
end $$;

-- The owner opened the hand: the next comment may notify again.
create or replace function public.seen_comment_push(p_hand_id text, p_edit_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not shared_hand_token_ok(p_hand_id, p_edit_token) then
    return false;
  end if;
  update comment_push set due = false, sent_at = null, updated_at = now() where hand_id = p_hand_id;
  return true;
end $$;

-- A comment was posted (the street of the newest one is what the notice names).
create or replace function public.queue_comment_push(p_hand_id text, p_street text) returns void
language sql security definer set search_path = public as $$
  update comment_push
     set due = true,
         street = case when p_street in ('preflop', 'flop', 'turn', 'river') then p_street end,
         updated_at = now()
   where hand_id = p_hand_id;
$$;

create or replace function public.comment_push_message(p_token text, p_lang text, p_street text, p_hand_id text) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'to', p_token,
    'title', case p_lang
              when 'pt-BR' then 'Novo comentário na sua mão'
              when 'es' then 'Nuevo comentario en tu mano'
              when 'en' then 'New comment on your hand'
              else 'Novo comentário na tua mão'
            end
            || case when p_street is null then ''
                    when p_street = 'preflop' then ': ' || case p_lang when 'pt-PT' then 'pré-flop' when 'pt-BR' then 'pré-flop' else 'preflop' end
                    else ': ' || p_street end,
    'body', case p_lang
              when 'pt-BR' then 'Toque para abrir a mão nesse comentário.'
              when 'es' then 'Toca para abrir la mano en ese comentario.'
              when 'en' then 'Tap to open the hand at that comment.'
              else 'Toca para abrir a mão nesse comentário.'
            end,
    'sound', 'default',
    'channelId', 'comments',
    'data', jsonb_build_object('url', 'sweatbook://shared-hands?open=' || p_hand_id)
  );
$$;

-- The notices that may go out now (one hand, or all), marked sent in the same statement so two
-- senders never send one twice. Inside quiet hours they stay due and the next run takes them.
create or replace function public.take_comment_pushes(p_hand_id text default null)
returns table (hand_id text, message jsonb)
language sql security definer set search_path = public as $$
  update comment_push p
     set due = false, sent_at = now(), updated_at = now()
   where p.due and p.sent_at is null
     and (p_hand_id is null or p.hand_id = p_hand_id)
     and extract(hour from now() at time zone p.tz) >= 12
     and extract(hour from now() at time zone p.tz) < 23
  returning p.hand_id, comment_push_message(p.push_token, p.lang, p.street, p.hand_id);
$$;

-- Expo said the token is dead (app deleted, notifications off): forget it.
create or replace function public.drop_comment_push(p_hand_id text) returns void
language sql security definer set search_path = public as $$
  delete from comment_push where hand_id = p_hand_id;
$$;

-- What waited for the end of the quiet hours. The web server sends at once when it can; this
-- picks up the rest every 10 minutes through pg_net (Expo's push API needs no key of ours).
create or replace function public.flush_comment_pushes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return 0;
  end if;
  for r in select * from take_comment_pushes(null) loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := r.message,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.set_comment_push(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.seen_comment_push(text, text) from public, anon, authenticated;
revoke all on function public.queue_comment_push(text, text) from public, anon, authenticated;
revoke all on function public.comment_push_message(text, text, text, text) from public, anon, authenticated;
revoke all on function public.take_comment_pushes(text) from public, anon, authenticated;
revoke all on function public.drop_comment_push(text) from public, anon, authenticated;
revoke all on function public.flush_comment_pushes() from public, anon, authenticated;
grant execute on function public.set_comment_push(text, text, text, text, text) to service_role;
grant execute on function public.seen_comment_push(text, text) to service_role;
grant execute on function public.queue_comment_push(text, text) to service_role;
grant execute on function public.take_comment_pushes(text) to service_role;
grant execute on function public.drop_comment_push(text) to service_role;
grant execute on function public.flush_comment_pushes() to service_role;
grant all on public.comment_push to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'flush-comment-pushes';
    perform cron.schedule('flush-comment-pushes', '*/10 * * * *', 'select public.flush_comment_pushes()');
  end if;
end $$;
