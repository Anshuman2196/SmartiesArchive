-- PDF manga chapters use the same private story-media bucket and signed URL flow.
alter table public.chapters drop constraint if exists chapters_format_check;
alter table public.chapters add constraint chapters_format_check
  check (format in ('prose', 'image', 'comic', 'chat', 'mixed', 'pdf'));

alter table public.chapter_drafts drop constraint if exists chapter_drafts_format_check;
alter table public.chapter_drafts add constraint chapter_drafts_format_check
  check (format in ('prose', 'image', 'comic', 'chat', 'mixed', 'pdf'));

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
where id = 'story-media';

create or replace function public.can_read_story_media(p_object_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select p_object_name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}[.](png|jpe?g|webp|gif|pdf)$'
    and exists (
      select 1 from public.works w
      where w.author_id::text = split_part(p_object_name, '/', 1)
        and w.id::text = split_part(p_object_name, '/', 2)
        and (
          w.author_id = auth.uid()
          or
          (w.cover_url = 'storage://story-media/' || p_object_name and (w.author_id = auth.uid() or (w.state = 'published' and w.visibility in ('public','unlisted'))))
          or exists (
            select 1 from public.work_drafts wd where wd.work_id = w.id
              and wd.cover_url = 'storage://story-media/' || p_object_name and w.author_id = auth.uid()
          )
          or exists (
            select 1 from public.chapters c where c.work_id = w.id
              and position('storage://story-media/' || p_object_name in c.content::text) > 0
              and (w.author_id = auth.uid() or (c.state = 'published' and w.state = 'published' and w.visibility in ('public','unlisted')))
          )
          or exists (
            select 1 from public.chapter_drafts d where d.work_id = w.id
              and position('storage://story-media/' || p_object_name in d.content::text) > 0
              and w.author_id = auth.uid()
          )
        )
    )
$$;

revoke all on function public.can_read_story_media(text) from public;
grant execute on function public.can_read_story_media(text) to anon, authenticated;
