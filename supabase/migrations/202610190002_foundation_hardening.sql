-- Make the PostgREST privileges explicit. Row-level security remains the
-- authority for which rows each role can read or mutate.
grant usage on schema public to anon, authenticated;
grant usage on type public.work_visibility, public.publication_state to anon, authenticated;
grant select on public.profiles, public.works, public.chapters to anon;
grant select, insert, update, delete on public.profiles, public.works, public.chapters to authenticated;

-- Trigger functions are only intended to run from their table triggers.
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function public.assign_chapter_position() from public, anon, authenticated;

create index works_author_updated on public.works (author_id, updated_at desc);
create index chapters_work_order on public.chapters (work_id, position);
create unique index profiles_username_case_insensitive on public.profiles (lower(username));

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger works_touch_updated_at before update on public.works
for each row execute procedure public.touch_updated_at();
create trigger chapters_touch_updated_at before update on public.chapters
for each row execute procedure public.touch_updated_at();

revoke all on function public.touch_updated_at() from public, anon, authenticated;
