-- Swaps QA P3 (19 Oct): a backer's page (20261017380000) was "the last write wins", so a second
-- phone opening with old data, before the cloud joined both copies, sealed the old numbers over
-- the new ones until the other phone opened again. The app now sends a version with each page
-- (the newest change it knows for that backer: sessions, pieces, payments, deletes, in ms) and a
-- page older than the one stored is refused. Without a version (an app from before this) the
-- page is taken as before and the stored version stays.

alter table public.backer_pages add column version bigint check (version is null or version >= 0);

-- 'ok'; 'stale' when a newer version is already stored (nothing changes); null when the link is
-- gone or the token is wrong. The same version again is taken: a resend after a lost answer.
create or replace function public.update_backer_page(p_id text, p_edit_token text, p_sealed jsonb, p_version bigint)
returns text language plpgsql security definer set search_path = public as $$
declare cur bigint;
begin
  select p.version into cur from public.backer_pages p
   where p.id = p_id
     and p.edit_token_hash = encode(sha256(convert_to(coalesce(p_edit_token, ''), 'utf8')), 'hex')
     for update;
  if not found then return null; end if;
  if p_version is not null and cur is not null and p_version < cur then return 'stale'; end if;
  update public.backer_pages p
     set sealed = p_sealed, updated_at = now(), version = coalesce(p_version, p.version)
   where p.id = p_id;
  return 'ok';
end $$;

revoke execute on function public.update_backer_page(text, text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.update_backer_page(text, text, jsonb, bigint) to service_role;
