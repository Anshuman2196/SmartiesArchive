create extension if not exists pgcrypto;

create type public.work_visibility as enum ('public', 'unlisted', 'private');
create type public.publication_state as enum ('draft', 'published');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 500),
  created_at timestamptz not null default now()
);

create table public.works (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 2000),
  visibility public.work_visibility not null default 'private',
  state public.publication_state not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 100000),
  position integer not null default 0 check (position > 0),
  state public.publication_state not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, position)
);

create index works_public_listing on public.works (updated_at desc) where visibility = 'public' and state = 'published';
create index chapters_read_order on public.chapters (work_id, position) where state = 'published';

create function public.assign_chapter_position()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.position <= 0 then
    perform pg_advisory_xact_lock(hashtextextended(new.work_id::text, 0));
    select coalesce(max(c.position), 0) + 1 into new.position
      from public.chapters c where c.work_id = new.work_id;
  end if;
  return new;
end;
$$;

create trigger chapters_assign_position before insert on public.chapters
for each row execute procedure public.assign_chapter_position();

create function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'reader_' || substr(new.id::text, 1, 12)),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Reader')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.works enable row level security;
alter table public.chapters enable row level security;

create policy "Profiles are public to read" on public.profiles for select using (true);
create policy "Owners update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Published public works and owners can read works" on public.works
for select using ((visibility in ('public', 'unlisted') and state = 'published') or auth.uid() = author_id);
create policy "Members create own works" on public.works
for insert to authenticated with check (auth.uid() = author_id);
create policy "Owners update own works" on public.works
for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "Owners delete own works" on public.works
for delete to authenticated using (auth.uid() = author_id);

create policy "Published chapters of readable works" on public.chapters
for select using (
  state = 'published' and exists (
    select 1 from public.works w where w.id = work_id
      and ((w.visibility in ('public', 'unlisted') and w.state = 'published') or w.author_id = auth.uid())
  )
  or exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid())
);
create policy "Owners create chapters" on public.chapters
for insert to authenticated with check (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));
create policy "Owners update chapters" on public.chapters
for update to authenticated using (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()))
with check (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));
create policy "Owners delete chapters" on public.chapters
for delete to authenticated using (exists (select 1 from public.works w where w.id = work_id and w.author_id = auth.uid()));
