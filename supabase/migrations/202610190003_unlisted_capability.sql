-- Do not let an anon/authenticated table scan enumerate every unlisted work.
-- The work UUID is the existing high-entropy share capability. Unlisted
-- content is served only by narrow functions that require that exact UUID.
drop policy if exists "Published public works and owners can read works" on public.works;
create policy "Published public works and owners can read works" on public.works
for select using ((visibility = 'public' and state = 'published') or auth.uid() = author_id);

drop policy if exists "Published chapters of readable works" on public.chapters;
create policy "Published chapters of readable works" on public.chapters
for select using (
  (state = 'published' and exists (
    select 1 from public.works w where w.id = work_id
      and w.visibility = 'public' and w.state = 'published'
  ))
  or exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid())
);

create or replace function public.read_unlisted_work(p_work_id uuid)
returns table (id uuid, title text, summary text, visibility public.work_visibility, state public.publication_state, author_id uuid)
language sql stable security definer set search_path = '' as $$
  select w.id, w.title, w.summary, w.visibility, w.state, w.author_id
  from public.works as w
  where w.id = p_work_id and w.visibility = 'unlisted' and w.state = 'published'
$$;

create or replace function public.read_unlisted_chapters(p_work_id uuid)
returns table (id uuid, title text, "position" integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.title, c.position
  from public.chapters as c
  join public.works as w on w.id = c.work_id
  where w.id = p_work_id and w.visibility = 'unlisted' and w.state = 'published'
    and c.state = 'published'
  order by c.position
$$;

create or replace function public.read_unlisted_chapter(p_work_id uuid, p_chapter_id uuid)
returns table (id uuid, title text, body text, "position" integer, work_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.id, c.title, c.body, c.position, c.work_id
  from public.chapters as c
  join public.works as w on w.id = c.work_id
  where w.id = p_work_id and c.id = p_chapter_id
    and w.visibility = 'unlisted' and w.state = 'published'
    and c.state = 'published'
$$;

revoke all on function public.read_unlisted_work(uuid) from public, anon, authenticated;
revoke all on function public.read_unlisted_chapters(uuid) from public, anon, authenticated;
revoke all on function public.read_unlisted_chapter(uuid, uuid) from public, anon, authenticated;
grant execute on function public.read_unlisted_work(uuid) to anon, authenticated;
grant execute on function public.read_unlisted_chapters(uuid) to anon, authenticated;
grant execute on function public.read_unlisted_chapter(uuid, uuid) to anon, authenticated;
