-- Store published chapter word counts and return compact public library stats.
-- The generated column backfills existing chapters and updates automatically
-- whenever a chapter body changes.
alter table public.chapters
  add column word_count integer generated always as (
    case
      when btrim(body) = '' then 0
      else cardinality(regexp_split_to_array(btrim(body), E'\\s+'))
    end
  ) stored;

create index chapters_public_word_count on public.chapters (work_id) include (word_count)
  where state = 'published';

create or replace function public.get_public_library_chapter_stats(p_work_ids uuid[])
returns table (work_id uuid, chapter_count bigint, word_count bigint)
language sql stable security invoker set search_path = '' as $$
  select c.work_id, count(*)::bigint, coalesce(sum(c.word_count), 0)::bigint
  from public.chapters c
  join public.works w on w.id = c.work_id
  where c.work_id = any(p_work_ids)
    and c.state = 'published'
    and w.visibility = 'public'
    and w.state = 'published'
  group by c.work_id
$$;

revoke all on function public.get_public_library_chapter_stats(uuid[]) from public;
grant execute on function public.get_public_library_chapter_stats(uuid[]) to anon, authenticated;
