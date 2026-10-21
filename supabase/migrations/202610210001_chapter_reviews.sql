-- Chapter-level ratings and reviews. Reviews are readable only when the
-- referenced chapter is published in a published public/unlisted work, while
-- authors may still manage their own review row through the RLS policies.
create table public.chapter_reviews (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null,
  chapter_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (work_id, chapter_id) references public.chapters(work_id, id) on delete cascade,
  unique (chapter_id, user_id)
);

create index chapter_reviews_chapter_created
  on public.chapter_reviews (chapter_id, created_at desc);

create function public.can_read_published_chapter(p_work_id uuid, p_chapter_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.chapters c
    join public.works w on w.id = c.work_id
    where c.work_id = p_work_id
      and c.id = p_chapter_id
      and c.state = 'published'
      and w.state = 'published'
      and w.visibility in ('public', 'unlisted')
  )
$$;

revoke all on function public.can_read_published_chapter(uuid, uuid) from public;
grant execute on function public.can_read_published_chapter(uuid, uuid) to anon, authenticated;

create function public.lock_chapter_review_identity()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id
    or new.work_id <> old.work_id
    or new.chapter_id <> old.chapter_id
    or new.user_id <> old.user_id then
    raise exception 'review identity cannot change';
  end if;
  return new;
end;
$$;

create trigger chapter_reviews_identity_guard
before update on public.chapter_reviews
for each row execute procedure public.lock_chapter_review_identity();

create trigger chapter_reviews_touch_updated_at
before update on public.chapter_reviews
for each row execute procedure public.touch_updated_at();

revoke all on function public.lock_chapter_review_identity() from public, anon, authenticated;

alter table public.chapter_reviews enable row level security;

create policy "Readable chapter reviews are visible"
on public.chapter_reviews for select to anon, authenticated
using (
  public.can_read_published_chapter(work_id, chapter_id)
  or (select auth.uid()) = user_id
);

create policy "Readers create one review per chapter"
on public.chapter_reviews for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and public.can_read_published_chapter(work_id, chapter_id)
);

create policy "Readers update their own review"
on public.chapter_reviews for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Readers delete their own review"
on public.chapter_reviews for delete to authenticated
using ((select auth.uid()) = user_id);

grant select on public.chapter_reviews to anon, authenticated;
grant insert, update, delete on public.chapter_reviews to authenticated;
revoke all on public.chapter_reviews from public;
