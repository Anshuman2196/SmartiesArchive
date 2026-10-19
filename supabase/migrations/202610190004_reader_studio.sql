-- Reader metadata, typed chapter payloads, private editing drafts, and continuity.
alter table public.works
  add column cover_url text not null default '' check (char_length(cover_url) <= 2048),
  add column tags text[] not null default '{}',
  add column content_warnings text[] not null default '{}';

alter table public.chapters
  add column format text not null default 'prose' check (format in ('prose', 'image', 'comic', 'chat', 'mixed')),
  add column content jsonb not null default '{"type":"prose","text":""}'::jsonb,
  add constraint chapters_work_id_id_unique unique (work_id, id);

update public.chapters set content = jsonb_build_object('type', 'prose', 'text', body);

create table public.work_drafts (
  work_id uuid primary key references public.works(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 2000),
  visibility public.work_visibility not null,
  cover_url text not null default '' check (char_length(cover_url) <= 2048),
  tags text[] not null default '{}',
  content_warnings text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.chapter_drafts (
  work_id uuid not null,
  chapter_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 100000),
  format text not null check (format in ('prose', 'image', 'comic', 'chat', 'mixed')),
  content jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (work_id, chapter_id),
  foreign key (work_id, chapter_id) references public.chapters(work_id, id) on delete cascade
);

create index chapter_drafts_work_updated on public.chapter_drafts(work_id, updated_at desc);

-- These checks are needed by the continuity table policies below. They inspect
-- a row by its high-entropy share ID but never return content or user data.
create function public.can_track_work(p_work_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.works w where w.id = p_work_id and (
      (w.state = 'published' and w.visibility in ('public', 'unlisted')) or w.author_id = auth.uid()
    )
  )
$$;

create function public.can_track_chapter(p_work_id uuid, p_chapter_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chapters c join public.works w on w.id = c.work_id
    where c.work_id = p_work_id and c.id = p_chapter_id and (
      (c.state = 'published' and w.state = 'published' and w.visibility in ('public', 'unlisted')) or w.author_id = auth.uid()
    )
  )
$$;
revoke all on function public.can_track_work(uuid) from public, anon;
revoke all on function public.can_track_chapter(uuid, uuid) from public, anon;
grant execute on function public.can_track_work(uuid), public.can_track_chapter(uuid, uuid) to authenticated;

alter table public.work_drafts enable row level security;
alter table public.chapter_drafts enable row level security;
create policy "Owners read work drafts" on public.work_drafts for select to authenticated
  using (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));
create policy "Owners create work drafts" on public.work_drafts for insert to authenticated
  with check (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));
create policy "Owners update work drafts" on public.work_drafts for update to authenticated
  using (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()))
  with check (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));
create policy "Owners delete work drafts" on public.work_drafts for delete to authenticated
  using (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));

create policy "Owners read chapter drafts" on public.chapter_drafts for select to authenticated
  using (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));
create policy "Owners create chapter drafts" on public.chapter_drafts for insert to authenticated
  with check (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));
create policy "Owners update chapter drafts" on public.chapter_drafts for update to authenticated
  using (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()))
  with check (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));
create policy "Owners delete chapter drafts" on public.chapter_drafts for delete to authenticated
  using (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));

grant select, insert, update, delete on public.work_drafts, public.chapter_drafts to authenticated;
revoke all on public.work_drafts, public.chapter_drafts from public, anon;

create table public.user_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, work_id)
);

create table public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null,
  chapter_id uuid not null,
  progress real not null default 0 check (progress between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, work_id),
  foreign key (work_id, chapter_id) references public.chapters(work_id, id) on delete cascade
);
create index reading_progress_user_updated on public.reading_progress(user_id, updated_at desc);

alter table public.user_bookmarks enable row level security;
alter table public.reading_progress enable row level security;
create policy "Readers view own bookmarks" on public.user_bookmarks for select to authenticated using (auth.uid() = user_id);
create policy "Readers add own bookmarks" on public.user_bookmarks for insert to authenticated
  with check (auth.uid() = user_id and public.can_track_work(work_id));
create policy "Readers remove own bookmarks" on public.user_bookmarks for delete to authenticated using (auth.uid() = user_id);
create policy "Readers view own progress" on public.reading_progress for select to authenticated using (auth.uid() = user_id);
create policy "Readers add own progress" on public.reading_progress for insert to authenticated
  with check (auth.uid() = user_id and public.can_track_chapter(work_id, chapter_id));
create policy "Readers update own progress" on public.reading_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.can_track_chapter(work_id, chapter_id));
create policy "Readers remove own progress" on public.reading_progress for delete to authenticated using (auth.uid() = user_id);
grant select, insert, update, delete on public.user_bookmarks, public.reading_progress to authenticated;
revoke all on public.user_bookmarks, public.reading_progress from public, anon;

