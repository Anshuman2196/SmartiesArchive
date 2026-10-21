-- Private-project admin access. Membership is managed directly in the
-- Supabase SQL editor; there is intentionally no role-management UI yet.
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on public.admin_users from public, anon;
grant select on public.admin_users to authenticated;

create policy "Users can read their own admin membership" on public.admin_users
for select to authenticated
using ((select auth.uid()) = user_id);

create function public.is_admin()
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  )
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Admins can inspect moderation data, but direct table writes remain owner-only.
create policy "Admins can read all works" on public.works
for select to authenticated
using ((select public.is_admin()));

create policy "Admins can read all chapters" on public.chapters
for select to authenticated
using ((select public.is_admin()));

create policy "Admins can read all work drafts" on public.work_drafts
for select to authenticated
using ((select public.is_admin()));

create policy "Admins can read all chapter drafts" on public.chapter_drafts
for select to authenticated
using ((select public.is_admin()));

-- These are deliberately narrow moderation operations. They only change
-- publication state and cannot edit content, ownership, or metadata.
create function public.admin_unpublish_work(p_work_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  update public.works
  set state = 'draft', updated_at = pg_catalog.now()
  where id = p_work_id and state = 'published';

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create function public.admin_unpublish_chapter(p_work_id uuid, p_chapter_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  update public.chapters
  set state = 'draft', updated_at = pg_catalog.now()
  where work_id = p_work_id and id = p_chapter_id and state = 'published';

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.admin_unpublish_work(uuid) from public, anon;
revoke all on function public.admin_unpublish_chapter(uuid, uuid) from public, anon;
grant execute on function public.admin_unpublish_work(uuid) to authenticated;
grant execute on function public.admin_unpublish_chapter(uuid, uuid) to authenticated;
