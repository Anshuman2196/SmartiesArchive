-- Private work media: owners upload; only a work owner or a reader who can
-- access a published chapter can mint a signed read URL through Storage RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-media', 'story-media', false, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_story_media(p_object_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select p_object_name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}[.](png|jpe?g|webp|gif)$'
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

create policy "Story media readable when referenced by accessible content"
on storage.objects for select to anon, authenticated
using (bucket_id = 'story-media' and public.can_read_story_media(name));

create policy "Owners upload media into their work folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'story-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.works w where w.id::text = (storage.foldername(name))[2] and w.author_id = auth.uid())
);

create policy "Owners delete their work media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'story-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.works w where w.id::text = (storage.foldername(name))[2] and w.author_id = auth.uid())
);