create function public.publish_work(p_work_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  update public.works w set
    title = coalesce((select d.title from public.work_drafts d where d.work_id = w.id), w.title),
    summary = coalesce((select d.summary from public.work_drafts d where d.work_id = w.id), w.summary),
    visibility = coalesce((select d.visibility from public.work_drafts d where d.work_id = w.id), w.visibility),
    cover_url = coalesce((select d.cover_url from public.work_drafts d where d.work_id = w.id), w.cover_url),
    tags = coalesce((select d.tags from public.work_drafts d where d.work_id = w.id), w.tags),
    content_warnings = coalesce((select d.content_warnings from public.work_drafts d where d.work_id = w.id), w.content_warnings),
    state = 'published', updated_at = now()
  where w.id = p_work_id and w.author_id = auth.uid()
    and exists (select 1 from public.chapters c where c.work_id = w.id and c.state = 'published');
  get diagnostics changed = row_count;
  if changed = 0 then return false; end if;
  delete from public.work_drafts where work_id = p_work_id;
  return true;
end;
$$;

create function public.publish_chapter(p_work_id uuid, p_chapter_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  update public.chapters c set
    title = coalesce((select d.title from public.chapter_drafts d where d.work_id = c.work_id and d.chapter_id = c.id), c.title),
    body = coalesce((select d.body from public.chapter_drafts d where d.work_id = c.work_id and d.chapter_id = c.id), c.body),
    format = coalesce((select d.format from public.chapter_drafts d where d.work_id = c.work_id and d.chapter_id = c.id), c.format),
    content = coalesce((select d.content from public.chapter_drafts d where d.work_id = c.work_id and d.chapter_id = c.id), c.content),
    state = 'published', updated_at = now()
  where c.work_id = p_work_id and c.id = p_chapter_id
    and exists (select 1 from public.works w where w.id = c.work_id and w.author_id = auth.uid());
  get diagnostics changed = row_count;
  if changed = 0 then return false; end if;
  delete from public.chapter_drafts where work_id = p_work_id and chapter_id = p_chapter_id;
  return changed = 1;
end;
$$;

create function public.reorder_chapters(p_work_id uuid, p_chapter_ids uuid[])
returns boolean language plpgsql security invoker set search_path = '' as $$
declare total integer; max_position integer; offset_position integer;
begin
  if not exists (select 1 from public.works w where w.id = p_work_id and w.author_id = auth.uid()) then return false; end if;
  select count(*)::integer, coalesce(max(c.position), 0) into total, max_position
    from public.chapters c where c.work_id = p_work_id;
  if coalesce(cardinality(p_chapter_ids), 0) <> total
    or (select count(distinct chapter_id)::integer from unnest(p_chapter_ids) as items(chapter_id)) <> total
    or (select count(*)::integer from public.chapters c where c.work_id = p_work_id and c.id = any(p_chapter_ids)) <> total
    or max_position > 1000000000 then return false; end if;
  if total = 0 then return true; end if;
  offset_position := max_position + total + 1;
  update public.chapters set position = position + offset_position where work_id = p_work_id;
  update public.chapters c set position = array_position(p_chapter_ids, c.id)
    where c.work_id = p_work_id;
  return true;
end;
$$;

revoke all on function public.publish_work(uuid), public.publish_chapter(uuid, uuid), public.reorder_chapters(uuid, uuid[]) from public, anon;
grant execute on function public.publish_work(uuid), public.publish_chapter(uuid, uuid), public.reorder_chapters(uuid, uuid[]) to authenticated;

-- Replace the unlisted readers with typed metadata and format payload fields.
drop function if exists public.read_unlisted_work(uuid);
create function public.read_unlisted_work(p_work_id uuid)
returns table (id uuid, title text, summary text, visibility public.work_visibility, state public.publication_state, author_id uuid, cover_url text, tags text[], content_warnings text[])
language sql stable security definer set search_path = '' as $$
  select w.id, w.title, w.summary, w.visibility, w.state, w.author_id, w.cover_url, w.tags, w.content_warnings
  from public.works w where w.id = p_work_id and w.visibility = 'unlisted' and w.state = 'published'
$$;

drop function if exists public.read_unlisted_chapters(uuid);
create function public.read_unlisted_chapters(p_work_id uuid)
returns table (id uuid, title text, "position" integer, format text, content jsonb, body text, state public.publication_state, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.title, c.position, c.format, c.content, c.body, c.state, c.updated_at
  from public.chapters c join public.works w on w.id = c.work_id
  where w.id = p_work_id and w.visibility = 'unlisted' and w.state = 'published' and c.state = 'published'
  order by c.position
$$;

drop function if exists public.read_unlisted_chapter(uuid, uuid);
create function public.read_unlisted_chapter(p_work_id uuid, p_chapter_id uuid)
returns table (id uuid, title text, body text, "position" integer, work_id uuid, format text, content jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.title, c.body, c.position, c.work_id, c.format, c.content, c.updated_at
  from public.chapters c join public.works w on w.id = c.work_id
  where w.id = p_work_id and c.id = p_chapter_id and w.visibility = 'unlisted'
    and w.state = 'published' and c.state = 'published'
$$;

revoke all on function public.read_unlisted_work(uuid), public.read_unlisted_chapters(uuid), public.read_unlisted_chapter(uuid, uuid) from public, authenticated, anon;
grant execute on function public.read_unlisted_work(uuid), public.read_unlisted_chapters(uuid), public.read_unlisted_chapter(uuid, uuid) to authenticated, anon;
