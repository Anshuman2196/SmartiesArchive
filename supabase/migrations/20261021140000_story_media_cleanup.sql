-- Owners can remove their own story-media objects after a work is deleted.
-- The object path starts with auth.uid(), so this does not widen deletion to
-- another member's media; it allows cleanup of folders whose work row is gone.
drop policy if exists "Owners delete their work media" on storage.objects;
create policy "Owners delete their work media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'story-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
